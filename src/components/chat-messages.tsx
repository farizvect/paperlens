"use client";

import * as React from "react";
import { useChatStore, type ChatMessage } from "@/store/chat";
import { MessageBubble } from "@/components/message-bubble";
import { SourceCard } from "@/components/source-card";
import { FileText, Send } from "lucide-react";
import { stripSuggestionsTag } from "@/hooks/use-chat-streaming";

interface Source {
  text: string;
  docName: string;
  chunkIndex: number;
  page?: number;
  section?: string;
  highlightRange?: { page: number; start: number; end: number };
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  selectedSource: Source | null;
  setSelectedSource: (source: Source | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  onRetry: (retryText: string) => void;
  activeDocName: string | null;
}

export function ChatMessages({
  messages,
  selectedSource,
  setSelectedSource,
  scrollContainerRef,
  messagesEndRef,
  isLoading,
  suggestions,
  onSuggestionClick,
  onRetry,
  activeDocName,
}: ChatMessagesProps) {
  const lastMsg = messages[messages.length - 1];
  const showLoadingInBubble =
    isLoading && lastMsg?.role === "assistant" && lastMsg?.content === "";

  return (
    <>
      {/* Messages — scrollable area that fills remaining space */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:py-4 min-h-0">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Welcome message when no messages yet — fade-in */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-welcome">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1B365D]/8 mb-4">
                <FileText className="h-7 w-7 text-[#1B365D]/40" />
              </div>
              <h3 className="text-base font-medium text-[#2a2a28] mb-2">
                {activeDocName}
              </h3>
              <p className="text-sm leading-relaxed text-[#8a8a82] max-w-md">
                Dokumen sudah siap. Ajukan pertanyaan tentang isi dokumen ini, minta rangkuman, atau cari informasi spesifik. Cukup ketik di bawah untuk memulai.
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            let parsedSources: Source[] | undefined;
            if (msg.sources) {
              try {
                parsedSources = JSON.parse(msg.sources);
              } catch {
                parsedSources = undefined;
              }
            }

            // Strip suggestions tag from display content
            let displayContent = msg.content;
            if (msg.role === "assistant") {
              displayContent = stripSuggestionsTag(displayContent);
            }

            const isLastAssistantLoading =
              showLoadingInBubble && i === messages.length - 1;

            // Staggered animation delay for new messages (only last few)
            const isNewMessage = i >= Math.max(0, messages.length - 2);
            const delay = isNewMessage ? (i - Math.max(0, messages.length - 2)) * 80 : 0;

            const isLastAssistant =
              msg.role === "assistant" && i === messages.length - 1;

            return (
              <React.Fragment key={msg.id}>
                <MessageBubble
                  role={msg.role}
                  content={displayContent}
                  sources={parsedSources}
                  onSourceClick={(source) => {
                    setSelectedSource(source);
                    // Dispatch page event for PDF viewer with chunk text for highlighting
                    if (source.page) {
                      window.dispatchEvent(
                        new CustomEvent("source-page-click", { detail: { page: source.page, text: source.text, highlightRange: source.highlightRange } })
                      );
                    }
                  }}
                  isLoading={isLastAssistantLoading}
                  animationDelay={delay}
                  tokenUsage={msg.tokenUsage}
                />
                {/* Follow-up suggestions — show after last assistant message */}
                {isLastAssistant &&
                  !isLoading &&
                  suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 animate-message-left">
                      {suggestions.map((suggestion, si) => (
                        <button
                          key={si}
                          onClick={() => onSuggestionClick(suggestion)}
                          className="inline-flex items-center gap-1 rounded-full border border-[#e0ded6] bg-[#faf9f3] px-3 py-1.5 text-xs text-[#8a8a82] hover:border-[#1B365D]/30 hover:bg-[#f5f4ed] hover:text-[#1B365D] transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
              </React.Fragment>
            );
          })}

          {/* Retry button for failed messages */}
          {(() => {
            const lastMsg = messages[messages.length - 1];
            const secondLast = messages[messages.length - 2];
            if (
              lastMsg?.role === "assistant" &&
              lastMsg.content.startsWith("*Error:") &&
              secondLast?.role === "user" &&
              !isLoading
            ) {
              return (
                <div className="flex justify-center animate-message-left">
                  <button
                    onClick={() => onRetry(secondLast.content)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0ded6] bg-[#faf9f3] px-3 py-1.5 text-xs text-[#8a8a82] hover:border-[#1B365D]/30 hover:text-[#1B365D] transition-colors"
                  >
                    <Send className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              );
            }
            return null;
          })()}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Source card — inline on desktop, bottom sheet on mobile */}
      {selectedSource && (
        <>
          {/* Mobile: bottom sheet */}
          <div className="md:hidden">
            <SourceCard
              docName={selectedSource.docName}
              chunkIndex={selectedSource.chunkIndex}
              text={selectedSource.text}
              page={selectedSource.page}
              section={selectedSource.section}
              onClick={() => setSelectedSource(null)}
              isBottomSheet
              onDismiss={() => setSelectedSource(null)}
            />
          </div>
          {/* Desktop: inline */}
          <div className="hidden md:block border-t border-[#e0ded6] bg-[#faf9f3] px-4 py-3 md:px-6">
            <div className="mx-auto max-w-3xl">
              <SourceCard
                docName={selectedSource.docName}
                chunkIndex={selectedSource.chunkIndex}
                text={selectedSource.text}
                page={selectedSource.page}
                section={selectedSource.section}
                onClick={() => setSelectedSource(null)}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
