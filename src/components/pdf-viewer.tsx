"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import PdfViewer with SSR disabled (react-pdf needs browser APIs)
const PdfViewerInner = dynamic(() => import("@/components/pdf-viewer-inner").then(m => m.PdfViewerInner), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-[#8a8a82]" />
    </div>
  ),
});

interface PdfViewerProps {
  docId: string | null;
  scrollToPage?: number | null;
  highlightText?: string | null;
  onClose?: () => void;
  className?: string;
}

export function PdfViewer(props: PdfViewerProps) {
  return <PdfViewerInner {...props} />;
}
