"use client";

const DB_NAME = "paperlens";
const DB_VERSION = 4;

export interface StoredDocument {
  id: string;
  name: string;
  numPages: number;
  numChunks: number;
  createdAt: number;
}

export interface StoredChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  page?: number;
  section?: string;
}

export interface StoredChatMessage {
  id: string;
  docId: string;
  role: "user" | "assistant";
  content: string;
  sources?: string;
  tokenUsage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  createdAt: number;
  order?: number;
}

let _dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbInstance) return Promise.resolve(_dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("chunks")) {
        const store = db.createObjectStore("chunks", { keyPath: "id" });
        store.createIndex("docId", "docId", { unique: false });
      }

      if (!db.objectStoreNames.contains("chats")) {
        const chatStore = db.createObjectStore("chats", { keyPath: "id" });
        chatStore.createIndex("docId", "docId", { unique: false });
      }
    };

    req.onsuccess = () => {
      _dbInstance = req.result;
      // Clean up on page unload
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => {
          _dbInstance?.close();
          _dbInstance = null;
        }, { once: true });
      }
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---- Documents ----

export async function saveDocument(doc: StoredDocument): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readwrite");
    tx.objectStore("documents").put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readonly");
    const req = tx.objectStore("documents").getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocument(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["documents", "chunks", "chats"], "readwrite");
    tx.objectStore("documents").delete(docId);

    // Delete chunks for this doc
    const chunkStore = tx.objectStore("chunks");
    const chunkIdx = chunkStore.index("docId");
    const chunkReq = chunkIdx.openCursor(IDBKeyRange.only(docId));
    chunkReq.onsuccess = () => {
      const cursor = chunkReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Delete chat history for this doc
    const chatStore = tx.objectStore("chats");
    const chatIdx = chatStore.index("docId");
    const chatReq = chatIdx.openCursor(IDBKeyRange.only(docId));
    chatReq.onsuccess = () => {
      const cursor = chatReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };


    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Chunks ----

export async function saveChunks(chunks: StoredChunk[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readwrite");
    const store = tx.objectStore("chunks");
    for (const chunk of chunks) {
      store.put(chunk);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function searchChunks(
  query: string,
  opts: { docId?: string; docIds?: string[]; limit?: number } = {}
): Promise<StoredChunk[]> {
  const db = await openDB();
  const limit = opts.limit ?? 5;
  const docIdSet = opts.docIds && opts.docIds.length > 0
    ? new Set(opts.docIds)
    : opts.docId
      ? new Set([opts.docId])
      : null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readonly");
    const store = tx.objectStore("chunks");

    const chunks: StoredChunk[] = [];

    // Split query into keywords for flexible matching
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const processChunk = (chunk: StoredChunk) => {
      if (docIdSet && !docIdSet.has(chunk.docId)) return;
      const textLower = chunk.text.toLowerCase();
      // Match if any keyword is present (not the full query)
      if (keywords.some((kw) => textLower.includes(kw))) {
        chunks.push(chunk);
      }
    };

    let resolved = false;
    const resolveWithRanked = () => {
      if (resolved) return;
      resolved = true;
      resolve(rankChunks(chunks, query).slice(0, limit));
    };

    if (docIdSet && docIdSet.size === 1) {
      const singleDocId = docIdSet.values().next().value!;
      const idx = store.index("docId");
      const req = idx.openCursor(IDBKeyRange.only(singleDocId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && chunks.length < limit * 3) {
          processChunk(cursor.value);
          cursor.continue();
        } else {
          resolveWithRanked();
        }
      };
      req.onerror = () => reject(req.error);
    } else {
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && chunks.length < limit * 5) {
          processChunk(cursor.value);
          cursor.continue();
        } else {
          resolveWithRanked();
        }
      };
      req.onerror = () => reject(req.error);
    }

    // Safety: resolve on transaction complete if cursor didn't
    tx.oncomplete = () => {
      // Only resolve if we haven't already (cursor may have already resolved)
      resolveWithRanked();
    };
  });
}

export function rankChunks(chunks: StoredChunk[], query: string): StoredChunk[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return chunks;

  return chunks
    .map((chunk) => {
      const lower = chunk.text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        score += lower.split(term).length - 1;
      }
      return { chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.chunk);
}

export async function getDocChunks(docId: string): Promise<StoredChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readonly");
    const idx = tx.objectStore("chunks").index("docId");
    const req = idx.getAll(IDBKeyRange.only(docId));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- Chat History ----

export async function saveChatMessages(
  docId: string,
  messages: { id: string; role: "user" | "assistant"; content: string; sources?: string; tokenUsage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; createdAt?: Date | number }[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    // Single transaction: delete old + save new
    const tx = db.transaction("chats", "readwrite");
    const store = tx.objectStore("chats");
    const idx = store.index("docId");

    // Delete existing messages for this doc
    const clearReq = idx.openCursor(IDBKeyRange.only(docId));
    clearReq.onsuccess = () => {
      const cursor = clearReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // All old messages deleted, now save new ones with order index
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          store.put({
            id: msg.id,
            docId,
            role: msg.role,
            content: msg.content,
            sources: msg.sources,
            tokenUsage: msg.tokenUsage,
            createdAt: msg.createdAt instanceof Date ? msg.createdAt.getTime() : (msg.createdAt || Date.now()),
            order: i,
          });
        }
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadChatMessages(
  docId: string
): Promise<{ id: string; role: "user" | "assistant"; content: string; sources?: string; tokenUsage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; createdAt: Date }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chats", "readonly");
    const idx = tx.objectStore("chats").index("docId");
    const req = idx.getAll(IDBKeyRange.only(docId));
    req.onsuccess = () => {
      const results = req.result
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((r: StoredChatMessage) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          sources: r.sources,
          tokenUsage: r.tokenUsage,
          createdAt: new Date(r.createdAt),
        }));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearChatMessages(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chats", "readwrite");
    const idx = tx.objectStore("chats").index("docId");
    const req = idx.openCursor(IDBKeyRange.only(docId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


