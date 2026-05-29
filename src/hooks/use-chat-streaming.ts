"use client";

import * as React from "react";
import { useChatStore, type ChatMessage, type TokenUsage } from "@/store/chat";
import {
  searchChunks,
  getDocChunks,
  rankChunks,
  saveChatMessages,
  loadChatMessages,
  type StoredChunk,
} from "@/lib/client/storage";

// Strip suggestions/follow-up tags from content for display
export function stripSuggestionsTag(content: string): string {
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

interface UseChatStreamingParams {
  addMessage: (msg: ChatMessage) => void;
  appendToMessage: (messageId: string, content: string) => void;
  setLoading: (loading: boolean) => void;
  activeDocIds: string[];
  setSelectedSource: (source: null) => void;
  setSuggestions: (suggestions: string[]) => void;
  isNearBottomRef: React.MutableRefObject<boolean>;
}

/**
 * Manages the chat streaming lifecycle:
 * - Sends messages with RAG context to /api/chat
 * - Handles SSE streaming, retries, visibility-aware reads
 * - Processes sources, usage, and suggestions events
 * - Saves background streams when user switches documents
 */
export function useChatStreaming({
  addMessage,
  appendToMessage,
  setLoading,
  activeDocIds,
  setSelectedSource,
  setSuggestions,
  isNearBottomRef,
}: UseChatStreamingParams) {
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const streamDocIdRef = React.useRef<string | null>(null);
  const streamBufferRef = React.useRef<string>("");
  const streamSourcesRef = React.useRef<string | undefined>(undefined);
  const streamUsageRef = React.useRef<TokenUsage | undefined>(undefined);
  const streamSuggestionsRef = React.useRef<string[] | undefined>(undefined);

  const sendMessage = React.useCallback(async (text: string) => {
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
      const res = await fetchWithRetry();
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
        } catch {
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
  }, [addMessage, appendToMessage, setLoading, activeDocIds, setSelectedSource, setSuggestions, isNearBottomRef]);

  const isStreaming = abortControllerRef.current !== null;

  return { sendMessage, isStreaming };
}
