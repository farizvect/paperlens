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

// Extract section headings from text, return map of position -> heading
function extractSections(text: string): Map<number, string> {
  const sections = new Map<number, string>();
  const lines = text.split(/\n/);
  let pos = 0;

  for (const line of lines) {
    if (isHeading(line)) {
      sections.set(pos, line.trim());
    }
    pos += line.length + 1; // +1 for newline
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

    const cleaned = pageText.replace(/\s+/g, " ").trim();
    if (cleaned.length === 0) continue;

    // Extract section headings from the original (non-cleaned) page text
    const sections = extractSections(pageText);

    const sentences = splitIntoSentences(cleaned);
    let current = "";
    let currentPos = 0;

    for (const sentence of sentences) {
      if (current.length + sentence.length > CHUNK_SIZE && current.length > 0) {
        if (current.trim().length >= MIN_FRAG_LENGTH) {
          const section = findCurrentSection(sections, currentPos - current.length);
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
        current = overlapText + sentence;
      } else {
        current += sentence;
      }
      currentPos += sentence.length;
    }

    if (current.trim().length >= MIN_FRAG_LENGTH) {
      const section = findCurrentSection(sections, currentPos - current.length);
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
