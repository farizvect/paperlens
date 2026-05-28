"use client";

import * as React from "react";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { PdfViewer } from "@/components/pdf-viewer";
import { SettingsDialog } from "@/components/settings-dialog";
import { Onboarding } from "@/components/onboarding";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const activeDocId = useChatStore((s) => s.activeDocId);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [scrollToPage, setScrollToPage] = React.useState<number | null>(null);

  // Listen for source-page-click events from ChatPanel
  React.useEffect(() => {
    function handleSourceClick(e: CustomEvent) {
      const page = e.detail?.page;
      if (page && typeof page === "number") {
        setViewerOpen(true);
        setScrollToPage(page);
        // Reset after a tick so the PdfViewer picks it up
        setTimeout(() => setScrollToPage(null), 500);
      }
    }
    window.addEventListener("source-page-click", handleSourceClick as EventListener);
    return () => window.removeEventListener("source-page-click", handleSourceClick as EventListener);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#f5f4ed]">
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex">
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
        {/* Chat panel */}
        <div className={cn("flex flex-col flex-1 min-w-0 h-full", viewerOpen && "hidden md:flex")}>
          <ChatPanel
            onToggleViewer={() => setViewerOpen((v) => !v)}
            viewerOpen={viewerOpen}
          />
        </div>

        {/* PDF viewer — desktop split pane / mobile full screen */}
        {viewerOpen && (
          <>
            {/* Desktop: side panel */}
            <div className="hidden md:flex w-[45%] max-w-[600px] border-l border-[#e0ded6]">
              <PdfViewer
                docId={activeDocId}
                scrollToPage={scrollToPage}
                onClose={() => setViewerOpen(false)}
                className="flex-1"
              />
            </div>

            {/* Mobile: full screen overlay */}
            <div className="fixed inset-0 z-30 flex flex-col bg-[#f0efe8] md:hidden">
              <PdfViewer
                docId={activeDocId}
                scrollToPage={scrollToPage}
                onClose={() => setViewerOpen(false)}
                className="flex-1"
              />
            </div>
          </>
        )}
      </div>

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Onboarding — first-time tutorial */}
      <Onboarding />
    </div>
  );
}
