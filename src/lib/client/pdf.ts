"use client";

import { extractText } from "unpdf";

export interface ParsedPDF {
  pages: string[];
  numPages: number;
}

export async function parsePDFFile(file: File): Promise<ParsedPDF> {
  const buffer = await file.arrayBuffer();
  const { totalPages, text } = await extractText(new Uint8Array(buffer));

  // text is string[] (one per page) or a single string
  const pages: string[] = Array.isArray(text) ? text : [text];

  return {
    pages,
    numPages: totalPages,
  };
}
