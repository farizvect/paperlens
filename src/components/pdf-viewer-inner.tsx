"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { loadPdfBlob } from "@/lib/client/storage";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Use CDN worker — exact version match, avoids bare-specifier resolution issues
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  docId: string | null;
  scrollToPage?: number | null;
  highlightText?: string | null;
  onClose?: () => void;
  className?: string;
}

// Extract searchable phrases from chunk text (first N meaningful sentences)
function extractPhrases(text: string, maxPhrases = 3, minLen = 20): string[] {
  // Split on sentence boundaries, filter short fragments
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minLen);
  if (sentences.length > 0) return sentences.slice(0, maxPhrases);
  // Fallback: use first N words as a phrase
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const chunkSize = Math.min(15, words.length);
  return [words.slice(0, chunkSize).join(" ")];
}

// Normalize text for comparison: collapse whitespace, lowercase
function norm(s: string): string {
  return s.replace(/\s+/g, " ").toLowerCase().trim();
}

export function PdfViewerInner({ docId, scrollToPage, highlightText, onClose, className }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [scale, setScale] = React.useState(1.3);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pageRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  // Load PDF blob when docId changes
  React.useEffect(() => {
    if (!docId) {
      setPdfUrl(null);
      setNumPages(0);
      setCurrentPage(1);
      setLoading(false);
      // Clean up highlights
      document.querySelectorAll(".pdf-source-highlight").forEach((el) => el.remove());
      return;
    }

    let revoked = false;
    setLoading(true);
    setError(null);

    loadPdfBlob(docId)
      .then((blob) => {
        if (revoked) return;
        if (!blob) {
          setError("PDF not available for viewing. Re-upload the document to enable the viewer.");
          setLoading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch(() => {
        if (!revoked) {
          setError("Failed to load PDF");
          setLoading(false);
        }
      });

    return () => {
      revoked = true;
    };
  }, [docId]);

  // Cleanup blob URL
  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Scroll to specific page when scrollToPage changes
  React.useEffect(() => {
    if (scrollToPage && scrollToPage > 0 && scrollToPage <= numPages) {
      setCurrentPage(scrollToPage);
      const pageEl = pageRefs.current.get(scrollToPage);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [scrollToPage, numPages]);

  // Highlight text in PDF text layer when highlightText changes
  React.useEffect(() => {
    if (!highlightText) return;

    const phrases = extractPhrases(highlightText);
    if (phrases.length === 0) return;

    // Wait for text layer to render (react-pdf renders async)
    const timer = setTimeout(() => {
      // Remove previous highlights
      document.querySelectorAll(".pdf-source-highlight").forEach((el) => el.remove());

      // Find all text layer containers
      const textLayers = document.querySelectorAll(".react-pdf__Page__textContent");

      textLayers.forEach((layer) => {
        const spans = Array.from(layer.querySelectorAll("span"));
        if (spans.length === 0) return;

        // Build a map: concatenated text → span references with positions
        const allText = spans.map((s) => s.textContent || "");
        const fullText = norm(allText.join(" "));

        for (const phrase of phrases) {
          const nPhrase = norm(phrase);
          const idx = fullText.indexOf(nPhrase);
          if (idx === -1) continue;

          // Find which spans overlap with this phrase
          let charPos = 0;
          const matchStart = idx;
          const matchEnd = idx + nPhrase.length;

          for (const span of spans) {
            const spanText = span.textContent || "";
            const spanStart = charPos;
            const spanEnd = charPos + norm(spanText).length;

            // Check if this span overlaps with the match range
            if (spanEnd > matchStart && spanStart < matchEnd) {
              // Create highlight overlay matching this span's position
              const layerRect = layer.getBoundingClientRect();
              const spanRect = span.getBoundingClientRect();

              const highlight = document.createElement("div");
              highlight.className = "pdf-source-highlight";
              highlight.style.cssText = `
                position: absolute;
                left: ${spanRect.left - layerRect.left}px;
                top: ${spanRect.top - layerRect.top}px;
                width: ${spanRect.width}px;
                height: ${spanRect.height}px;
                background: rgba(27, 54, 93, 0.18);
                border-radius: 2px;
                pointer-events: none;
                z-index: 5;
                animation: pdf-highlight-fade-in 0.3s ease-out;
              `;
              layer.appendChild(highlight);
            }

            charPos = spanEnd + 1; // +1 for the space between spans
            if (charPos > matchEnd) break;
          }
        }
      });
    }, 800); // give react-pdf time to render text layer

    return () => clearTimeout(timer);
  }, [highlightText, scrollToPage, currentPage]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setLoading(false);
  }

  function onDocumentLoadError() {
    setError("Failed to render PDF");
    setLoading(false);
  }

  if (!docId) {
    return (
      <div className={cn("flex items-center justify-center bg-[#f5f4ed] text-[#8a8a82] text-sm", className)}>
        Select a document to preview
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-[#f5f4ed] text-[#8a8a82] text-sm p-4 text-center", className)}>
        <p>{error}</p>
        {onClose && (
          <button onClick={onClose} className="text-xs text-[#1B365D] hover:underline">
            Close viewer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-[#f0efe8]", className)}>
      {/* Toolbar — sticky top, always visible */}
      <div className="flex items-center justify-between gap-2 border-b border-[#e0ded6] bg-[#faf9f3] px-3 py-1.5 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[60px] text-center text-xs text-[#6a6a66]">
            {currentPage} / {numPages || "—"}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed]"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[40px] text-center text-xs text-[#6a6a66]">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed]"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* PDF content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#8a8a82]" />
          </div>
        )}

        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
          >
            {/* Render all pages for scroll navigation */}
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                }}
                className={cn(
                  "flex justify-center py-2",
                  pageNum === currentPage && "bg-[#1B365D]/5 rounded"
                )}
              >
                <Page
                  pageNumber={pageNum}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
