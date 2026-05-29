"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { loadPdfBlob } from "@/lib/client/storage";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, X, Type } from "lucide-react";
import { cn } from "@/lib/utils";

// Use local worker (copied to public/ by postinstall script)
pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs-dist@${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  docId: string | null;
  scrollToPage?: number | null;
  highlightText?: string | null;
  onClose?: () => void;
  className?: string;
}

// Normalize text for comparison: collapse whitespace, lowercase
function norm(s: string): string {
  return s.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").toLowerCase().trim();
}

// Highlight a range of characters in the PDF text layer
function highlightRange(
  spanRanges: { span: Element; start: number; end: number }[],
  matchStart: number,
  matchEnd: number,
  textLayer: Element
) {
  for (const sr of spanRanges) {
    if (sr.end > matchStart && sr.start < matchEnd) {
      const rect = sr.span.getBoundingClientRect();
      const layerRect = textLayer.getBoundingClientRect();
      const highlight = document.createElement("div");
      highlight.className = "pdf-source-highlight";
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left - layerRect.left}px;
        top: ${rect.top - layerRect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: rgba(27, 54, 93, 0.18);
        border-radius: 2px;
        pointer-events: none;
        z-index: 5;
        animation: pdf-highlight-fade-in 0.3s ease-out;
      `;
      textLayer.appendChild(highlight);
    }
    if (sr.start > matchEnd) break;
  }
}

export function PdfViewerInner({ docId, scrollToPage, highlightText, onClose, className }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [numPages, setNumPages] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [scale, setScale] = React.useState(1.3);
  const [pageInput, setPageInput] = React.useState("");
  const [pageHeight, setPageHeight] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pageRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const navSource = React.useRef<"button" | "external" | "scroll">("external");
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const [textSelectMode, setTextSelectMode] = React.useState(false);

  const PAGE_BUFFER = 2;
  const PAGE_GAP = 16; // py-2 = 8px top + 8px bottom padding per page wrapper
  const pageStep = pageHeight > 0 ? pageHeight + PAGE_GAP : 0;

  // Compute visible window for virtual scroller
  const startPage = Math.max(1, currentPage - PAGE_BUFFER);
  const endPage = Math.min(numPages, currentPage + PAGE_BUFFER);

  // Load PDF blob when docId changes
  React.useEffect(() => {
    if (!docId) {
      setPdfUrl(null);
      setNumPages(0);
      setCurrentPage(1);
      setPageHeight(0);
      setLoading(false);
      // Clean up highlights
      document.querySelectorAll(".pdf-source-highlight").forEach((el) => el.remove());
      return;
    }

    let revoked = false;
    setLoading(true);
    setError(null);
    setPageHeight(0);

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

  // Measure page height from first rendered page's actual DOM offsetHeight
  React.useEffect(() => {
    // Reset pageHeight when scale changes so we re-measure
    setPageHeight(0);
  }, [scale]);

  React.useEffect(() => {
    if (pageHeight > 0 || !numPages) return;
    // Wait for DOM to settle, then measure first rendered page
    const timer = setTimeout(() => {
      for (let i = startPage; i <= endPage; i++) {
        const el = pageRefs.current.get(i);
        if (el && el.offsetHeight > 0) {
          setPageHeight(el.offsetHeight);
          break;
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [numPages, currentPage, scale, pageHeight, startPage, endPage]);

  // Scroll to specific page when scrollToPage changes (external source click)
  React.useEffect(() => {
    if (scrollToPage && scrollToPage > 0 && scrollToPage <= numPages && pageStep > 0) {
      navSource.current = "button";
      setCurrentPage(scrollToPage);
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          const targetScroll = (scrollToPage - 1) * pageStep;
          container.scrollTo({ top: targetScroll, behavior: "smooth" });
        });
      }
    }
  }, [scrollToPage, numPages, pageStep]);

  // Scroll to current page when changed via nav buttons
  React.useEffect(() => {
    if (navSource.current === "button" && pageStep > 0) {
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          const targetScroll = (currentPage - 1) * pageStep;
          container.scrollTo({ top: targetScroll, behavior: "smooth" });
        });
      }
      // Allow scroll tracking to resume after button-initiated scroll settles
      setTimeout(() => {
        navSource.current = "external";
      }, 500);
    }
  }, [currentPage, pageStep]);

  // Scroll-based page detection
  function handleScroll() {
    const container = containerRef.current;
    if (!container || pageStep <= 0) return;
    if (navSource.current === "button") return;
    const scrollTop = container.scrollTop;
    const estimated = Math.round(scrollTop / pageStep) + 1;
    const clamped = Math.max(1, Math.min(numPages, estimated));
    if (clamped !== currentPage) {
      setCurrentPage(clamped);
    }
  }

  // Highlight text in PDF text layer when highlightText changes
  React.useEffect(() => {
    if (!highlightText) return;

    // Wait for text layer to render (react-pdf renders async)
    const timer = setTimeout(() => {
      // Remove previous highlights
      document.querySelectorAll(".pdf-source-highlight").forEach((el) => el.remove());

      // Only search the CURRENT page's text layer to avoid false matches
      const currentPageEl = pageRefs.current.get(currentPage);
      if (!currentPageEl) return;
      const textLayer = currentPageEl.querySelector(".react-pdf__Page__textContent");
      if (!textLayer) return;

      const spans = Array.from(textLayer.querySelectorAll("span"));
      if (spans.length === 0) return;

      // Build full text with single space between spans, track exact positions
      const spanRanges: { span: Element; start: number; end: number }[] = [];
      let fullText = "";
      for (const span of spans) {
        if (fullText.length > 0) fullText += " ";
        const t = span.textContent || "";
        const start = fullText.length;
        fullText += t;
        spanRanges.push({ span, start, end: fullText.length });
      }
      const nFullText = norm(fullText);

      // Use the full highlight text as one continuous search string
      const searchStr = norm(highlightText);
      if (searchStr.length < 3) return;

      // Try multiple match strategies in order of specificity
      const tryMatch = (needle: string): number => nFullText.indexOf(needle);

      let idx = tryMatch(searchStr);
      if (idx !== -1) {
        highlightRange(spanRanges, idx, idx + searchStr.length, textLayer);
        return;
      }

      // Strategy 2: try first 100, last 100, first 50 chars of search text
      const chunks = [
        searchStr.slice(0, 100),
        searchStr.slice(-100),
        searchStr.slice(0, 50),
      ].filter((c) => c.length >= 10);
      for (const chunk of chunks) {
        const altIdx = tryMatch(chunk);
        if (altIdx !== -1) {
          highlightRange(spanRanges, altIdx, altIdx + chunk.length, textLayer);
          return;
        }
      }

      // Strategy 3: word-level fallback — find first 5+ contiguous words in page text
      const words = searchStr.split(" ");
      if (words.length >= 5) {
        for (let len = words.length; len >= 5; len--) {
          for (let start = 0; start <= words.length - len; start++) {
            const phrase = words.slice(start, start + len).join(" ");
            const wIdx = tryMatch(phrase);
            if (wIdx !== -1) {
              highlightRange(spanRanges, wIdx, wIdx + phrase.length, textLayer);
              return;
            }
          }
        }
      }
    }, 1200); // longer timeout for page text layer to render

    return () => clearTimeout(timer);
  }, [highlightText, currentPage]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setLoading(false);
  }

  function onDocumentLoadError() {
    setError("Failed to render PDF");
    setLoading(false);
  }

  function handlePageSubmit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (p >= 1 && p <= numPages) {
      navSource.current = "button";
      setCurrentPage(p);
    }
    setPageInput("");
  }

  function handleFitWidth() {
    const container = containerRef.current;
    if (!container) return;
    const pageEl = pageRefs.current.get(currentPage);
    if (!pageEl) return;
    const canvas = pageEl.querySelector("canvas");
    if (!canvas) return;
    // canvas width at current scale / scale = natural width
    const naturalW = canvas.width / scale;
    const containerW = container.clientWidth - 24; // padding calculation
    const newScale = Math.min(2.5, Math.max(0.5, containerW / naturalW));
    setScale(newScale);
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
    <div className={cn("flex flex-col h-full bg-[#f0efe8]", className)}>
      {/* Toolbar — sticky top, always visible */}
      <div className="flex items-center justify-between gap-2 border-b border-[#e0ded6] bg-[#faf9f3] px-3 py-1.5 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              navSource.current = "button";
              setCurrentPage((p) => Math.max(1, p - 1));
            }}
            disabled={currentPage <= 1}
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page input — shows number, allows typing to jump */}
          <form onSubmit={handlePageSubmit} className="contents">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onFocus={() => setPageInput(String(currentPage))}
              onBlur={() => setPageInput("")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePageSubmit(e);
              }}
              className="w-[60px] text-center text-xs text-[#6a6a66] bg-transparent border-none outline-none focus:bg-white focus:rounded focus:shadow-sm focus:ring-1 focus:ring-[#1B365D]/30 py-0.5"
              placeholder={`${currentPage} / ${numPages || "—"}`}
              aria-label="Page number"
            />
          </form>

          <button
            onClick={() => {
              navSource.current = "button";
              setCurrentPage((p) => Math.min(numPages, p + 1));
            }}
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
          <button
            onClick={handleFitWidth}
            title="Fit width"
            className="rounded p-1 text-[#8a8a82] hover:bg-[#f5f4ed]"
          >
            <Maximize className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTextSelectMode((v) => !v)}
            title={textSelectMode ? "Disable text selection" : "Enable text selection"}
            className={cn(
              "rounded p-1 hover:bg-[#f5f4ed]",
              textSelectMode ? "text-[#1B365D]" : "text-[#8a8a82]"
            )}
          >
            <Type className="h-3.5 w-3.5" />
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
      <div ref={containerRef} onScroll={handleScroll} className="relative flex-1 h-0 overflow-y-auto overflow-x-hidden min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#8a8a82]" />
          </div>
        )}

        {pdfUrl && (
          <div className="w-full">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
          >
            {/* Top spacer — maintains scroll position for pages before the visible window */}
            {startPage > 1 && pageStep > 0 && (
              <div style={{ height: (startPage - 1) * pageStep }} aria-hidden="true" />
            )}

            {/* Rendered pages near current page */}
            {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((pageNum) => (
              <div
                key={pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageNum, el);
                }}
                data-page={pageNum}
                className={cn(
                  "flex justify-center w-full py-2",
                  pageNum === currentPage && "bg-[#1B365D]/5 rounded"
                )}
              >
                <Page
                  pageNumber={pageNum}
                  scale={scale}
                  renderTextLayer={!isMobile || textSelectMode}
                  renderAnnotationLayer={true}
                  className="shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                />
              </div>
            ))}

            {/* Bottom spacer — maintains scroll position for pages after the visible window */}
            {endPage < numPages && pageStep > 0 && (
              <div style={{ height: (numPages - endPage) * pageStep }} aria-hidden="true" />
            )}
          </Document>
          </div>
        )}
      </div>
    </div>
  );
}
