"use client";

import * as React from "react";
import type { StoredChunk } from "@/lib/client/storage";
import {
  searchChunks,
  getDocChunks,
  bm25ScoreMap,
} from "@/lib/client/storage";
import { hybridSearch } from "@/lib/search/hybrid-search";
import { getEmbedding } from "@/lib/search/embeddings";
import { ensureDocEmbeddings, hasEmbeddings, embeddingsInFlight } from "@/lib/search/embedding-cache";

/**
 * Hook that provides hybrid search (BM25 + semantic) with progressive enhancement.
 *
 * - If embeddings are not ready yet, a BM25-only result is returned immediately
 *   while `ensureDocEmbeddings` computes them in the background.
 * - When the background pass is still running at query time (e.g. first search
 *   right after upload), the search awaits it so the very first query is hybrid.
 */
export function useHybridSearch() {
  // Re-render trigger for callers that poll hasEmbeddings()/isComputingEmbeddings()
  const [, force] = React.useState(0);
  const bump = React.useCallback(() => force((n) => n + 1), []);

  /**
   * Search for chunks matching the query.
   * Uses hybrid BM25+semantic when embeddings are available,
   * falls back to pure BM25 otherwise (and kicks off embedding computation).
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

      // Make sure embeddings exist / are being computed (shared with warm-up)
      for (const id of effectiveDocIds) void ensureDocEmbeddings(id);

      const anyReady = effectiveDocIds.some(hasEmbeddings);
      const anyInFlight = effectiveDocIds.some(embeddingsInFlight);

      // Always get BM25 results first (fast path)
      const [bm25Chunks] = await Promise.all([
        searchChunks(query, { docId, docIds, limit: limit * 3 }),
        // First query right after upload: wait for the in-flight warm-up so it
        // runs hybrid instead of degrading to pure BM25. Bounded by the same
        // work — if embedding computation fails we fall back below anyway.
        anyInFlight && !anyReady
          ? Promise.all(effectiveDocIds.map((id) => ensureDocEmbeddings(id))).then(() => undefined)
          : Promise.resolve(),
      ]);

      if (!effectiveDocIds.some(hasEmbeddings) || bm25Chunks.length === 0) {
        return bm25Chunks.slice(0, limit);
      }

      // Hybrid: combine BM25 scores with semantic similarity
      try {
        let allChunks: StoredChunk[] = [];
        for (const id of effectiveDocIds) {
          if (hasEmbeddings(id)) {
            allChunks = allChunks.concat(await getDocChunks(id));
          }
        }
        if (allChunks.length === 0) return bm25Chunks.slice(0, limit);

        const scores = bm25ScoreMap(allChunks, query);
        const queryEmb = await getEmbedding(query);

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
    []
  );

  return {
    search,
    isComputingEmbeddings: (docId: string) => embeddingsInFlight(docId),
    hasEmbeddings: (docId: string) => hasEmbeddings(docId),
  };
}
