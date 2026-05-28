"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Trash2, X, Loader2, Settings, Check, Square, CheckSquare } from "lucide-react";
import {
  listDocuments,
  saveDocument,
  saveChunks,

  deleteDocument,
  searchChunks,
  type StoredDocument,
  type StoredChunk,
} from "@/lib/client/storage";
import { parsePDFFile } from "@/lib/client/pdf";
import { chunkText } from "@/lib/rag/chunker";

interface SearchResult {
  text: string;
  docName: string;
  chunkIndex: number;
  docId: string;
}

export function Sidebar({ onSettingsClick }: { onSettingsClick?: () => void }) {
  const activeDocId = useChatStore((s) => s.activeDocId);
  const activeDocIds = useChatStore((s) => s.activeDocIds);
  const setActiveDoc = useChatStore((s) => s.setActiveDoc);
  const toggleDocSelection = useChatStore((s) => s.toggleDocSelection);
  const setActiveDocIds = useChatStore((s) => s.setActiveDocIds);
  const clear = useChatStore((s) => s.clear);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const [documents, setDocuments] = React.useState<StoredDocument[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout>>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Track closing state for exit animation
  const [isClosing, setIsClosing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  React.useEffect(() => {
    loadDocuments();
  }, []);

  // Listen for document list refreshes (after upload from chat panel)
  React.useEffect(() => {
    const handleRefresh = () => loadDocuments();
    window.addEventListener("documents-refresh", handleRefresh);
    return () => window.removeEventListener("documents-refresh", handleRefresh);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  React.useEffect(() => {
    if (sidebarOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen, isMobile]);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      setSidebarOpen(false);
      setIsClosing(false);
    }, 200);
  }

  async function loadDocuments() {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch {
      // Silently fail
    }
  }

  function handleSearch(value: string) {
    setSearchQuery(value);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!value.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchChunks(value, { limit: 10 });
        setSearchResults(
          results.map((r) => ({
            text: r.text,
            docName: r.docName,
            chunkIndex: r.chunkIndex,
            docId: r.docId,
          }))
        );
        setShowResults(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const { pages, numPages } = await parsePDFFile(file);

      // Check for scanned PDF
      const totalText = pages.join("").trim();
      if (totalText.length < 50) {
        throw new Error("This PDF appears to be a scanned image with no extractable text.");
      }

      const chunks = chunkText(pages);
      const docId = Math.random().toString(36).slice(2) + Date.now().toString(36);

      const doc: StoredDocument = {
        id: docId,
        name: file.name,
        numPages,
        numChunks: chunks.length,
        createdAt: Date.now(),
      };
      await saveDocument(doc);

      if (chunks.length > 0) {
        const storedChunks: StoredChunk[] = chunks.map((chunk, i) => ({
          id: `${docId}-${i}`,
          docId,
          docName: file.name,
          chunkIndex: chunk.index,
          text: chunk.text,
          page: chunk.page,
          section: chunk.section,
        }));
        await saveChunks(storedChunks);
      }


      await loadDocuments();
      await setActiveDoc(docId, file.name);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      if (activeDocId === docId) {
        setActiveDoc(null);
        clear();
      }
      // Also remove from multi-select if present
      if (activeDocIds.includes(docId)) {
        setActiveDocIds(activeDocIds.filter((id) => id !== docId));
      }
    } catch {
      // Silently fail
    }
  }

  function handleCheckboxClick(e: React.MouseEvent, docId: string) {
    e.stopPropagation();
    toggleDocSelection(docId);
  }

  const selectedCount = activeDocIds.length;

  // Render a document row with checkbox
  function renderDocRow(doc: StoredDocument, isMobileLayout: boolean) {
    const isSelected = activeDocIds.includes(doc.id);
    const isActive = activeDocId === doc.id;

    return (
      <div
        key={doc.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          setActiveDoc(doc.id, doc.name);
          if (isMobileLayout) handleClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setActiveDoc(doc.id, doc.name);
            if (isMobileLayout) handleClose();
          }
        }}
        className={cn(
          "group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1B365D]/20",
          isActive
            ? "bg-[#1B365D]/8 text-[#1B365D]"
            : isSelected
              ? "bg-[#1B365D]/5"
              : "hover:bg-[#f5f4ed]"
        )}
      >
        {/* Checkbox for multi-select */}
        <button
          onClick={(e) => handleCheckboxClick(e, doc.id)}
          className="mt-0.5 shrink-0 rounded p-0.5 transition-colors hover:bg-[#e0ded6]"
          title={isSelected ? "Deselect document" : "Select document"}
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-[#1B365D]" />
          ) : (
            <Square className="h-4 w-4 text-[#b0b0a8]" />
          )}
        </button>

        <FileText
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            isActive
              ? "text-[#1B365D]"
              : "text-[#8a8a82]"
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium leading-tight",
              isActive
                ? "text-[#1B365D]"
                : "text-[#2a2a28]"
            )}
          >
            {doc.name}
          </p>
          <div className="mt-1 flex gap-2">
            <Badge
              variant="outline"
              className="border-[#e0ded6] text-[10px] text-[#8a8a82]"
            >
              {doc.numPages} pages
            </Badge>
            <Badge
              variant="outline"
              className="border-[#e0ded6] text-[10px] text-[#8a8a82]"
            >
              {doc.numChunks} chunks
            </Badge>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteDoc(doc.id);
          }}
          className={cn(
            "mt-0.5 shrink-0 rounded p-1 transition-opacity hover:bg-red-50 hover:text-red-600",
            isMobileLayout
              ? "opacity-100"
              : "opacity-0 md:group-hover:opacity-100"
          )}
          title="Delete document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // On mobile: render as overlay with animation
  if (isMobile) {
    if (!sidebarOpen && !isClosing) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/20",
            isClosing ? "animate-backdrop-out" : "animate-backdrop-in"
          )}
          onClick={handleClose}
        />
        {/* Sidebar panel */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-[#e0ded6] bg-[#faf9f3]",
            isClosing ? "animate-sidebar-out" : "animate-sidebar-in"
          )}
        >
          {/* Fixed header */}
          <div className="shrink-0">
            {/* Brand */}
            <div className="flex items-center gap-2.5 px-4 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B365D]/10">
                <FileText className="h-4 w-4 text-[#1B365D]" />
              </div>
              <h1 className="text-base font-medium leading-tight text-[#1B365D]">
                PaperLens
              </h1>
              {selectedCount > 0 && (
                <Badge className="ml-1 bg-[#1B365D] text-white text-[10px]">
                  {selectedCount}
                </Badge>
              )}
              <button
                onClick={handleClose}
                className="ml-auto rounded-lg p-1.5 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <Separator className="bg-[#e0ded6]" />

            {/* Hidden file input — always present */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />

            {/* Upload — only when documents exist */}
            {documents.length > 0 && (
              <div className="px-4 pt-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={cn(
                    "w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#e0ded6] bg-[#f5f4ed] px-4 py-3 text-sm text-[#8a8a82] hover:border-[#1B365D]/30 hover:bg-[#f0efe8] hover:text-[#1B365D] transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                    uploading && "animate-upload-pulse"
                  )}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "+ Upload PDF"
                  )}
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative px-4 pt-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a82]" />
                <Input
                  placeholder="Search documents…"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  className="border-[#e0ded6] bg-[#f5f4ed] pl-9 text-sm placeholder:text-[#b0aeA4] focus-visible:ring-[#1B365D]/20"
                />
              </div>

              {/* Search results dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute left-4 right-4 z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#e0ded6] bg-[#faf9f3] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      className="w-full px-3 py-2 text-left transition-colors hover:bg-[#f5f4ed]"
                      onClick={() => {
                        setActiveDoc(result.docId, result.docName);
                        setShowResults(false);
                      }}
                    >
                      <p className="text-xs font-medium text-[#1B365D]">
                        {result.docName}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#6a6a66]">
                        {result.text}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {searching && (
                <div className="px-3 py-2 text-center text-xs text-[#8a8a82]">
                  Searching…
                </div>
              )}
            </div>

            <Separator className="mx-4 bg-[#e0ded6]" />
          </div>

          {/* Scrollable document list */}
          <div className="flex flex-1 flex-col overflow-hidden px-2 pt-3 min-h-0">
            {documents.length > 0 && (
              <p className="shrink-0 px-2 pb-2 text-xs font-medium uppercase tracking-wider text-[#8a8a82]">
                Documents ({documents.length})
              </p>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="space-y-1 pr-2 pb-4">
                {documents.map((doc) => renderDocRow(doc, true))}
              </div>
            </div>
          </div>

          {/* Bottom section: Settings */}
          <div className="shrink-0 border-t border-[#e0ded6] px-4 py-3">
            <button
              onClick={() => onSettingsClick?.()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>
      </>
    );
  }

  // Desktop: static sidebar (always visible)
  return (
    <aside className="hidden md:flex h-full w-72 flex-col border-r border-[#e0ded6] bg-[#faf9f3]">
      {/* Fixed header */}
      <div className="shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B365D]/10">
            <FileText className="h-4 w-4 text-[#1B365D]" />
          </div>
          <h1 className="text-base font-medium leading-tight text-[#1B365D]">
            PaperLens
          </h1>
          {selectedCount > 0 && (
            <Badge className="ml-1 bg-[#1B365D] text-white text-[10px]">
              {selectedCount}
            </Badge>
          )}
        </div>

        <Separator className="bg-[#e0ded6]" />

        {/* Hidden file input — always present */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />

        {/* Upload — only when documents exist */}
        {documents.length > 0 && (
          <div className="px-4 pt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#e0ded6] bg-[#f5f4ed] px-4 py-3 text-sm text-[#8a8a82] hover:border-[#1B365D]/30 hover:bg-[#f0efe8] hover:text-[#1B365D] transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                uploading && "animate-upload-pulse"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "+ Upload PDF"
              )}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a82]" />
            <Input
              placeholder="Search documents…"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className="border-[#e0ded6] bg-[#f5f4ed] pl-9 text-sm placeholder:text-[#b0aeA4] focus-visible:ring-[#1B365D]/20"
            />
          </div>

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute left-4 right-4 z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#e0ded6] bg-[#faf9f3] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  className="w-full px-3 py-2 text-left transition-colors hover:bg-[#f5f4ed]"
                  onClick={() => {
                    setActiveDoc(result.docId, result.docName);
                    setShowResults(false);
                  }}
                >
                  <p className="text-xs font-medium text-[#1B365D]">
                    {result.docName}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#6a6a66]">
                    {result.text}
                  </p>
                </button>
              ))}
            </div>
          )}

          {searching && (
            <div className="px-3 py-2 text-center text-xs text-[#8a8a82]">
              Searching…
            </div>
          )}
        </div>

        <Separator className="mx-4 bg-[#e0ded6]" />
      </div>

      {/* Scrollable document list */}
      <div className="flex flex-1 flex-col overflow-hidden px-2 pt-3 min-h-0">
        {documents.length > 0 && (
          <p className="shrink-0 px-2 pb-2 text-xs font-medium uppercase tracking-wider text-[#8a8a82]">
            Documents ({documents.length})
          </p>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-1 pr-2 pb-4">
            {documents.map((doc) => renderDocRow(doc, false))}
          </div>
        </div>
      </div>

      {/* Bottom section: Settings */}
      <div className="shrink-0 border-t border-[#e0ded6] px-4 py-3">
        <button
          onClick={() => onSettingsClick?.()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28] transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
