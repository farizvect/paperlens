import { describe, it, expect } from "vitest";
import { bm25Rank, bm25ScoreMap } from "@/lib/client/storage";
import type { StoredChunk } from "@/lib/client/storage";

function makeChunk(id: string, text: string): StoredChunk {
  return { id, docId: "doc1", docName: "test", chunkIndex: Number(id), text };
}

describe("bm25Rank", () => {
  it("ranks chunks containing the query term above others", () => {
    const chunks = [
      makeChunk("0", "This chunk is about quantum computing and entanglement."),
      makeChunk("1", "Completely unrelated biology text about cells and enzymes."),
      makeChunk("2", "More quantum physics details and experiments with qubits."),
    ];
    const ranked = bm25Rank(chunks, "quantum");
    expect(ranked[0].id).toBe("0");
    expect(ranked[1].id).toBe("2");
    expect(ranked[2].id).toBe("1");
  });

  it("does not count substring hits as token hits (model vs modeling)", () => {
    const chunks = [
      makeChunk("0", "The model performs well on benchmarks."),
      makeChunk("1", "Modeling clay is fun for kids."),
    ];
    // "model" should match chunk 0 strongly, not chunk 1 via "modeling"
    const ranked = bm25Rank(chunks, "model");
    expect(ranked[0].id).toBe("0");
    // chunk 1 should have zero score (only substring match)
    const scores = bm25ScoreMap(chunks, "model");
    expect(scores.get("1")).toBe(0);
  });

  it("phrase bonus is applied once, not compounded per term", () => {
    const phraseChunk = makeChunk("0", "artificial intelligence artificial intelligence artificial intelligence");
    const singleChunk = makeChunk("1", "artificial intelligence");
    const scores = bm25ScoreMap([phraseChunk, singleChunk], "artificial intelligence");
    // phrase chunk has more term occurrences → higher raw score
    expect(scores.get("0")!).toBeGreaterThan(scores.get("1")!);
    // but the phrase multiplier must not blow it up to absurd ratios — sanity bound
    expect(scores.get("0")! / scores.get("1")!).toBeLessThan(5);
  });

  it("returns empty map for empty term query", () => {
    const chunks = [makeChunk("0", "some text")];
    expect(bm25ScoreMap(chunks, "")).toEqual(new Map());
  });
});
