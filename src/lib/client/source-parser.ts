// Pure helpers for parsing [Source N] references out of LLM response text.
// Kept free of React so they can be unit-tested in a plain Node environment.

// Parse all source reference patterns:
// [Source 1] → single
// [Source 1, 2] → comma-separated
// [Source 1, 2, 3] → multiple
// [Source 1, Source 2] → repeated prefix
export function parseSourceReferences(
  text: string
): Array<{ type: "text" | "source"; value: string; index?: number }> {
  const parts: Array<{ type: "text" | "source"; value: string; index?: number }> = [];
  // Match [Source N] or [Source N, M] or [Source N, Source M] or [Source N, p.52] etc.
  const regex = /\[Source\s+(\d+(?:\s*,\s*(?:Source\s+)?\d+)*(?:\s*,\s*(?:chunk|p\.?)\s*\d+)?)\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }

    const fullMatch = match[0];
    const numbersStr = match[1];
    // Extract source numbers (skip "chunk N" and "p.N" if present)
    const cleanStr = numbersStr.replace(/,\s*(?:chunk|p\.?)\s*\d+/gi, "");
    const indices = Array.from(cleanStr.matchAll(/\d+/g)).map(m => parseInt(m[0], 10) - 1);

    // If multiple sources, create one badge per source
    if (indices.length === 1) {
      parts.push({ type: "source", value: fullMatch, index: indices[0] });
    } else {
      // For [Source 4, 5], create separate badges: [Source 4] [Source 5]
      for (const idx of indices) {
        parts.push({ type: "source", value: `[Source ${idx + 1}]`, index: idx });
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}
