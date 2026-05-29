"use client";

// Dynamic import to avoid SSR issues
// We use a cached promise so the model is only loaded once per session
let _extractorPromise: Promise<(text: string, kwargs?: Record<string, unknown>) => Promise<{ data: Float32Array }>> | null = null;

async function getExtractor() {
  if (!_extractorPromise) {
    _extractorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      // Return a narrow callable so downstream code doesn't fight the union type
      return (text: string, kwargs?: Record<string, unknown>) =>
        pipe(text, kwargs as Parameters<typeof pipe>[1]) as Promise<{ data: Float32Array }>;
    })();
  }
  return _extractorPromise;
}

/**
 * Generate an embedding vector for the given text using transformers.js (client-side).
 * The model is loaded lazily on first call and cached for subsequent calls.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Both vectors must be the same length.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
