"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { ChatEmptyState } from "@/components/chat-empty-state";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { usePdfUpload } from "@/hooks/use-pdf-upload";
import { useChatStreaming } from "@/hooks/use-chat-streaming";
import {
  Menu,
  Upload,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface Source {
  text: string;
  docName: string;
  chunkIndex: number;
  page?: number;
  section?: string;
}

export function ChatPanel({ onToggleViewer, viewerOpen, onToggleSidebar, sidebarCollapsed }: { onToggleViewer?: () => void; viewerOpen?: boolean; onToggleSidebar?: () => void; sidebarCollapsed?: boolean }) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const activeDocId = useChatStore((s) => s.activeDocId);
  const activeDocName = useChatStore((s) => s.activeDocName);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const activeDocIds = useChatStore((s) => s.activeDocIds);

  const [input, setInput] = React.useState("");
  const [selectedSource, setSelectedSource] = React.useState<Source | null>(null);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  // Hooks
  const { scrollContainerRef, messagesEndRef, isNearBottomRef } = useAutoScroll(messages);
  const {
    uploading, uploadError, setUploadError, uploadSuccess, dragOver,
    handleFile, handleDrop, handleDragOver, handleDragLeave, fileInputRef,
  } = usePdfUpload();
  const { sendMessage } = useChatStreaming({
    addMessage,
    appendToMessage,
    setLoading,
    activeDocIds,
    setSelectedSource: () => setSelectedSource(null),
    setSuggestions,
    isNearBottomRef,
  });

  // Restore chat history on mount if activeDocId was restored from localStorage
  React.useEffect(() => {
    const state = useChatStore.getState();
    if (state.activeDocIds.length > 1 && state.messages.length === 0) {
      state.setActiveDocIds(state.activeDocIds);
      return;
    }
    if (state.activeDocId && state.messages.length === 0) {
      state.setActiveDoc(state.activeDocId, state.activeDocName ?? undefined);
    }
  }, []);

  // Save chat on page unload + periodic auto-save
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const state = useChatStore.getState();
      if (state.activeDocId && state.messages.length > 0) {
        state.saveCurrentChat();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    const interval = setInterval(() => {
      const state = useChatStore.getState();
      if (state.activeDocId && state.messages.length > 0 && !state.isLoading) {
        state.saveCurrentChat();
      }
    }, 30_000);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(interval);
    };
  }, []);

  // Clear suggestions when messages change significantly (new user message)
  React.useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user") {
      setSuggestions([]);
    }
  }, [messages]);

  // Load/persist suggestions
  const skipPersistRef = React.useRef(true);
  React.useEffect(() => { skipPersistRef.current = true; }, [activeDocId]);

  React.useEffect(() => {
    if (!activeDocId) return;
    try {
      const saved = localStorage.getItem(`suggestions:${activeDocId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSuggestions(parsed);
          skipPersistRef.current = false;
          return;
        }
      }
    } catch {}
    setSuggestions([]);
    skipPersistRef.current = false;
  }, [activeDocId]);

  React.useEffect(() => {
    if (skipPersistRef.current || !activeDocId) return;
    if (suggestions.length > 0) {
      localStorage.setItem(`suggestions:${activeDocId}`, JSON.stringify(suggestions));
    } else {
      localStorage.removeItem(`suggestions:${activeDocId}`);
    }
  }, [suggestions, activeDocId]);

  // Handlers
  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || (!activeDocId && activeDocIds.length === 0) || isLoading) return;
    setInput("");
    sendMessage(trimmed);
  }

  function handleSuggestionClick(suggestion: string) {
    setInput("");
    sendMessage(suggestion);
  }

  function handleRetry(retryText: string) {
    const msgs = messages.slice(0, -2);
    useChatStore.setState({ messages: msgs });
    sendMessage(retryText);
  }

  function handleKeyQuotes() {
    sendMessage("Extract the most important direct quotes and citations from this document.");
  }

  function handleSummarize() {
    sendMessage("Provide a comprehensive summary of this document. Include the main points, key findings, and conclusions. Format with headings and bullet points.");
  }

  const effectiveDocIds =
    activeDocIds.length > 0 ? activeDocIds : activeDocId ? [activeDocId] : [];

  // Empty state — no document selected
  if (!activeDocId) {
    return (
      <ChatEmptyState
        onToggleSidebar={onToggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        onToggleViewer={onToggleViewer}
        viewerOpen={viewerOpen}
        toggleSidebar={toggleSidebar}
        dragOver={dragOver}
        uploading={uploading}
        uploadSuccess={uploadSuccess}
        uploadError={uploadError}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        handleFile={handleFile}
        fileInputRef={fileInputRef}
      />
    );
  }

  return (
    <div className="flex flex-1 h-full flex-row bg-[#f5f4ed] relative">
      <div
        className={cn("flex flex-1 flex-col relative", "w-full")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1B365D]/10 backdrop-blur-sm animate-backdrop-in">
            <div className="animate-scale-in rounded-2xl border-2 border-dashed border-[#1B365D]/40 bg-[#faf9f3] px-8 py-6 text-center shadow-lg">
              <Upload className="mx-auto h-8 w-8 text-[#1B365D]/60" />
              <p className="mt-2 text-sm font-medium text-[#1B365D]">Drop PDF here</p>
            </div>
          </div>
        )}

        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-[#e0ded6] bg-[#faf9f3] px-4 py-3 md:hidden">
          <button onClick={toggleSidebar} className="rounded-lg p-1.5 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="truncate flex-1 text-sm font-medium text-[#1B365D]">{activeDocName || "Chat"}</h2>
        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between border-b border-[#e0ded6] bg-[#faf9f3] px-6 py-2">
          <div className="flex items-center gap-2">
            {onToggleSidebar && (
              <button onClick={onToggleSidebar} className="rounded-lg p-1.5 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors" title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
                {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
            )}
            {sidebarCollapsed && <h2 className="text-sm font-medium text-[#1B365D]">PaperLens</h2>}
            <h2 className="text-sm font-medium text-[#1B365D] truncate max-w-md">{activeDocName || "Chat"}</h2>
            {effectiveDocIds.length > 1 && (
              <span className="rounded-full bg-[#1B365D]/10 px-2 py-0.5 text-xs text-[#1B365D]">{effectiveDocIds.length} docs</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onToggleViewer && (
              <button
                onClick={() => {
                  if (effectiveDocIds.length > 1) return;
                  onToggleViewer();
                }}
                disabled={effectiveDocIds.length > 1}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  effectiveDocIds.length > 1
                    ? "text-[#c0bfb8] cursor-not-allowed"
                    : viewerOpen
                      ? "bg-[#1B365D]/10 text-[#1B365D]"
                      : "text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]"
                )}
                title={effectiveDocIds.length > 1 ? "PDF viewer unavailable in multi-doc mode" : viewerOpen ? "Close PDF viewer" : "Open PDF viewer"}
              >
                {viewerOpen ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <ChatMessages
          messages={messages}
          selectedSource={selectedSource}
          setSelectedSource={setSelectedSource}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          isLoading={isLoading}
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          onRetry={handleRetry}
          activeDocName={activeDocName}
        />

        {/* Input area */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSubmit}
          isLoading={isLoading}
          activeDocName={activeDocName}
          uploading={uploading}
          uploadError={uploadError}
          setUploadError={setUploadError}
          uploadSuccess={uploadSuccess}
          onSummarize={handleSummarize}
          onKeyQuotes={handleKeyQuotes}
          onToggleViewer={onToggleViewer}
          viewerOpen={viewerOpen}
          multiDoc={effectiveDocIds.length > 1}
        />
      </div>
    </div>
  );
}
