"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Square,
  Upload,
  CheckCircle2,
  Quote,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isLoading: boolean;
  activeDocName: string | null;
  uploading: boolean;
  uploadError: string | null;
  setUploadError: (error: string | null) => void;
  uploadSuccess: boolean;
  onSummarize: () => void;
  onKeyQuotes: () => void;
  onToggleViewer?: () => void;
  viewerOpen?: boolean;
  multiDoc?: boolean;
}

export function ChatInput({
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
  activeDocName,
  uploading,
  uploadError,
  setUploadError,
  uploadSuccess,
  onSummarize,
  onKeyQuotes,
  onToggleViewer,
  viewerOpen,
  multiDoc,
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
    }
  }, [input]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <>
      {/* Upload error */}
      {uploadError && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Upload success indicator — floats above input */}
      {uploadSuccess && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 animate-check-fade">
          <div className="flex items-center gap-2 rounded-full bg-[#1B365D] px-4 py-2 text-sm text-white shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            Document uploaded
          </div>
        </div>
      )}

      {/* Quick actions — above input */}
      <div className="shrink-0 border-t border-[#e0ded6] bg-[#faf9f3] px-4 pt-2 pb-1 md:px-6">
        <div className="mx-auto max-w-3xl flex items-center gap-2">
          <button
            onClick={onSummarize}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-full border border-[#e0ded6] bg-[#faf9f3] px-3 py-1 text-xs text-[#8a8a82] hover:border-[#1B365D]/30 hover:text-[#1B365D] transition-colors disabled:opacity-50"
          >
            <BookOpen className="h-3 w-3" />
            Summarize
          </button>
          <button
            onClick={onKeyQuotes}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-full border border-[#e0ded6] bg-[#faf9f3] px-3 py-1 text-xs text-[#8a8a82] hover:border-[#1B365D]/30 hover:text-[#1B365D] transition-colors disabled:opacity-50"
          >
            <Quote className="h-3 w-3" />
            Key Quotes
          </button>
          {onToggleViewer && (
            <button
              onClick={() => {
                if (multiDoc) return;
                onToggleViewer();
              }}
              disabled={multiDoc}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                multiDoc
                  ? "border-[#e0ded6] bg-[#faf9f3] text-[#c0bfb8] cursor-not-allowed"
                  : viewerOpen
                    ? "border-[#1B365D]/30 bg-[#1B365D]/10 text-[#1B365D]"
                    : "border-[#e0ded6] bg-[#faf9f3] text-[#8a8a82] hover:border-[#1B365D]/30 hover:text-[#1B365D]"
              )}
              title={multiDoc ? "PDF viewer unavailable in multi-doc mode" : undefined}
            >
              {viewerOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              PDF Viewer
            </button>
          )}
        </div>
      </div>

      {/* Input area — sticky at bottom */}
      <div className="shrink-0 border-t border-[#e0ded6] bg-[#faf9f3] px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 md:gap-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${activeDocName || "this document"}…`}
            disabled={isLoading}
            className={cn(
              "min-h-[44px] max-h-32 resize-none border-[#e0ded6] bg-[#f5f4ed] text-sm placeholder:text-[#b0aeA4] focus-visible:ring-[#1B365D]/20 textarea-glow transition-shadow duration-200"
            )}
            rows={1}
          />
          <Button
            onClick={isLoading && onStop ? onStop : onSend}
            disabled={!isLoading && !input.trim()}
            className={cn(
              "h-11 w-11 shrink-0 transition-all",
              isLoading
                ? "bg-[#8a2c2c] text-white hover:bg-[#8a2c2c]/90"
                : "bg-[#1B365D] text-white hover:bg-[#1B365D]/90",
              input.trim() && !isLoading && "animate-send-pulse"
            )}
            size="icon"
            title={isLoading ? "Stop generating" : "Send message"}
          >
            {isLoading ? (
              <Square className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
