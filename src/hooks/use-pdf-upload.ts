"use client";

import * as React from "react";
import { saveDocument, saveChunks, savePdfBlob } from "@/lib/client/storage";
import type { StoredDocument, StoredChunk } from "@/lib/client/storage";
import { parsePDFFile } from "@/lib/client/pdf";
import { chunkText } from "@/lib/rag/chunker";
import { findTextItemRangeForChunk } from "@/lib/rag/highlight-anchors";
import { useChatStore } from "@/store/chat";

/**
 * Manages PDF file upload via file input or drag-and-drop.
 * Handles parsing, chunking, storing the document, and setting it active.
 */
export function usePdfUpload() {
  const setActiveDoc = useChatStore((s) => s.setActiveDoc);

  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = React.useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const { pages, pageItems, numPages } = await parsePDFFile(file);
      const chunks = chunkText(pages);
      const docId = Math.random().toString(36).slice(2) + Date.now().toString(36);

      const doc: StoredDocument = {
        id: docId,
        name: file.name,
        numPages,
        numChunks: chunks.length,
        createdAt: Date.now(),
      };
      await saveDocument(doc);

      if (chunks.length > 0) {
        const storedChunks: StoredChunk[] = chunks.map((chunk, i) => ({
          id: `${docId}-${i}`,
          docId,
          docName: file.name,
          chunkIndex: chunk.index,
          text: chunk.text,
          page: chunk.page,
          section: chunk.section,
          highlightRange: findTextItemRangeForChunk(chunk, pageItems),
        }));
        await saveChunks(storedChunks);
      }

      // Save raw PDF blob for viewer
      await savePdfBlob(docId, file);

      await setActiveDoc(docId, file.name);
      window.dispatchEvent(new CustomEvent("documents-refresh"));

      // Show success indicator briefly
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to process PDF";
      setUploadError(msg);
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [setActiveDoc]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (pdfFile) {
      handleFile(pdfFile);
    }
  }

  return {
    uploading,
    uploadError,
    setUploadError,
    uploadSuccess,
    dragOver,
    handleFile,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    fileInputRef,
  };
}
