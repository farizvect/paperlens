"use client";

export interface ParsedPDF {
  pages: string[];
  numPages: number;
}

export async function parsePDFFile(file: File): Promise<ParsedPDF> {
  // Dynamic import to avoid SSR issues (pdfjs-dist needs browser APIs)
  const { pdfjs } = await import("react-pdf");
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return {
    pages,
    numPages: pdf.numPages,
  };
}
