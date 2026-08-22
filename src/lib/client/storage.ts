"use client";

const DB_NAME = "paperlens";
const DB_VERSION = 5;

export interface StoredDocument {
  id: string;
  name: string;
  numPages: number;
  numChunks: number;
  createdAt: number;
}

export interface StoredChunkHighlightRange {
  page: number;
  start: number;
  end: number;
}

export interface StoredChunk {
  id: string;
  docId: string;
  docName: string;
  chunkIndex: number;
  text: string;
  page?: number;
  section?: string;
  embedding?: number[];
  highlightRange?: StoredChunkHighlightRange;
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

      if (!db.objectStoreNames.contains("pdfblobs")) {
        db.createObjectStore("pdfblobs", { keyPath: "docId" });
      }
    };

    req.onsuccess = () => {
      _dbInstance = req.result;
      // NOTE: we intentionally do NOT close the DB on beforeunload.
      // Closing it races against the async chat save that also fires on
      // beforeunload, which can lose the last messages. Browsers close
      // IndexedDB connections automatically on page unload anyway.
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

    // Tokenize query for BM25 + fuzzy matching
    const queryTerms = tokenize(query);
    const trigrams = buildTrigrams(query.toLowerCase());

    // Candidate cap is a generous constant (not limit-scaled): ranking bias
    // from insertion-order early-stop disappears for normal libraries, while
    // pathological stores stay bounded.
    const MAX_CANDIDATES = 500;

    const processChunk = (chunk: StoredChunk) => {
      if (docIdSet && !docIdSet.has(chunk.docId)) return;
      const textLower = chunk.text.toLowerCase();

      // Match if: any query term appears (whole token) OR enough trigrams match
      const hasKeywordMatch = queryTerms.some((t) => textLower.includes(t));
      let trigramHits = 0;
      for (const tri of trigrams) {
        if (textLower.includes(tri)) trigramHits++;
      }
      // Require 2+ trigram hits (or a high ratio) so common trigrams don't
      // flood the candidate pool with irrelevant chunks.
      const trigramRatio = trigrams.length > 0 ? trigramHits / trigrams.length : 0;
      const hasTrigramMatch = trigramHits >= 2 && trigramRatio >= 0.34;

      if (hasKeywordMatch || hasTrigramMatch) {
        chunks.push(chunk);
      }
    };

    let resolved = false;
    const resolveWithRanked = () => {
      if (resolved) return;
      resolved = true;
      resolve(bm25Rank(chunks, query).slice(0, limit));
    };

    if (docIdSet && docIdSet.size === 1) {
      const singleDocId = docIdSet.values().next().value!;
      const idx = store.index("docId");
      const req = idx.openCursor(IDBKeyRange.only(singleDocId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && chunks.length < MAX_CANDIDATES) {
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
        if (cursor && chunks.length < MAX_CANDIDATES) {
          processChunk(cursor.value);
          cursor.continue();
        } else {
          resolveWithRanked();
        }
      };
      req.onerror = () => reject(req.error);
    }

    tx.oncomplete = () => {
      resolveWithRanked();
    };
  });
}

// ---- Search helpers: BM25 + Trigram fuzzy matching ----

/** Tokenize text into lowercase terms, stripping punctuation and short words */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Build character trigrams from a string for fuzzy matching */
function buildTrigrams(text: string): string[] {
  const clean = text.replace(/[^\w]/g, "").toLowerCase();
  if (clean.length < 3) return [clean];
  const trigrams: string[] = [];
  for (let i = 0; i <= clean.length - 3; i++) {
    trigrams.push(clean.slice(i, i + 3));
  }
  return [...new Set(trigrams)];
}

/** Count whole-token occurrences of a term (no substring false hits like "model" in "modeling"). */
function countTokenMatches(textLower: string, term: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = textLower.indexOf(term, idx)) !== -1) {
    const before = idx === 0 ? " " : textLower[idx - 1];
    const afterIdx = idx + term.length;
    const after = afterIdx >= textLower.length ? " " : textLower[afterIdx];
    // Word-boundary check: the surrounding chars must not be word chars
    if (!/\w/.test(before) && !/\w/.test(after)) count++;
    idx = afterIdx;
  }
  return count;
}

/**
 * Core BM25 scorer shared by bm25Rank and bm25ScoreMap.
 * Standard parameters k1=1.5, b=0.75. Phrase/heading bonuses are applied
 * once per chunk (not compounded per term).
 */
function bm25Scores(chunks: StoredChunk[], query: string): Map<string, number> {
  const terms = tokenize(query);
  const scores = new Map<string, number>();
  if (terms.length === 0 || chunks.length === 0) return scores;

  const k1 = 1.5;
  const b = 0.75;

  const avgDl = chunks.reduce((sum, c) => sum + c.text.split(/\s+/).length, 0) / chunks.length;
  const N = chunks.length;
  const queryLower = query.toLowerCase();

  // Build IDF for each term (whole-token matching, consistent with TF below)
  const idf: Record<string, number> = {};
  for (const term of terms) {
    const docsWithTerm = chunks.filter((c) => countTokenMatches(c.text.toLowerCase(), term) > 0).length;
    idf[term] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
  }

  for (const chunk of chunks) {
    const textLower = chunk.text.toLowerCase();
    const dl = chunk.text.split(/\s+/).length;
    let score = 0;

    for (const term of terms) {
      const tf = countTokenMatches(textLower, term);
      if (tf === 0) continue;
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (dl / avgDl));
      score += idf[term] * (numerator / denominator);
    }

    // Applied once per chunk, not per term (previously compounded to tf^n)
    if (score > 0 && textLower.includes(queryLower)) {
      score *= 1.5; // exact phrase match
    }
    if (
      score > 0 &&
      terms.some((t) => textLower.slice(0, 200).includes(t))
    ) {
      score *= 1.15; // query term in heading/summary region
    }

    scores.set(chunk.id, score);
  }

  return scores;
}

/**
 * BM25 ranking — much better than raw term frequency.
 * Uses standard BM25 parameters: k1=1.5, b=0.75
 */
export function bm25Rank(chunks: StoredChunk[], query: string): StoredChunk[] {
  const scores = bm25Scores(chunks, query);
  return [...chunks]
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
}

// Keep legacy rankChunks as alias for backward compat
export function rankChunks(chunks: StoredChunk[], query: string): StoredChunk[] {
  return bm25Rank(chunks, query);
}

// ---- BM25 Score Map (for hybrid search) ----

/**
 * Return BM25 scores as a Map of chunk id -> raw score.
 * Unlike bm25Rank which returns sorted chunks, this preserves
 * the score map so hybrid search can combine with semantic scores.
 */
export function bm25ScoreMap(chunks: StoredChunk[], query: string): Map<string, number> {
  return bm25Scores(chunks, query);
}

// ---- Embedding Storage ----

/**
 * Save embeddings for existing chunks. Updates each chunk's `embedding` field in IndexedDB.
 */
export async function saveChunkEmbeddings(
  docId: string,
  embeddings: Map<string, number[]>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readwrite");
    const idx = tx.objectStore("chunks").index("docId");
    const req = idx.openCursor(IDBKeyRange.only(docId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const emb = embeddings.get(cursor.value.id);
        if (emb) {
          cursor.update({ ...cursor.value, embedding: emb });
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Check whether chunks for a document already have embeddings.
 * Returns the chunks that have embeddings, or empty array if none.
 */
export async function getChunksWithEmbeddings(docId: string): Promise<StoredChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("chunks", "readonly");
    const idx = tx.objectStore("chunks").index("docId");
    const req = idx.getAll(IDBKeyRange.only(docId));
    req.onsuccess = () => {
      const chunks = req.result as StoredChunk[];
      resolve(chunks.filter((c) => c.embedding && c.embedding.length > 0));
    };
    req.onerror = () => reject(req.error);
  });
}

// ---- PDF Blob Storage ----

export async function savePdfBlob(docId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfblobs", "readwrite");
    const store = tx.objectStore("pdfblobs");
    store.put({ docId, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPdfBlob(docId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfblobs", "readonly");
    const store = tx.objectStore("pdfblobs");
    const req = store.get(docId);
    req.onsuccess = () => resolve(req.result?.blob ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePdfBlob(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pdfblobs", "readwrite");
    const store = tx.objectStore("pdfblobs");
    store.delete(docId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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
        .sort((a: StoredChatMessage, b: StoredChatMessage) => (a.order ?? 0) - (b.order ?? 0))
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


