# PaperLens — Analysis

**Topic**: Client-side PDF chat with AI source citations
**Type**: Product overview / feature tour
**Complexity**: Medium-high (16 features, 12 stack items, design system, privacy)
**Tone**: Technical, clean, academic-leaning (parchment + ink blue design system)
**Audience**: Developers, researchers, privacy-conscious PDF readers, anyone evaluating RAG-over-PDF tools
**Source language**: English
**User language**: English

## Data points (verbatim, do not paraphrase)

- 16 features
- 12 stack items
- Design: `#f5f4ed` parchment canvas, `#1B365D` ink blue accent, Source Serif 4
- Privacy: "Your documents stay in your browser, nothing leaves your device"
- Core RAG: BM25 + `@huggingface/transformers` semantic embeddings
- PDF: react-pdf + pdfjs-dist (local worker, no CDN)
- Storage: IndexedDB (documents, chunks, chats)
- API: BYOK (OpenAI-compatible)
- Test: Playwright E2E

## Content structure candidates

Three main dimensions to convey:
1. **What it does** — multi-PDF chat with citations (16 features)
2. **How it works** — client-side RAG pipeline (chunking, embeddings, hybrid search, source highlighting)
3. **Privacy story** — nothing leaves the browser, BYOK, no server-side data

## Recommended combinations (Step 3)

| Combination | Why |
|---|---|
| **`hub-spoke` + `corporate-memphis`** | Center = privacy promise ("nothing leaves your browser"). Spokes = 4-6 feature clusters (multi-PDF chat, hybrid search, citations, BYOK, anti-jailbreak, mobile). Modern flat-vector aesthetic matches the Next.js + Tailwind design language. |
| **`bento-grid` + `craft-handmade`** | Multiple topics/overview fits bento-grid. Hand-drawn paper-craft matches the parchment canvas. |
| **`linear-progression` + `ikea-manual`** | Walk through the data flow: upload PDF → chunk → embed → search → chat → highlight. Step-by-step fits the RAG pipeline story. |
| **`dense-modules` + `pop-laboratory`** | All 16 features + 12 stack items in one dense modular layout, blueprint/tech aesthetic. Best for a "deep technical overview" audience. |

## Design instructions from user
None explicit — default to "make it look like a Product Hunt-style overview card" with a subtle nod to the parchment + ink blue design system.

## Aspects considered
- **landscape (16:9)** — best for blog post / landing page hero
- **portrait (9:16)** — best for X/Twitter share, README cover
- **square (1:1)** — best for OG image, GitHub social card

## Language
English (matches source content + user conversation).
