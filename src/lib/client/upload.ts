"use client";

import { saveDocument, saveChunks, savePdfBlob } from "@/lib/client/storage";
import type { StoredDocument, StoredChunk } from "@/lib/client/storage";
import { parsePDFFile } from "@/lib/client/pdf";
import { chunkText } from "@/lib/rag/chunker";
import { findTextItemRangeForChunk } from "@/lib/rag/highlight-anchors";
import { ensureDocEmbeddings } from "@/lib/search/embedding-cache";

export const SCANNED_PDF_ERROR =
  "This PDF appears to be a scanned image with no extractable text.";

/**
 * Parse, chunk, and persist a PDF. Shared by the chat-panel upload and the
 * sidebar upload so both paths behave identically (same scanned-PDF check,
 * same highlight-anchor extraction, same error messages).
 *
 * Returns the created document; the caller decides what to do with it
 * (set active doc, refresh list, etc.).
 */
export async function processPdfFile(file: File): Promise<StoredDocument> {
  const { pages, pageItems, numPages } = await parsePDFFile(file);

  // Check for scanned PDF (no extractable text)
  const totalText = pages.join("").trim();
  if (totalText.length < 50) {
    throw new Error(SCANNED_PDF_ERROR);
  }

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

  // Warm up semantic embeddings in the background so hybrid search is ready
  // by the time the user asks their first question. Fire-and-forget: upload
  // never waits on model inference.
  void ensureDocEmbeddings(docId).catch(() => {});

  return doc;
}
