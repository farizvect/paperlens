# PaperLens — Structured Content for Infographic

## Title
**PaperLens** — Client-side PDF chat with AI source citations

## Subtitle
Upload scientific PDFs. Chat with AI. Your documents never leave your browser.

## Section 1: Hero / Privacy Promise (focal point)
- **Headline**: "Nothing leaves your browser"
- **Key data**: 100% client-side, IndexedDB storage, BYOK API, local PDF.js worker
- **Visual element**: parchment + ink blue shield/lock icon

## Section 2: 16 Features (grouped into 4 clusters)
- **Cluster A — Read & Search**: Multi-PDF chat, Hybrid search (BM25 + semantic), Source citations, Coordinate-based highlighting
- **Cluster B — Privacy & Control**: Client-side storage, BYOK API, Anti-jailbreak, Chat history persistence
- **Cluster C — UX**: PDF viewer (zoom, virtualization), Mobile text selection, Mobile-first responsive, Drag & drop upload
- **Cluster D — Smart**: Language-aware, Follow-up suggestions, Key quotes extraction, Token usage display

## Section 3: The Pipeline (5 stages)
1. **Upload** — drag & drop, extract text via unpdf
2. **Chunk** — 1000-char chunks, 200 overlap, sentence-boundary
3. **Embed** — `@huggingface/transformers` semantic vectors
4. **Search** — BM25 + semantic hybrid retrieval
5. **Cite** — text-item anchors, click to highlight exact PDF location

## Section 4: Tech Stack (12 items)
- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Zustand
- react-pdf + pdfjs-dist
- @huggingface/transformers
- unpdf
- react-markdown + remark-gfm
- IndexedDB
- Playwright
- Source Serif 4 (font)
- Parchment + ink blue design tokens

## Section 5: Design System (visual signature)
- Canvas: `#f5f4ed` (parchment)
- Accent: `#1B365D` (ink blue)
- Typography: Source Serif 4 (400 body / 500 headings)
- Mood: academic, calm, focused

## Stats callouts (verbatim from source)
- 16 features
- 12 stack items
- 100% client-side
- BYOK (bring your own key)
- OpenAI-compatible API

## Data integrity checklist
- ✅ All 16 features listed (preserved exactly)
- ✅ All 12 stack items listed
- ✅ Design tokens preserved (`#f5f4ed`, `#1B365D`, Source Serif 4)
- ✅ No credentials in source — safe to include directly
- ✅ Privacy promise preserved exactly
