import { describe, it, expect } from "vitest";
import { parseSourceReferences } from "@/lib/client/source-parser";

describe("parseSourceReferences", () => {
  it("parses a single [Source 1] reference", () => {
    const parts = parseSourceReferences("The result is shown in [Source 1].");
    expect(parts).toEqual([
      { type: "text", value: "The result is shown in " },
      { type: "source", value: "[Source 1]", index: 0 },
      { type: "text", value: "." },
    ]);
  });

  it("parses comma-separated [Source 1, 2] into separate badges", () => {
    const parts = parseSourceReferences("See [Source 1, 2] for details.");
    expect(parts).toContainEqual({ type: "source", value: "[Source 1]", index: 0 });
    expect(parts).toContainEqual({ type: "source", value: "[Source 2]", index: 1 });
  });

  it("parses repeated [Source 1, Source 2] notation", () => {
    const parts = parseSourceReferences("[Source 1, Source 2]");
    expect(parts).toContainEqual({ type: "source", value: "[Source 1]", index: 0 });
    expect(parts).toContainEqual({ type: "source", value: "[Source 2]", index: 1 });
  });

  it("ignores page annotations inside brackets (p.52 / chunk 3)", () => {
    const parts = parseSourceReferences("Data from [Source 3, p.52] and [Source 4, chunk 7]");
    const sources = parts.filter((p) => p.type === "source");
    expect(sources.map((s) => s.index)).toEqual([2, 3]);
  });

  it("does not match non-source brackets", () => {
    const parts = parseSourceReferences("See [citation needed] and [12] here.");
    expect(parts).toEqual([{ type: "text", value: "See [citation needed] and [12] here." }]);
  });

  it("leaves text without references as a single text part", () => {
    const parts = parseSourceReferences("Just plain text.");
    expect(parts).toEqual([{ type: "text", value: "Just plain text." }]);
  });
});
