"use client";

import * as React from "react";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { PdfViewer } from "@/components/pdf-viewer";
import { SettingsDialog } from "@/components/settings-dialog";
import { Onboarding } from "@/components/onboarding";
import { ResizableSplit } from "@/components/resizable-split";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const toggleSidebarCollapsed = useChatStore((s) => s.toggleSidebarCollapsed);
  const activeDocId = useChatStore((s) => s.activeDocId);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [scrollToPage, setScrollToPage] = React.useState<number | null>(null);
  const [highlightText, setHighlightText] = React.useState<string | null>(null);

  // Listen for source-page-click events from ChatPanel
  React.useEffect(() => {
    function handleSourceClick(e: CustomEvent) {
      const page = e.detail?.page;
      const text = e.detail?.text;
      if (page && typeof page === "number") {
        setViewerOpen(true);
        setScrollToPage(page);
        if (text) setHighlightText(text);
        // Reset after a tick so the PdfViewer picks it up
        setTimeout(() => setScrollToPage(null), 500);
      }
    }
    window.addEventListener("source-page-click", handleSourceClick as EventListener);
    return () => window.removeEventListener("source-page-click", handleSourceClick as EventListener);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#f5f4ed]">
      {/* Desktop sidebar — collapsible with animation */}
      <div
        className={cn(
          "hidden md:flex overflow-hidden transition-all duration-300 ease-in-out shrink-0",
          sidebarCollapsed ? "w-0 opacity-0" : "w-72 opacity-100"
        )}
      >
        <Sidebar onSettingsClick={() => setSettingsOpen(true)} />
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

      {/* Main content area */}
      <div className="flex flex-1 h-full min-w-0">
        {/* Desktop layout */}
        <div className="hidden md:flex flex-1 h-full min-w-0">
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
                  onClose={() => setViewerOpen(false)}
                  className="flex-1"
                />
              }
              defaultRatio={0.65}
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
        <div className="flex md:hidden flex-1 min-w-0">
          {viewerOpen ? (
            <div className="fixed inset-0 z-30 flex flex-col bg-[#f0efe8]">
              <PdfViewer
                docId={activeDocId}
                scrollToPage={scrollToPage}
                highlightText={highlightText}
                onClose={() => setViewerOpen(false)}
                className="flex-1"
              />
            </div>
          ) : (
            <ChatPanel
              onToggleViewer={() => setViewerOpen((v) => !v)}
              viewerOpen={viewerOpen}
              onToggleSidebar={toggleSidebarCollapsed}
              sidebarCollapsed={sidebarCollapsed}
            />
          )}
        </div>
      </div>

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Onboarding — first-time tutorial */}
      <Onboarding />
    </div>
  );
}
