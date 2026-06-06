Create a professional infographic following these specifications:

## Image Specifications
- **Type**: Infographic
- **Layout**: bento-grid
- **Style**: craft-handmade
- **Aspect Ratio**: 16:9
- **Language**: English

## Core Principles
- Follow the layout structure precisely for information architecture
- Apply style aesthetics consistently throughout
- If content involves sensitive or copyrighted figures, create stylistically similar alternatives
- Keep information concise, highlight keywords and core concepts
- Use ample whitespace for visual clarity
- Maintain clear visual hierarchy

## Text Requirements
- All text must match the specified style treatment
- Main titles should be prominent and readable
- Key concepts should be visually emphasized
- Labels should be clear and appropriately sized
- Use the specified language for all text content

## Layout Guidelines
# bento-grid

Modular grid layout with varied cell sizes, like a bento box.

## Structure
- Grid of rectangular cells
- Mixed cell sizes (1x1, 2x1, 1x2, 2x2)
- No strict symmetry required
- Hero cell for main point
- Supporting cells around it

## Best For
- Multiple topic overview
- Feature highlights
- Dashboard summaries
- Portfolio displays
- Mixed content types

## Visual Elements
- Clear cell boundaries
- Varied cell backgrounds
- Icons or illustrations per cell
- Consistent padding/margins
- Visual hierarchy through size

## Text Placement
- Main title at top
- Cell titles within each cell
- Brief content per cell
- Minimal text, maximum visual
- CTA or summary in prominent cell

## Style Guidelines
# craft-handmade (DEFAULT)

Hand-drawn and paper craft aesthetic with warm, organic feel.

## Color Palette
- Primary: Warm pastels, soft saturated colors, craft paper tones
- Background: Light cream (#FFF8F0), textured paper (#F5F0E6)
- Accents: Bold highlights, construction paper colors
- Note: The PaperLens product design uses #f5f4ed parchment canvas and #1B365D ink blue accent — translate these to craft-handmade equivalents (parchment → #F5F0E6 textured paper, ink blue → navy construction paper)

## Variants
- **Hand-drawn**: Cartoon illustration, simple icons, slightly imperfect lines
- **Paper-cutout**: Layered paper craft, drop shadows, torn edges, texture (preferred for this brief)

## Visual Elements
- Hand-drawn or cut-paper quality
- Organic, slightly imperfect shapes
- Layered depth with shadows (paper variant)
- Simple cartoon elements and icons
- Character illustrations (people, personalities in cartoon form)
- Ample whitespace, clean composition
- Keywords and core concepts highlighted
- **Strictly hand-drawn—no realistic or photographic elements**

## Style Enforcement
- All imagery must maintain cartoon/illustrated aesthetic
- Replace real photos or realistic figures with hand-drawn equivalents
- Maintain consistent line weight and illustration style throughout

## Typography
- Hand-drawn or casual font style
- Clear, readable labels
- Keywords emphasized with larger/bolder text
- Cut-out letter style for paper variant

---

Generate the infographic based on the content below:

# PaperLens — Client-side PDF chat with AI source citations

## Subtitle
Upload scientific PDFs. Chat with AI. Your documents never leave your browser.

## Hero cell: Privacy Promise
"NOTHING LEAVES YOUR BROWSER" — central focal point
- 100% client-side
- IndexedDB storage
- BYOK API
- Local PDF.js worker (no CDN)

## Cell A — Read & Search
- Multi-PDF chat
- Hybrid search (BM25 + semantic)
- Source citations
- Coordinate-based highlighting

## Cell B — Privacy & Control
- Client-side storage
- BYOK API
- Anti-jailbreak
- Chat history persistence

## Cell C — UX
- PDF viewer (zoom, virtualization)
- Mobile text selection
- Mobile-first responsive
- Drag & drop upload

## Cell D — Smart
- Language-aware
- Follow-up suggestions
- Key quotes extraction
- Token usage display

## Cell E — The Pipeline (5 stages, mini-linear inside the cell)
1. Upload — drag & drop, extract text via unpdf
2. Chunk — 1000-char chunks, 200 overlap, sentence-boundary
3. Embed — @huggingface/transformers semantic vectors
4. Search — BM25 + semantic hybrid retrieval
5. Cite — text-item anchors, click to highlight exact PDF location

## Cell F — Tech Stack
Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Zustand · react-pdf · pdfjs-dist · @huggingface/transformers · unpdf · IndexedDB · Playwright

## Cell G — Design System
- Canvas: parchment #f5f4ed
- Accent: ink blue #1B365D
- Font: Source Serif 4

Text labels (in English):
- "PaperLens" (main title)
- "Nothing leaves your browser" (hero)
- "Read & Search" (A)
- "Privacy & Control" (B)
- "UX" (C)
- "Smart" (D)
- "Pipeline" (E)
- "Stack" (F)
- "Design" (G)
