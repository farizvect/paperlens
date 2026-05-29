"use client";

import type { StoredChunk } from "@/lib/client/storage";
import { cosineSimilarity } from "@/lib/search/embeddings";

export interface ScoredChunk {
  chunk: StoredChunk;
  bm25Score: number;
  semanticScore: number;
  combinedScore: number;
}

/**
 * Combine BM25 keyword scores with semantic embedding similarity.
 *
 * Both score types are normalized to [0, 1] before weighting.
 * If a chunk has no embedding, its semantic score is 0 (graceful fallback).
 */
export function hybridSearch(
  chunks: StoredChunk[],
  queryEmbedding: number[],
  bm25Scores: Map<string, number>,
  options?: {
    bm25Weight?: number;
    semanticWeight?: number;
    maxResults?: number;
  }
): ScoredChunk[] {
  const bm25W = options?.bm25Weight ?? 0.6;
  const semW = options?.semanticWeight ?? 0.4;
  const limit = options?.maxResults ?? 5;

  // Normalize BM25 scores to 0-1
  const maxBm25 = Math.max(...bm25Scores.values(), 1);

  const scored: ScoredChunk[] = chunks.map((chunk) => {
    const bm25 = (bm25Scores.get(chunk.id) ?? 0) / maxBm25;
    const semantic =
      chunk.embedding && queryEmbedding.length > 0
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
    return {
      chunk,
      bm25Score: bm25,
      semanticScore: semantic,
      combinedScore: bm25W * bm25 + semW * semantic,
    };
  });

  return scored
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);
}
