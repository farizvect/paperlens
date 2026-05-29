# PaperLens

> Upload scientific PDFs — thesis, journals, reports — and chat with AI about their content. Your documents stay in your browser, nothing leaves your device.

![PaperLens Homepage](public/screenshot.png)

## Features

- **Multi-PDF chat** — select multiple documents and ask questions across all of them
- **Hybrid search** — BM25 keyword search combined with semantic embeddings (`@huggingface/transformers`) for better retrieval
- **Source citations** — every answer includes clickable `[Source N]` references with chunk excerpts
- **Client-side storage** — all data lives in IndexedDB (documents, chunks, chat history)
- **PDF viewer** — built-in viewer with zoom, page navigation, virtualized rendering (currentPage ± 2), and source highlighting
- **Mobile text selection** — text layer disabled on mobile by default (saves memory), toggle via toolbar
- **BYOK API** — bring your own OpenAI-compatible API key and base URL via Settings
- **Language-aware** — AI detects the PDF language and responds in the same language
- **Mobile-first** — responsive sidebar, hamburger toggle, body scroll lock, CSS grid layout
- **Drag & drop** — drop PDFs anywhere on the chat area
- **Follow-up suggestions** — AI generates follow-up questions after each response
- **Key quotes extraction** — one-click extraction of important quotes with citations
- **Chat history persistence** — conversations saved per document, restored on revisit
- **Token usage display** — shows input/output token counts per response
- **Onboarding tutorial** — guided first-use experience

## Screenshots

### Upload & Document Management

![Upload Interface](public/screenshot-upload.png)

Upload PDFs via drag-drop or file picker. Documents are processed client-side with `unpdf` and chunked into searchable segments.

### Chat with AI

![Chat Interface](public/screenshot-chat.png)

Ask questions about your documents and get AI-powered answers with source citations. Click `[Source N]` badges to see the exact excerpt from the PDF.

### Source Citations

![Source Citation Card](public/screenshot-source.png)

Each source citation shows the page number, section name, and relevant text excerpt. Transparency in every answer.

### PDF Viewer

![PDF Viewer](public/screenshot-pdf.png)

Built-in PDF viewer with zoom controls, page navigation, and automatic source highlighting. Only renders visible pages (currentPage ± 2) with spacer divs to maintain scroll position — no mobile crash on large PDFs.

### BYOK Settings

![Settings Dialog](public/screenshot-settings.png)

Configure your own OpenAI-compatible API endpoint, key, and model. Works with any provider that supports the OpenAI API format.

## Stack

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

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
npm run start
```

Dev server runs on `http://localhost:3005` by default.

## Testing

```bash
# Run Playwright tests
npx playwright test

# Run with UI
npx playwright test --ui
```

Tests cover layout integrity, PDF upload, viewer functionality, and virtualization behavior.

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts    # Streaming SSE chat endpoint
│   ├── globals.css           # Theme (parchment + ink blue), animations
│   ├── layout.tsx            # Root layout with Source Serif 4 font
│   └── page.tsx              # Main page
├── components/
│   ├── chat-panel.tsx        # Chat UI orchestrator
│   ├── chat-empty-state.tsx  # Empty state with upload prompt
│   ├── chat-input.tsx        # Message input with drag-drop
│   ├── chat-messages.tsx     # Message list with auto-scroll
│   ├── pdf-viewer.tsx        # Dynamic import wrapper (SSR-safe)
│   ├── pdf-viewer-inner.tsx  # PDF viewer with virtualization
│   ├── resizable-split.tsx   # Resizable panel split (8px gutter)
│   ├── sidebar.tsx           # Document list, search, upload, multi-select
│   ├── message-bubble.tsx    # Markdown rendering with source badges
│   ├── source-card.tsx       # Citation excerpt display
│   ├── settings-dialog.tsx   # BYOK API configuration
│   ├── onboarding.tsx        # First-use tutorial
│   ├── store-hydrator.tsx    # SSR-safe Zustand hydration
│   ├── loading-skeleton.tsx  # Shimmer loading states
│   └── ui/                   # shadcn/ui primitives
├── hooks/
│   └── use-chat.ts           # Chat message management hook
├── lib/
│   ├── client/
│   │   ├── pdf.ts            # unpdf text extraction
│   │   └── storage.ts        # IndexedDB (documents, chunks, chats)
│   ├── rag/
│   │   ├── chunker.ts        # Sentence-boundary chunking (1000 char, 200 overlap)
│   │   └── embeddings.ts     # @huggingface/transformers embeddings
│   ├── search/
│   │   └── hybrid.ts         # BM25 + semantic hybrid search
│   ├── rate-limit.ts         # Server-side rate limiting
│   └── utils.ts              # cn() utility
├── store/
│   └── chat.ts               # Zustand store (messages, activeDoc, llmSettings)
tests/
├── layout.spec.ts            # Layout integrity tests
├── upload.spec.ts            # PDF upload tests
└── pdf-viewer.spec.ts        # PDF viewer and virtualization tests
```

## Configuration

### API Settings (BYOK)

Click **Settings** in the sidebar to configure:

- **Base URL** — any OpenAI-compatible endpoint (e.g., `https://api.openai.com/v1`)
- **API Key** — your API key
- **Model** — model name (e.g., `gpt-4o-mini`, `gpt-4`, `claude-3-sonnet`)

Settings are persisted in `localStorage`.

### Design System

- **Canvas**: `#f5f4ed` parchment (never pure white)
- **Accent**: Ink blue `#1B365D` only
- **Neutrals**: Warm-toned (yellow-brown undertone)
- **Typography**: Source Serif 4, weight 400 body / 500 headings
- **Animations**: Message slide-in, sidebar toggle, drag overlay, shimmer skeletons

## How It Works

1. **Upload** — PDF is parsed client-side with `unpdf`, chunked into ~1000-char segments with section awareness
2. **Embed** — Chunks embedded with `@huggingface/transformers` for semantic search
3. **Store** — Chunks + embeddings saved to IndexedDB with full-text search index
4. **Query** — User question runs hybrid search (BM25 + semantic), top 8 results selected
5. **Stream** — Context + question sent to LLM via `/api/chat` (SSE streaming)
6. **Display** — Response rendered as Markdown with `[Source N]` citation badges
7. **Highlight** — Click `[Source N]` to open PDF viewer and highlight the source text

## Privacy

All processing happens in your browser:
- PDFs are parsed client-side using `unpdf`
- Embeddings generated client-side with `@huggingface/transformers` (ONNX runtime)
- Documents and chat history stored in IndexedDB
- Only the query + relevant chunks sent to your configured API
- No data leaves your device except what you explicitly send to the LLM

## License

MIT
