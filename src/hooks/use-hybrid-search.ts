"use client";

import * as React from "react";
import type { StoredChunk } from "@/lib/client/storage";
import {
  searchChunks,
  getDocChunks,
  getChunksWithEmbeddings,
  saveChunkEmbeddings,
  bm25ScoreMap,
} from "@/lib/client/storage";
import { hybridSearch } from "@/lib/search/hybrid-search";
import { getEmbedding } from "@/lib/search/embeddings";

/**
 * Hook that provides hybrid search (BM25 + semantic) with progressive enhancement.
 *
 * - On first search for a doc, falls back to pure BM25 (existing behavior).
 * - In the background, computes and caches embeddings for the doc's chunks.
 * - On subsequent searches, uses hybrid BM25+semantic ranking if embeddings are ready.
 * - Embeddings are stored in IndexedDB so they persist across sessions.
 */
export function useHybridSearch() {
  // Track which docs have embeddings ready (in-memory cache)
  const [embeddingReadyDocs, setEmbeddingReadyDocs] = React.useState<Set<string>>(new Set());
  // Track which docs are currently computing embeddings
  const [computingDocs, setComputingDocs] = React.useState<Set<string>>(new Set());
  // Track which docs we've already checked for existing embeddings
  const checkedDocsRef = React.useRef<Set<string>>(new Set());

  /**
   * Check if a doc already has embeddings stored, and if not, start computing them.
   * This is non-blocking — search proceeds with BM25 immediately.
   */
  const ensureEmbeddings = React.useCallback(
    async (docId: string) => {
      if (checkedDocsRef.current.has(docId)) return;
      checkedDocsRef.current.add(docId);

      try {
        const existing = await getChunksWithEmbeddings(docId);
        if (existing.length > 0) {
          // Embeddings already cached
          setEmbeddingReadyDocs((prev) => new Set(prev).add(docId));
          return;
        }
      } catch {
        // Ignore — we'll compute fresh
      }

      // No embeddings yet — compute in background
      setComputingDocs((prev) => new Set(prev).add(docId));

      try {
        const chunks = await getDocChunks(docId);
        if (chunks.length === 0) return;

        // Compute embeddings one by one (model is cached after first load)
        const embeddings = new Map<string, number[]>();
        for (const chunk of chunks) {
          try {
            const emb = await getEmbedding(chunk.text);
            embeddings.set(chunk.id, emb);
          } catch {
            // Skip failed chunks
          }
        }

        if (embeddings.size > 0) {
          await saveChunkEmbeddings(docId, embeddings);
          setEmbeddingReadyDocs((prev) => new Set(prev).add(docId));
        }
      } catch (err) {
        console.warn("Failed to compute embeddings for doc:", docId, err);
      } finally {
        setComputingDocs((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
      }
    },
    []
  );

  /**
   * Search for chunks matching the query.
   * Uses hybrid BM25+semantic search if embeddings are available,
   * falls back to pure BM25 otherwise.
   */
  const search = React.useCallback(
    async (
      query: string,
      options: {
        docId?: string;
        docIds?: string[];
        limit?: number;
        bm25Weight?: number;
        semanticWeight?: number;
      } = {}
    ): Promise<StoredChunk[]> => {
      const { docId, docIds, limit = 5, bm25Weight, semanticWeight } = options;
      const effectiveDocIds = docIds ?? (docId ? [docId] : []);

      // Kick off embedding computation in background (non-blocking)
      for (const id of effectiveDocIds) {
        ensureEmbeddings(id);
      }

      // Always get BM25 results first (fast, existing behavior)
      const bm25Chunks = await searchChunks(query, { docId, docIds, limit: limit * 3 });

      // Check if any of the searched docs have embeddings ready
      const hasEmbeddings = effectiveDocIds.some((id) => embeddingReadyDocs.has(id));

      if (!hasEmbeddings || bm25Chunks.length === 0) {
        // Pure BM25 fallback
        return bm25Chunks.slice(0, limit);
      }

      // Hybrid search: combine BM25 scores with semantic similarity
      try {
        // Get all chunks for the doc(s) to compute BM25 scores over
        let allChunks: StoredChunk[] = [];
        for (const id of effectiveDocIds) {
          if (embeddingReadyDocs.has(id)) {
            const chunks = await getDocChunks(id);
            allChunks = allChunks.concat(chunks);
          }
        }

        if (allChunks.length === 0) return bm25Chunks.slice(0, limit);

        // Compute BM25 scores for all chunks
        const scores = bm25ScoreMap(allChunks, query);

        // Compute query embedding
        const queryEmb = await getEmbedding(query);

        // Run hybrid search
        const results = hybridSearch(allChunks, queryEmb, scores, {
          bm25Weight,
          semanticWeight,
          maxResults: limit,
        });

        return results.map((r) => r.chunk);
      } catch (err) {
        console.warn("Hybrid search failed, falling back to BM25:", err);
        return bm25Chunks.slice(0, limit);
      }
    },
    [embeddingReadyDocs, ensureEmbeddings]
  );

  return {
    search,
    isComputingEmbeddings: (docId: string) => computingDocs.has(docId),
    hasEmbeddings: (docId: string) => embeddingReadyDocs.has(docId),
  };
}
