"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useChatStore, type ChatMessage, type TokenUsage } from "@/store/chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "@/components/message-bubble";
import { SourceCard } from "@/components/source-card";
import {
  Send,
  Loader2,
  FileText,
  Menu,
  Upload,
  CheckCircle2,
  Quote,
  BookOpen,
} from "lucide-react";
import {
  searchChunks,
  getDocChunks,
  saveDocument,
  saveChunks,
  saveChatMessages,
  loadChatMessages,
  rankChunks,
  type StoredDocument,
  type StoredChunk,
} from "@/lib/client/storage";
import { parsePDFFile } from "@/lib/client/pdf";
import { chunkText } from "@/lib/rag/chunker";

interface Source {
  text: string;
  docName: string;
  chunkIndex: number;
  page?: number;
  section?: string;
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const activeDocId = useChatStore((s) => s.activeDocId);
  const activeDocName = useChatStore((s) => s.activeDocName);
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const setActiveDoc = useChatStore((s) => s.setActiveDoc);

  const activeDocIds = useChatStore((s) => s.activeDocIds);

  const [input, setInput] = React.useState("");
  const [selectedSource, setSelectedSource] = React.useState<Source | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const streamDocIdRef = React.useRef<string | null>(null);
  const streamBufferRef = React.useRef<string>("");
  const streamSourcesRef = React.useRef<string | undefined>(undefined);
  const streamUsageRef = React.useRef<TokenUsage | undefined>(undefined);
  const streamSuggestionsRef = React.useRef<string[] | undefined>(undefined);

  // Track activeDocId changes (no abort — streams continue in background)
  React.useEffect(() => {
    // Just a tracker, no cleanup needed
  }, [activeDocId]);

  // Restore chat history on mount if activeDocId was restored from localStorage
  React.useEffect(() => {
    const state = useChatStore.getState();
    // Multi-doc: restore chat via setActiveDocIds (loads combined chat history)
    if (state.activeDocIds.length > 1 && state.messages.length === 0) {
      state.setActiveDocIds(state.activeDocIds);
      return;
    }
    // Single doc: restore via setActiveDoc
    if (state.activeDocId && state.messages.length === 0) {
      state.setActiveDoc(state.activeDocId, state.activeDocName ?? undefined);
    }
  }, []);


  // Auto-scroll to bottom only if user is already near the bottom
  const isNearBottomRef = React.useRef(true);

  // Track if user is near bottom
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 150; // px from bottom
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < threshold;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new messages only if user is near bottom
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && messages.length > 0 && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 128) + "px";
    }
  }, [input]);

  // Save chat on page unload + periodic auto-save
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      const state = useChatStore.getState();
      if (state.activeDocId && state.messages.length > 0) {
        state.saveCurrentChat();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Periodic auto-save every 30s (backup for beforeunload being unreliable)
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

  // Load suggestions on doc change, save when they change
  const skipPersistRef = React.useRef(true);

  // Reset skip flag when doc changes
  React.useEffect(() => {
    skipPersistRef.current = true;
  }, [activeDocId]);

  // Load saved suggestions
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

  // Persist suggestions
  React.useEffect(() => {
    if (skipPersistRef.current || !activeDocId) return;
    if (suggestions.length > 0) {
      localStorage.setItem(`suggestions:${activeDocId}`, JSON.stringify(suggestions));
    } else {
      localStorage.removeItem(`suggestions:${activeDocId}`);
    }
  }, [suggestions, activeDocId]);

  // Parse sources from the last assistant message
  function getLastSources(): Source[] | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].sources) {
        try {
          return JSON.parse(messages[i].sources!);
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (pdfFile) {
      handleUpload(pdfFile);
    }
  }

  // Strip suggestions/follow-up tags from content for display
  function stripSuggestionsTag(content: string): string {
    return content
      // Complete tags: <suggestions>["..."]</suggestions>
      .replace(/\n?<(?:suggestions|follow_up_questions|follow-up-questions)>\s*\[[\s\S]*?\]\s*<\/(?:suggestions|follow_up_questions|follow-up-questions)>/g, "")
      .replace(/\n?<(?:suggestions|follow_up_questions|follow-up-questions)>[\s\S]*?<\/(?:suggestions|follow_up_questions|follow-up-questions)>/g, "")
      // Truncated closing tag: <suggestions>["..."]</uggestion (missing s)
      .replace(/\n?<(?:suggestions|follow_up_questions|follow-up-questions)>\s*\[[\s\S]*?\]\s*<\/[a-z_-]*/g, "")
      // No closing tag: <suggestions>["...", "..."]  (end of message)
      .replace(/\n?<(?:suggestions|follow_up_questions|follow-up-questions)>\s*\[[\s\S]*$/, "")
      .trim();
  }

  // Core send-message logic
  async function doSendMessage(text: string) {
    const state = useChatStore.getState();
    if (!text.trim() || (!state.activeDocId && activeDocIds.length === 0) || state.isLoading) return;

    // Force scroll to bottom when user sends a message
    isNearBottomRef.current = true;

    setSelectedSource(null);
    setSuggestions([]);

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: "user",
      content: text, // Store original text (without prefix) for display
      createdAt: new Date(),
    };
    addMessage(userMsg);

    const assistantMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };
    addMessage(assistantMsg);
    setLoading(true);

    // Track which doc this stream belongs to
    const streamDocId = state.activeDocId;
    streamDocIdRef.current = streamDocId;
    streamBufferRef.current = "";
    streamSourcesRef.current = undefined;
    streamUsageRef.current = undefined;

    try {
      // Multi-PDF search: search across all active doc IDs
      let chunks: StoredChunk[] = [];
      const docIdsToSearch =
        activeDocIds.length > 0
          ? activeDocIds
          : state.activeDocId
            ? [state.activeDocId]
            : [];

      if (docIdsToSearch.length > 0) {
        // Search each doc and combine results
        const searchPromises = docIdsToSearch.map((docId: string) =>
          searchChunks(text, { docId, limit: 5 })
        );
        const resultsPerDoc = await Promise.all(searchPromises);
        chunks = resultsPerDoc.flat();

        // Sort by relevance and limit
        chunks = rankChunks(chunks, text).slice(0, 8);
      }

      // Fallback: first chunks if no keyword matches
      if (chunks.length === 0) {
        for (const dId of docIdsToSearch) {
          const allChunks = await getDocChunks(dId);
          chunks.push(...allChunks.slice(0, 3));
        }
        chunks = chunks.slice(0, 5);
      }

      const context = chunks.map((r) => ({
        docName: r.docName,
        chunkIndex: r.chunkIndex,
        text: r.text,
        page: r.page,
        section: r.section,
      }));

      const currentMessages = useChatStore.getState().messages;
      const history = currentMessages
        .slice(0, -2)
        .slice(-10)
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 min

      // Include BYOK overrides if set
      const llm = useChatStore.getState().llmSettings;
      const llmOverrides: Record<string, string> = {};
      if (llm.baseUrl) llmOverrides.baseUrl = llm.baseUrl;
      if (llm.apiKey) llmOverrides.apiKey = llm.apiKey;
      if (llm.model) llmOverrides.model = llm.model;

      let res: Response;
      const MAX_RETRIES = 2;
      let retryCount = 0;
      const fetchWithRetry = async (): Promise<Response> => {
        try {
          return await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            context,
            history,
            ...llmOverrides,
          }),
            signal: controller.signal,
          });
        } catch (fetchErr) {
          if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
            throw new Error("Request timed out. The AI took too long to respond.");
          }
          // Network error — retry
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            await new Promise(r => setTimeout(r, 1000 * retryCount));
            return fetchWithRetry();
          }
          throw new Error(
            "Network error. Check your connection and try again."
          );
        }
      };
      res = await fetchWithRetry();
      clearTimeout(timeout);

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const msg = errorData?.error || `Server error (${res.status})`;
        throw new Error(msg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        let readResult;
        try {
          // If tab is hidden, wait for it to become visible before reading
          if (document.hidden) {
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                document.removeEventListener("visibilitychange", onVisible);
                resolve(); // Timeout — proceed with read attempt
              }, 30000); // 30s max wait
              const onVisible = () => {
                if (!document.hidden) {
                  clearTimeout(timeout);
                  document.removeEventListener("visibilitychange", onVisible);
                  resolve();
                }
              };
              document.addEventListener("visibilitychange", onVisible);
              // Already visible guard
              if (!document.hidden) {
                clearTimeout(timeout);
                document.removeEventListener("visibilitychange", onVisible);
                resolve();
              }
            });
          }
          readResult = await reader.read();
        } catch (readErr) {
          // Stream interrupted (tab switch, network drop)
          // If tab is hidden, wait for visibility before giving up
          if (document.hidden) {
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                document.removeEventListener("visibilitychange", onVisible);
                resolve();
              }, 30000);
              const onVisible = () => {
                if (!document.hidden) {
                  clearTimeout(timeout);
                  document.removeEventListener("visibilitychange", onVisible);
                  resolve();
                }
              };
              document.addEventListener("visibilitychange", onVisible);
            });
            // Try reading again after becoming visible
            try {
              readResult = await reader.read();
            } catch {
              // Still failing — fall through to error handling
            }
          }

          if (!readResult) {
            // Process remaining buffer before giving up
            if (buffer.trim()) {
              const remaining = buffer.split("\n");
              for (const line of remaining) {
                if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
                  try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.type === "content" && parsed.content) {
                      appendToMessage(assistantMsg.id, parsed.content);
                      streamBufferRef.current += parsed.content;
                    }
                  } catch { /* ignore */ }
                }
              }
            }
            // If we have content, treat as partial completion
            const currentState = useChatStore.getState();
            const lastMsg = currentState.messages[currentState.messages.length - 1];
            if (lastMsg?.content?.length > 10 || streamBufferRef.current.length > 10) {
              break;
            }
            throw new Error("Connection interrupted. Please try again.");
          }
        }
        const { done, value } = readResult;
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content" && parsed.content) {
                // Append to message by ID (works even if viewing different doc)
                appendToMessage(assistantMsg.id, parsed.content);
                // Also buffer for background save
                streamBufferRef.current += parsed.content;
              }
              if (parsed.type === "sources" && parsed.sources) {
                const sourcesStr = JSON.stringify(parsed.sources);
                streamSourcesRef.current = sourcesStr;
                // Update if viewing the same doc
                if (useChatStore.getState().activeDocId === streamDocId) {
                  const store = useChatStore.getState();
                  const msgs = [...store.messages];
                  if (msgs.length > 0) {
                    msgs[msgs.length - 1] = {
                      ...msgs[msgs.length - 1],
                      sources: sourcesStr,
                    };
                    useChatStore.setState({ messages: msgs });
                  }
                }
              }
              if (parsed.type === "usage" && parsed.usage) {
                streamUsageRef.current = parsed.usage;
                // Update if viewing the same doc
                if (useChatStore.getState().activeDocId === streamDocId) {
                  const store = useChatStore.getState();
                  const msgs = [...store.messages];
                  if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
                    msgs[msgs.length - 1] = {
                      ...msgs[msgs.length - 1],
                      tokenUsage: parsed.usage,
                    };
                    useChatStore.setState({ messages: msgs });
                  }
                }
              }
              if (parsed.type === "suggestions" && parsed.suggestions) {
                // Save suggestions for background save
                streamSuggestionsRef.current = parsed.suggestions;
                // Only set suggestions if still viewing the same doc
                if (useChatStore.getState().activeDocId === streamDocId) {
                  setSuggestions(parsed.suggestions);
                }

                // Strip <suggestions> tag from the last assistant message content
                const store = useChatStore.getState();
                const msgs = [...store.messages];
                if (msgs.length > 0) {
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg.role === "assistant") {
                    const cleaned = stripSuggestionsTag(lastMsg.content);
                    if (cleaned !== lastMsg.content) {
                      msgs[msgs.length - 1] = { ...lastMsg, content: cleaned };
                      useChatStore.setState({ messages: msgs });
                    }
                  }
                }
              }
            } catch {
              appendToMessage(assistantMsg.id, data);
              streamBufferRef.current += data;
            }
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      const isNetworkError = errorMsg.toLowerCase().includes("network") || 
                             errorMsg.toLowerCase().includes("connection") ||
                             errorMsg.toLowerCase().includes("interrupted");
      // Replace empty assistant message with error + retry hint
      const store = useChatStore.getState();
      const msgs = [...store.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        const lastMsg = msgs[msgs.length - 1];
        const retryHint = isNetworkError ? "\n\n_Tap the retry button or send the message again._" : "";
        if (!lastMsg.content) {
          // Empty response — replace with error
          msgs[msgs.length - 1] = {
            ...lastMsg,
            content: `*Error: ${errorMsg}*${retryHint}`,
          };
          useChatStore.setState({ messages: msgs });
        } else {
          // Partial response — append error (user keeps what was received)
          appendToMessage(assistantMsg.id, `\n\n*Error: ${errorMsg}*${retryHint}`);
        }
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);

      // Save stream results
      const currentActiveDocId = useChatStore.getState().activeDocId;
      const isBackgroundStream = streamDocId && streamDocId !== currentActiveDocId;

      if (isBackgroundStream && streamBufferRef.current) {
        // Background stream: save directly to IndexedDB for the streaming doc
        try {
          const existingMessages = await loadChatMessages(streamDocId!);
          const bgAssistantMsg: ChatMessage = {
            id: assistantMsg.id,
            role: "assistant",
            content: streamBufferRef.current,
            sources: streamSourcesRef.current,
            tokenUsage: streamUsageRef.current,
            createdAt: new Date(),
          };
          // Add user + assistant messages
          const updatedMessages = [
            ...existingMessages,
            { id: userMsg.id, role: "user" as const, content: userMsg.content, createdAt: userMsg.createdAt },
            bgAssistantMsg,
          ];
          await saveChatMessages(streamDocId!, updatedMessages);

          // Save suggestions for the background doc
          if (streamSuggestionsRef.current && streamSuggestionsRef.current.length > 0) {
            localStorage.setItem(`suggestions:${streamDocId}`, JSON.stringify(streamSuggestionsRef.current));
          }
        } catch (err) {
          console.error("Failed to save background stream:", err);
        }
      } else {
        // Normal stream: save current chat (includes the streamed content)
        try {
          await useChatStore.getState().saveCurrentChat();
        } catch {
          // Silent fail
        }
      }

      // Clear streaming refs
      streamDocIdRef.current = null;
      streamBufferRef.current = "";
      streamSourcesRef.current = undefined;
      streamUsageRef.current = undefined;
      streamSuggestionsRef.current = undefined;
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const { pages, numPages } = await parsePDFFile(file);
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

      await setActiveDoc(docId, file.name);
      window.dispatchEvent(new CustomEvent("documents-refresh"));

      // Show success indicator briefly
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to process PDF";
      setUploadError(msg);
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || (!activeDocId && activeDocIds.length === 0) || isLoading) return;
    setInput("");
    doSendMessage(trimmed);
  }

  function handleSuggestionClick(suggestion: string) {
    setInput("");
    doSendMessage(suggestion);
  }

  function handleKeyQuotes() {
    const quotePrompt =
      "Extract the most important direct quotes and citations from this document. Format as a numbered list with the exact quote and page/section reference.";
    doSendMessage(quotePrompt);
  }

  function handleSummarize() {
    const summarizePrompt =
      "Provide a comprehensive summary of this document. Include the main points, key findings, and conclusions. Format with headings and bullet points.";
    doSendMessage(summarizePrompt);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const sources = getLastSources();
  const lastMsg = messages[messages.length - 1];
  const showLoadingInBubble =
    isLoading && lastMsg?.role === "assistant" && lastMsg?.content === "";

  // Determine active doc IDs for search (fallback to single activeDocId)
  const effectiveDocIds =
    activeDocIds.length > 0
      ? activeDocIds
      : activeDocId
        ? [activeDocId]
        : [];

  // Empty state — no document selected
  if (!activeDocId) {
    return (
      <div
        className="flex flex-1 flex-col bg-[#f5f4ed] relative"
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
        </div>

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
                if (file) handleUpload(file);
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

  return (
    <div className="flex flex-1 flex-row bg-[#f5f4ed] relative">

      {/* Chat panel */}
      <div
        className={cn(
          "flex flex-1 flex-col relative",
          "w-full"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay with scale-in animation */}
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
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-[#8a8a82] hover:bg-[#f5f4ed] hover:text-[#2a2a28]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="truncate flex-1 text-sm font-medium text-[#1B365D]">
            {activeDocName || "Chat"}
          </h2>

        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between border-b border-[#e0ded6] bg-[#faf9f3] px-6 py-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-[#1B365D] truncate max-w-md">
              {activeDocName || "Chat"}
            </h2>
            {effectiveDocIds.length > 1 && (
              <span className="rounded-full bg-[#1B365D]/10 px-2 py-0.5 text-xs text-[#1B365D]">
                {effectiveDocIds.length} docs
              </span>
            )}
          </div>
        </div>

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
                    onSourceClick={setSelectedSource}
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
                            onClick={() => handleSuggestionClick(suggestion)}
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
                      onClick={async () => {
                        // Remove the error message and re-send
                        const retryText = secondLast.content;
                        const msgs = messages.slice(0, -2);
                        useChatStore.setState({ messages: msgs });
                        await doSendMessage(retryText);
                      }}
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
              onClick={handleSummarize}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-full border border-[#e0ded6] bg-[#faf9f3] px-3 py-1 text-xs text-[#8a8a82] hover:border-[#1B365D]/30 hover:text-[#1B365D] transition-colors disabled:opacity-50"
            >
              <BookOpen className="h-3 w-3" />
              Summarize
            </button>
            <button
              onClick={handleKeyQuotes}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-full border border-[#e0ded6] bg-[#faf9f3] px-3 py-1 text-xs text-[#8a8a82] hover:border-[#1B365D]/30 hover:text-[#1B365D] transition-colors disabled:opacity-50"
            >
              <Quote className="h-3 w-3" />
              Key Quotes
            </button>
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
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className={cn(
                "h-11 w-11 shrink-0 bg-[#1B365D] text-white hover:bg-[#1B365D]/90 transition-all",
                input.trim() && !isLoading && "animate-send-pulse"
              )}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
