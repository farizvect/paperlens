# PaperLens — Source

> Upload scientific PDFs — thesis, journals, reports — and chat with AI about their content. Your documents stay in your browser, nothing leaves your device.

## Tagline
"Upload scientific PDFs and chat with AI about their content. Your documents stay in your browser, nothing leaves your device."

## Core Features (16)

1. **Multi-PDF chat** — select multiple documents and ask questions across all of them
2. **Hybrid search** — BM25 keyword search combined with semantic embeddings (`@huggingface/transformers`)
3. **Source citations** — every answer includes clickable `[Source N]` references with chunk excerpts
4. **Coordinate-based highlighting** — PDF text items extracted at upload time with position data; source clicks jump to exact location using text-item anchors (not fuzzy search)
5. **Client-side storage** — all data lives in IndexedDB (documents, chunks, chat history)
6. **PDF viewer** — built-in viewer with zoom, page navigation, virtualized rendering (currentPage ± 2)
7. **Mobile text selection** — text layer disabled on mobile by default, toggle via toolbar
8. **Mobile-first** — responsive sidebar, hamburger toggle, body scroll lock, CSS grid layout
9. **BYOK API** — bring your own OpenAI-compatible API key and base URL via Settings
10. **Language-aware** — AI detects the PDF language and responds in the same language
11. **Anti-jailbreak** — system prompt scoped to document analysis only; blocks roleplay, instruction injection, and prompt exfiltration
12. **Drag & drop** — drop PDFs anywhere on the chat area
13. **Follow-up suggestions** — AI generates follow-up questions after each response
14. **Key quotes extraction** — one-click extraction of important quotes with citations
15. **Chat history persistence** — conversations saved per document, restored on revisit
16. **Token usage display** — shows input/output token counts per response

## Stack (12)

- **Next.js 16** (App Router, Turbopack)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Zustand** for state management
- **react-pdf** + **pdfjs-dist** for PDF rendering (local worker, no CDN dependency)
- **@huggingface/transformers** for client-side semantic embeddings
- **unpdf** for client-side PDF parsing
- **react-markdown** + **remark-gfm** for Markdown rendering
- **IndexedDB** for all client-side storage
- **Playwright** for end-to-end testing

## Design System

- **Canvas**: `#f5f4ed` parchment (never pure white)
- **Accent**: Ink blue `#1B365D` only
- **Neutrals**: Warm-toned (yellow-brown undertone)
- **Typography**: Source Serif 4, weight 400 body / 500 headings

## Privacy Promise
Documents stay in browser. Nothing leaves device. (IndexedDB, client-side embeddings via WebAssembly, server only sees streaming chat via user's BYOK key.)
