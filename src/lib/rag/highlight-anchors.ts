export interface TextItemAnchor {
  text: string;
}

export interface ChunkTextLike {
  text: string;
  page: number;
}

export interface HighlightTextItemRange {
  page: number;
  start: number;
  end: number;
}

function normalizeForAnchor(text: string): string {
  return text
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function buildTextItemCharMap(items: TextItemAnchor[]): {
  text: string;
  itemRanges: Array<{ start: number; end: number }>;
} {
  let text = "";
  const itemRanges: Array<{ start: number; end: number }> = [];

  for (const item of items) {
    const normalized = normalizeForAnchor(item.text || "");
    if (!normalized) {
      itemRanges.push({ start: text.length, end: text.length });
      continue;
    }

    if (text.length > 0) text += " ";
    const start = text.length;
    text += normalized;
    itemRanges.push({ start, end: text.length });
  }

  return { text, itemRanges };
}

export function findTextItemRangeForChunk(
  chunk: ChunkTextLike,
  pageItems: TextItemAnchor[][]
): HighlightTextItemRange | undefined {
  const items = pageItems[chunk.page - 1] || [];
  if (items.length === 0) return undefined;

  const { text: pageText, itemRanges } = buildTextItemCharMap(items);
  const chunkText = normalizeForAnchor(chunk.text);
  if (chunkText.length < 3 || pageText.length === 0) return undefined;

  const candidates = [
    chunkText,
    chunkText.slice(0, 240),
    chunkText.slice(-240),
    chunkText.slice(0, 120),
  ].filter((candidate, index, all) => candidate.length >= 20 && all.indexOf(candidate) === index);

  let matchStart = -1;
  let matchEnd = -1;
  for (const candidate of candidates) {
    const idx = pageText.indexOf(candidate);
    if (idx !== -1) {
      matchStart = idx;
      matchEnd = idx + candidate.length;
      break;
    }
  }

  if (matchStart === -1) {
    const words = chunkText.split(" ").filter(Boolean);
    for (let len = Math.min(words.length, 24); len >= 6; len--) {
      for (let start = 0; start <= words.length - len; start++) {
        const phrase = words.slice(start, start + len).join(" ");
        const idx = pageText.indexOf(phrase);
        if (idx !== -1) {
          matchStart = idx;
          matchEnd = idx + phrase.length;
          break;
        }
      }
      if (matchStart !== -1) break;
    }
  }

  if (matchStart === -1) return undefined;

  let startItem = itemRanges.findIndex((range) => range.end > matchStart);
  let endItem = itemRanges.findIndex((range) => range.start >= matchEnd);
  if (startItem === -1) return undefined;
  if (endItem === -1) endItem = itemRanges.length;

  // Clamp large fuzzy matches. A source highlight that paints most of a page is worse than no highlight.
  if (endItem - startItem > 12) endItem = startItem + 12;

  return { page: chunk.page, start: startItem, end: Math.max(startItem + 1, endItem) };
}
