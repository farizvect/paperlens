"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Menu,
  Upload,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface ChatEmptyStateProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  onToggleViewer?: () => void;
  viewerOpen?: boolean;
  toggleSidebar: () => void;
  dragOver: boolean;
  uploading: boolean;
  uploadSuccess: boolean;
  uploadError: string | null;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFile: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatEmptyState({
  onToggleSidebar,
  sidebarCollapsed,
  onToggleViewer,
  viewerOpen,
  toggleSidebar,
  dragOver,
  uploading,
  uploadSuccess,
  uploadError,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFile,
  fileInputRef,
}: ChatEmptyStateProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col bg-[#f5f4ed] relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Mobile header */}
      <div className="flex items-center gap-3 border-b border-[#e0ded6] bg-[#faf9f3] px-4 py-3 md:hidden">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-medium text-[#1B365D]">PaperLens</h2>
        {onToggleViewer && (
          <button
            onClick={onToggleViewer}
            className={cn(
              "ml-auto rounded-lg p-1.5 transition-colors",
              viewerOpen
                ? "bg-[#1B365D]/10 text-[#1B365D]"
                : "text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]"
            )}
            title={viewerOpen ? "Close PDF viewer" : "Open PDF viewer"}
          >
            {viewerOpen ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Desktop sidebar toggle */}
      {onToggleSidebar && (
        <div className="hidden md:flex items-center gap-2 border-b border-[#e0ded6] bg-[#faf9f3] px-4 py-2.5">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-1.5 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors"
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          {sidebarCollapsed && (
            <h2 className="text-sm font-medium text-[#1B365D]">PaperLens</h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {onToggleViewer && (
              <button
                onClick={onToggleViewer}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  viewerOpen
                    ? "bg-[#1B365D]/10 text-[#1B365D]"
                    : "text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]"
                )}
                title={viewerOpen ? "Close PDF viewer" : "Open PDF viewer"}
              >
                {viewerOpen ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drag overlay with scale-in animation */}
      {dragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1B365D]/10 backdrop-blur-sm animate-backdrop-in">
          <div className="animate-scale-in rounded-2xl border-2 border-dashed border-[#1B365D]/40 bg-[#faf9f3] px-8 py-6 text-center shadow-lg">
            <Upload className="mx-auto h-8 w-8 text-[#1B365D]/60" />
            <p className="mt-2 text-sm font-medium text-[#1B365D]">Drop PDF here</p>
          </div>
        </div>
      )}

      {/* Welcome state — centered with fade-in */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 animate-welcome">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1B365D]/8">
            <FileText className="h-8 w-8 text-[#1B365D]/40" />
          </div>
          <div>
            <h2 className="text-lg font-medium leading-tight text-[#2a2a28]">
              Upload a PDF to get started
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#8a8a82]">
              Select a document from the sidebar, upload a new one, or drag & drop a PDF here.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-[#e0ded6] bg-[#faf9f3] px-5 py-2.5 text-sm text-[#8a8a82] hover:border-[#1B365D]/30 hover:bg-[#f5f4ed] hover:text-[#1B365D] transition-all cursor-pointer disabled:opacity-50",
              uploading && "animate-upload-pulse"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : uploadSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600 animate-check-fade" />
                Uploaded!
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload PDF
              </>
            )}
          </button>

          {uploadError && (
            <p className="text-sm text-red-600 max-w-md">{uploadError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
