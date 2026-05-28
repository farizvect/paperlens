"use client";

import * as React from "react";
import { useChatStore } from "@/store/chat";
import { Sidebar } from "@/components/sidebar";
import { ChatPanel } from "@/components/chat-panel";
import { SettingsDialog } from "@/components/settings-dialog";
import { Onboarding } from "@/components/onboarding";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

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

      {/* Chat panel — full width on mobile */}
      <ChatPanel />

      {/* Settings dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Onboarding — first-time tutorial */}
      <Onboarding />
    </div>
  );
}
