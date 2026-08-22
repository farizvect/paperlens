"use client";

import type { StoredChunk } from "@/lib/client/storage";
import {
  getDocChunks,
  getChunksWithEmbeddings,
  saveChunkEmbeddings,
} from "@/lib/client/storage";
import { getEmbedding } from "@/lib/search/embeddings";

// Module-level readiness + in-flight registries so the upload warm-up and the
// search hook share one computation per doc (no duplicate model inference).
const readyDocs = new Set<string>();
const inflight = new Map<string, Promise<boolean>>();

/** True once embeddings are known to be available for this doc (this session). */
export function hasEmbeddings(docId: string): boolean {
  return readyDocs.has(docId);
}

/** True while an ensure pass for this doc is currently running. */
export function embeddingsInFlight(docId: string): boolean {
  return inflight.has(docId);
}

/**
 * Ensure every chunk of a doc has a persisted embedding: compute and save any
 * that are missing. Concurrent callers share a single in-flight promise, so
 * calling this from both the post-upload warm-up and the search hook is cheap.
 *
 * Resolves true when embeddings are available for the doc, false when the doc
 * has no chunks or nothing could be embedded. Never throws.
 */
export function ensureDocEmbeddings(docId: string): Promise<boolean> {
  const existing = inflight.get(docId);
  if (existing) return existing;

  const task = (async () => {
    try {
      const cached = await getChunksWithEmbeddings(docId);
      if (cached.length > 0) {
        readyDocs.add(docId);
        return true;
      }

      const chunks: StoredChunk[] = await getDocChunks(docId);
      if (chunks.length === 0) return false;

      const embeddings = new Map<string, number[]>();
      for (const chunk of chunks) {
        try {
          embeddings.set(chunk.id, await getEmbedding(chunk.text));
        } catch {
          // Skip failed chunks — hybrid still works with partial coverage
          // because chunks without embeddings score 0 on the semantic axis.
        }
      }

      if (embeddings.size === 0) return false;
      await saveChunkEmbeddings(docId, embeddings);
      readyDocs.add(docId);
      return true;
    } catch {
      return false;
    } finally {
      inflight.delete(docId);
    }
  })();

  inflight.set(docId, task);
  return task;
}
