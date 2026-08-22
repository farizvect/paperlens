export interface Chunk {
  text: string;
  index: number;
  page: number;
  section: string;
}

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MIN_FRAG_LENGTH = 50;

// Detect if a line is a heading/section title
function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 150) return false;

  // Numbered headings: "1.", "1.1", "BAB II", "Chapter 3", "BAGIAN 2"
  if (/^(\d{1,2}(\.\d{1,2})*\.?|BAB\s+[IVXLC\d]+|BAGIAN\s+\d+|CHAPTER\s+\d+|PENDAHULUAN|TINJAUAN\s+PUSTAKA|METODOLOGI|HASIL\s+DAN\s+PEMBAHASAN|KESIMPULAN|DAFTAR\s+PUSTAKA|LAMPIRAN)/i.test(trimmed)) {
    return true;
  }

  // ALL CAPS (at least 3 chars, not too long)
  if (trimmed === trimmed.toUpperCase() && /^[A-Z\d\s]{3,80}$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
    return true;
  }

  // Short bold-style lines (no period at end, title case, no common sentence starters)
  if (trimmed.length < 60 && trimmed.length > 5 && !trimmed.endsWith(".") && !trimmed.endsWith(",") && !trimmed.endsWith(":") && /^[A-Z]/.test(trimmed)) {
    // Exclude lines that look like regular sentences
    const lower = trimmed.toLowerCase();
    if (/^(the|a|an|this|that|these|those|it|he|she|we|they|in|on|at|for|with|from|by|as|but|or|and|if|when|while|although|because|since|after|before|however|therefore|moreover|furthermore|additionally)/i.test(lower)) {
      return false;
    }
    // Title case check: ALL words must start with uppercase (except short words)
    const words = trimmed.split(/\s+/).filter(w => w.length > 3);
    const upperCount = words.filter(w => /^[A-Z]/.test(w)).length;
    if (words.length >= 2 && upperCount >= words.length * 0.8) {
      return true;
    }
  }

  return false;
}

/**
 * Collapse whitespace exactly like `text.replace(/\s+/g, " ").trim()` while
 * also returning the CLEANED-text position where each non-empty original line
 * starts. Section positions and chunk positions therefore share one coordinate
 * space (previously they used different spaces, which made section labels
 * drift on longer pages).
 */
function cleanWithLineStarts(pageText: string): { cleaned: string; lineStarts: number[] } {
  const lines = pageText.split("\n");
  const lineStarts: number[] = [];
  const parts: string[] = [];
  let offset = 0;
  for (const rawLine of lines) {
    const collapsed = rawLine.replace(/\s+/g, " ").trim();
    if (!collapsed) continue;
    lineStarts.push(offset);
    if (parts.length > 0) offset += 1; // the joining space between lines
    parts.push(collapsed);
    offset += collapsed.length;
  }
  return { cleaned: parts.join(" "), lineStarts };
}

/**
 * Build a map of cleaned-text position -> section heading.
 * `lineStarts[i]` is the cleaned start position of the i-th non-empty
 * original line, so we can pair each heading line with its cleaned position.
 */
function extractSections(pageText: string, lineStarts: number[]): Map<number, string> {
  const sections = new Map<number, string>();
  let lineIdx = 0;
  for (const rawLine of pageText.split("\n")) {
    const collapsed = rawLine.replace(/\s+/g, " ").trim();
    if (!collapsed) continue;
    if (isHeading(rawLine)) {
      sections.set(lineStarts[lineIdx], collapsed);
    }
    lineIdx++;
  }
  return sections;
}

// Find the current section for a given position
function findCurrentSection(sections: Map<number, string>, position: number): string {
  let current = "";
  for (const [pos, heading] of sections) {
    if (pos <= position) {
      current = heading;
    } else {
      break;
    }
  }
  return current;
}

export function chunkText(text: string): Chunk[];
export function chunkText(pages: string[]): Chunk[];
export function chunkText(input: string | string[]): Chunk[] {
  // Handle both signatures
  const pages: string[] = Array.isArray(input) ? input : [input];
  const chunks: Chunk[] = [];
  let globalIndex = 0;

  for (let pageNum = 0; pageNum < pages.length; pageNum++) {
    const pageText = pages[pageNum];
    if (!pageText || pageText.trim().length === 0) continue;

    const { cleaned, lineStarts } = cleanWithLineStarts(pageText);
    if (cleaned.length === 0) continue;

    const sections = extractSections(pageText, lineStarts);

    const sentences = splitIntoSentences(cleaned);
    let current = "";
    let currentStartPos = 0; // cleaned-text position where `current` begins
    let currentPos = 0; // cleaned-text position after the last processed sentence

    for (const sentence of sentences) {
      if (current.length + sentence.length > CHUNK_SIZE && current.length > 0) {
        if (current.trim().length >= MIN_FRAG_LENGTH) {
          const section = findCurrentSection(sections, currentStartPos);
          const prefix = section ? `[${section}]\n` : "";
          chunks.push({
            text: prefix + current.trim(),
            index: globalIndex++,
            page: pageNum + 1,
            section: section || "",
          });
        }
        // Align overlap to word boundary
        let overlapText = current.slice(-CHUNK_OVERLAP);
        const firstSpace = overlapText.indexOf(" ");
        if (firstSpace > 0) overlapText = overlapText.slice(firstSpace + 1);
        // The new chunk starts at the overlap text's start position.
        // currentPos already counts the flushed sentences, so subtract the
        // overlap length (not the full current length — that was the bug).
        currentStartPos = currentPos - overlapText.length;
        current = overlapText + sentence;
      } else {
        if (current.length === 0) currentStartPos = currentPos;
        current += sentence;
      }
      currentPos += sentence.length;
    }

    if (current.trim().length >= MIN_FRAG_LENGTH) {
      const section = findCurrentSection(sections, currentStartPos);
      const prefix = section ? `[${section}]\n` : "";
      chunks.push({
        text: prefix + current.trim(),
        index: globalIndex++,
        page: pageNum + 1,
        section: section || "",
      });
    }
  }

  return chunks;
}

function splitIntoSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/);
  const sentences: string[] = [];
  for (const s of raw) {
    if (s.length <= CHUNK_SIZE) {
      sentences.push(s + " ");
    } else {
      for (let i = 0; i < s.length; i += CHUNK_SIZE) {
        sentences.push(s.slice(i, i + CHUNK_SIZE) + " ");
      }
    }
  }
  return sentences;
}
