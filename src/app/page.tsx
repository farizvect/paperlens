"use client";

import * as React from "react";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { PdfViewer } from "@/components/pdf-viewer";
import { SettingsDialog } from "@/components/settings-dialog";
import { Onboarding } from "@/components/onboarding";
import { ResizableSplit } from "@/components/resizable-split";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const toggleSidebarCollapsed = useChatStore((s) => s.toggleSidebarCollapsed);
  const activeDocId = useChatStore((s) => s.activeDocId);
  const activeDocIds = useChatStore((s) => s.activeDocIds);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);

  // Auto-close PDF viewer when 2+ docs are merged
  React.useEffect(() => {
    if (activeDocIds.length > 1 && viewerOpen) {
      setViewerOpen(false);
    }
  }, [activeDocIds, viewerOpen]);

  // Close PDF viewer when active document is deleted
  React.useEffect(() => {
    if (!activeDocId && viewerOpen) {
      setViewerOpen(false);
    }
  }, [activeDocId, viewerOpen]);

  const [scrollToPage, setScrollToPage] = React.useState<number | null>(null);
  const [highlightText, setHighlightText] = React.useState<string | null>(null);
  const [highlightRange, setHighlightRange] = React.useState<{ page: number; start: number; end: number } | null>(null);

  // Listen for source-page-click events from ChatPanel
  React.useEffect(() => {
    function handleSourceClick(e: CustomEvent) {
      const page = e.detail?.page;
      const text = e.detail?.text;
      const range = e.detail?.highlightRange;
      if (page && typeof page === "number") {
        // Don't open PDF viewer on mobile
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        if (!isMobile) {
          setViewerOpen(true);
          setScrollToPage(page);
          if (text) setHighlightText(text);
          setHighlightRange(range && typeof range.start === "number" && typeof range.end === "number" ? range : null);
        }
        // Reset after a tick so the PdfViewer picks it up
        setTimeout(() => setScrollToPage(null), 500);
      }
    }
    window.addEventListener("source-page-click", handleSourceClick as EventListener);
    return () => window.removeEventListener("source-page-click", handleSourceClick as EventListener);
  }, []);

  return (
    <>
      <div
        className="grid h-dvh w-full overflow-hidden bg-[#f5f4ed]"
        style={{ gridTemplateColumns: sidebarCollapsed ? "0px 1fr" : "288px 1fr" }}
      >
        {/* Desktop sidebar */}
        <div className="hidden md:block overflow-hidden">
          <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
        </div>

        {/* Desktop content */}
        <div className="hidden md:block min-w-0 min-h-0 overflow-hidden">
          {viewerOpen ? (
            <ResizableSplit
              left={
                <ChatPanel
                  onToggleViewer={() => setViewerOpen((v) => !v)}
                  viewerOpen={viewerOpen}
                  onToggleSidebar={toggleSidebarCollapsed}
                  sidebarCollapsed={sidebarCollapsed}
                />
              }
              right={
                <PdfViewer
                  docId={activeDocId}
                  scrollToPage={scrollToPage}
                  highlightText={highlightText}
                  highlightRange={highlightRange}
                  onClose={() => setViewerOpen(false)}
                  className="flex-1"
                />
              }
              defaultRatio={0.50}
              minLeftPx={320}
              minRightPx={320}
              storageKey="paperlens-split-ratio"
            />
          ) : (
            <ChatPanel
              onToggleViewer={() => setViewerOpen((v) => !v)}
              viewerOpen={viewerOpen}
              onToggleSidebar={toggleSidebarCollapsed}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}
        </div>

        {/* Mobile layout */}
        <div className="flex md:hidden min-w-0 min-h-0 h-full" style={{ gridColumn: "1 / -1" }}>
          <ChatPanel
            onToggleViewer={() => setViewerOpen((v) => !v)}
            viewerOpen={viewerOpen}
            onToggleSidebar={toggleSidebarCollapsed}
            sidebarCollapsed={sidebarCollapsed}
          />
          {viewerOpen && (
            <div className="fixed inset-0 z-30 flex flex-col bg-[#f0efe8]">
              <PdfViewer
                docId={activeDocId}
                scrollToPage={scrollToPage}
                highlightText={highlightText}
                highlightRange={highlightRange}
                onClose={() => setViewerOpen(false)}
                className="flex-1"
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="absolute inset-y-0 left-0 w-72 max-w-[80vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
          </div>
        </div>
      )}

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Onboarding — first-time tutorial */}
      <Onboarding />
    </>
  );
}
