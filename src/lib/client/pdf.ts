"use client";

import type { Chunk } from "@/lib/rag/chunker";

export interface ParsedPDFTextItem {
  text: string;
}

export interface ParsedPDF {
  pages: string[];
  pageItems: ParsedPDFTextItem[][];
  numPages: number;
}

export async function parsePDFFile(file: File): Promise<ParsedPDF> {
  // Dynamic import to avoid SSR issues (pdfjs-dist needs browser APIs)
  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs-dist@${pdfjs.version}/pdf.worker.min.mjs`;
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const pageItems: ParsedPDFTextItem[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items
      .map((item) => ({ text: "str" in item ? item.str : "", hasEOL: "hasEOL" in item && (item as { hasEOL?: boolean }).hasEOL === true }))
      .filter((item) => item.text.trim().length > 0);

    // Join text items with real line breaks where pdf.js marks EOL, instead
    // of a single space for everything. This preserves paragraph/heading
    // structure for the chunker's section detection.
    let pageText = "";
    for (const item of items) {
      pageText += item.text;
      pageText += item.hasEOL ? "\n" : " ";
    }
    pageText = pageText.trimEnd();

    pages.push(pageText);
    pageItems.push(items.map((item) => ({ text: item.text })));
  }

  return {
    pages,
    pageItems,
    numPages: pdf.numPages,
  };
}

/**
 * Compute embeddings for an array of chunks using the client-side model.
 * Returns a Map of chunk index (as string) -> embedding vector.
 *
 * This is a lazy operation — call only when the user triggers a search
 * or explicitly enables semantic search.
 */
export async function computeChunkEmbeddings(
  chunks: Chunk[]
): Promise<Map<string, number[]>> {
  const { getEmbedding } = await import("@/lib/search/embeddings");
  const result = new Map<string, number[]>();

  for (const chunk of chunks) {
    try {
      const emb = await getEmbedding(chunk.text);
      result.set(String(chunk.index), emb);
    } catch {
      // Skip chunks that fail to embed (e.g. empty text)
    }
  }

  return result;
}
