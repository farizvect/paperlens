import { create } from "zustand";
import { saveChatMessages, loadChatMessages, clearChatMessages, listDocuments } from "@/lib/client/storage";

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string;
  tokenUsage?: TokenUsage;
  createdAt: Date;
}

export interface LlmSettings {
  baseUrl: string;  // empty = use server default
  apiKey: string;   // empty = use server default
  model: string;    // empty = use server default
}

function loadLlmSettings(): LlmSettings {
  if (typeof window === "undefined") return { baseUrl: "", apiKey: "", model: "" };
  try {
    const raw = localStorage.getItem("llmSettings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { baseUrl: "", apiKey: "", model: "" };
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  activeDocId: string | null;
  activeDocName: string | null;
  activeDocIds: string[];
  keyQuotes: string[];
  followUpSuggestions: string[];
  sidebarOpen: boolean;
  llmSettings: LlmSettings;
  addMessage: (msg: ChatMessage) => void;
  appendToLast: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setActiveDoc: (docId: string | null, docName?: string) => void;
  setActiveDocIds: (ids: string[]) => void;
  toggleDocSelection: (id: string) => void;
  setKeyQuotes: (quotes: string[]) => void;
  setFollowUpSuggestions: (suggestions: string[]) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  clear: () => void;
  saveCurrentChat: () => Promise<void>;
  setLlmSettings: (settings: Partial<LlmSettings>) => void;
  hydrate: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  activeDocId: null,
  activeDocName: null,
  activeDocIds: [],
  keyQuotes: [],
  followUpSuggestions: [],
  sidebarOpen: false,
  llmSettings: { baseUrl: "", apiKey: "", model: "" },

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  appendToLast: (content) =>
    set((state) => {
      const msgs = [...state.messages];
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + content,
        };
      }
      return { messages: msgs };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setActiveDoc: async (activeDocId, docName?) => {
    const state = get();

    // Save current chat before switching
    if (state.activeDocId && state.messages.length > 0) {
      await saveChatMessages(
        state.activeDocId,
        state.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          tokenUsage: m.tokenUsage,
          createdAt: m.createdAt,
        }))
      );
    }

    // Load chat for new document
    let messages: ChatMessage[] = [];
    if (activeDocId) {
      try {
        const loaded = await loadChatMessages(activeDocId);
        messages = loaded.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          tokenUsage: m.tokenUsage,
          createdAt: m.createdAt,
        }));
      } catch {
        messages = [];
      }
    }

    // Sync activeDocIds with the single selection
    const activeDocIds = activeDocId ? [activeDocId] : [];

    set({
      activeDocId,
      activeDocName: docName ?? (activeDocId ? state.activeDocName : null),
      activeDocIds,
      messages,
      keyQuotes: [],
      followUpSuggestions: [],
      sidebarOpen: false,
    });

    // Persist to localStorage so refresh restores the same doc
    if (activeDocId) {
      localStorage.setItem("activeDocId", activeDocId);
      localStorage.setItem("activeDocName", docName ?? state.activeDocName ?? "");
      localStorage.setItem("activeDocIds", JSON.stringify(activeDocIds));
    } else {
      localStorage.removeItem("activeDocId");
      localStorage.removeItem("activeDocName");
      localStorage.removeItem("activeDocIds");
    }
  },

  setActiveDocIds: async (ids: string[]) => {
    const state = get();

    // Save current chat before switching
    if (state.activeDocId && state.messages.length > 0) {
      await saveChatMessages(
        state.activeDocId,
        state.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          tokenUsage: m.tokenUsage,
          createdAt: m.createdAt,
        }))
      );
    }

    // Load chat for the first selected doc (or combined key)
    const chatKey = ids.length === 1 ? ids[0] : ids.length > 1 ? ids.sort().join(",") : null;
    let messages: ChatMessage[] = [];
    if (chatKey) {
      try {
        const loaded = await loadChatMessages(chatKey);
        messages = loaded.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          tokenUsage: m.tokenUsage,
          createdAt: m.createdAt,
        }));
      } catch {
        messages = [];
      }
    }

    const activeDocId = ids.length === 1 ? ids[0] : chatKey;
    let activeDocName: string | null;
    if (ids.length === 1) {
      // Look up actual doc name from IndexedDB
      try {
        const docs = await listDocuments();
        const doc = docs.find((d) => d.id === ids[0]);
        activeDocName = doc?.name ?? state.activeDocName;
      } catch {
        activeDocName = state.activeDocName;
      }
    } else if (ids.length > 1) {
      activeDocName = `${ids.length} documents`;
    } else {
      activeDocName = null;
    }

    set({
      activeDocIds: ids,
      activeDocId,
      activeDocName,
      messages,
      keyQuotes: [],
      followUpSuggestions: [],
    });

    localStorage.setItem("activeDocIds", JSON.stringify(ids));
    if (activeDocId) {
      localStorage.setItem("activeDocId", activeDocId);
    } else {
      localStorage.removeItem("activeDocId");
    }
  },

  toggleDocSelection: (id: string) => {
    const state = get();
    const current = state.activeDocIds;
    const next = current.includes(id)
      ? current.filter((d) => d !== id)
      : [...current, id];

    // Use setActiveDocIds for the persistence logic
    get().setActiveDocIds(next);
  },

  setKeyQuotes: (quotes: string[]) => set({ keyQuotes: quotes }),
  setFollowUpSuggestions: (suggestions: string[]) => set({ followUpSuggestions: suggestions }),

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setLlmSettings: (partial) => {
    const current = get().llmSettings;
    const updated = { ...current, ...partial };
    set({ llmSettings: updated });
    localStorage.setItem("llmSettings", JSON.stringify(updated));
  },

  hydrate: () => {
    if (typeof window === "undefined") return;
    const docId = localStorage.getItem("activeDocId");
    const docName = localStorage.getItem("activeDocName");
    const settings = loadLlmSettings();

    let activeDocIds: string[] = [];
    try {
      const raw = localStorage.getItem("activeDocIds");
      if (raw) activeDocIds = JSON.parse(raw);
    } catch {}

    set({
      activeDocId: docId,
      activeDocName: docName,
      activeDocIds,
      llmSettings: settings,
    });
  },

  clear: async () => {
    const state = get();
    if (state.activeDocId) {
      await clearChatMessages(state.activeDocId);
    }
    set({ messages: [], isLoading: false, keyQuotes: [], followUpSuggestions: [] });
  },

  saveCurrentChat: async () => {
    const state = get();
    if (state.activeDocId && state.messages.length > 0) {
      await saveChatMessages(
        state.activeDocId,
        state.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources,
          tokenUsage: m.tokenUsage,
          createdAt: m.createdAt,
        }))
      );
    }
  },
}));
