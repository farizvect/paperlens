import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/rag/chunker";

describe("chunkText", () => {
  it("splits long text into chunks under CHUNK_SIZE (~1000 chars)", () => {
    const longText = Array.from({ length: 300 }, (_, i) => `Sentence number ${i} about documents and research.`).join(" ");
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(1000 + 100); // slack for prefix
    }
  });

  it("assigns increasing global indices across pages", () => {
    const pages = ["First page content here with sentences. Enough to chunk maybe.", "Second page content here with sentences."];
    const chunks = chunkText(pages);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  it("attaches section headings from the same page", () => {
    const pageText = "INTRODUCTION\nThis is the first sentence of the introduction. It has enough text to be included in a chunk with more content following.";
    const chunks = chunkText([pageText]);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].section).toBe("INTRODUCTION");
    expect(chunks[0].text.startsWith("[INTRODUCTION]\n")).toBe(true);
  });

  it("does not attach sections from other pages", () => {
    const pages = [
      "Page one body text only. No headings here at all.",
      "CONCLUSION\nFinal sentence here.",
    ];
    const chunks = chunkText(pages);
    const pageOneChunks = chunks.filter((c) => c.page === 1);
    const pageTwoChunks = chunks.filter((c) => c.page === 2);
    for (const c of pageOneChunks) expect(c.section).toBe("");
    for (const c of pageTwoChunks) expect(c.section).toBe("CONCLUSION");
  });

  it("skips empty pages", () => {
    const chunks = chunkText(["", "   ", "Some real content here with words."]);
    expect(chunks.every((c) => c.page === 3)).toBe(true);
  });

  it("aligns overlap to word boundaries and keeps section position stable", () => {
    // Build a page with a heading at the start and enough text to chunk twice
    const sentences = Array.from({ length: 80 }, (_, i) => `Research finding ${i} demonstrates the effect clearly.`).join(" ");
    const chunks = chunkText([`METHODS\n${sentences}`]);
    expect(chunks.length).toBeGreaterThan(1);
    // The section label must remain attached even on later chunks (position drift bug)
    for (const c of chunks) {
      expect(c.section).toBe("METHODS");
    }
  });

  it("treats string input as a single page", () => {
    const chunks = chunkText("Single page with enough text to produce one chunk of content.");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].page).toBe(1);
  });
});
