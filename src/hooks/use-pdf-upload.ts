"use client";

import * as React from "react";
import { useChatStore } from "@/store/chat";
import { processPdfFile } from "@/lib/client/upload";

/**
 * Manages PDF file upload via file input or drag-and-drop.
 * Handles parsing, chunking, storing the document, and setting it active.
 */
export function usePdfUpload() {
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
      const doc = await processPdfFile(file);
      await useChatStore.getState().setActiveDoc(doc.id, doc.name);
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
  }, []);

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
