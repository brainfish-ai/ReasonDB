# ReasonDB Animation Walkthrough Script

**Target Audience:** Visual learners, VFX team reference
**Estimated Duration:** 3–4 minutes
**Style:** Clean, modern motion graphics (think Stripe/Linear product videos)
**Color Palette:** Dark background (#0A0A0F), electric blue (#3B82F6) for primary accents, amber (#F59E0B) for LLM/AI elements, green (#10B981) for success/answers, subtle grids and glows

---

## ACT 1: THE PROBLEM (0:00 – 0:45)

### Scene 1.1 — The Messy Reality (0:00 – 0:15)

**Visual:** A sprawling desk covered in documents — contracts, research papers, policy manuals, invoices. They float and scatter in 3D space. Camera slowly pulls back to reveal hundreds of documents.

**Narration:**
> "Your organization runs on documents. Contracts, research papers, compliance manuals — mountains of critical knowledge."

**Animation Notes:**
- Documents materialize one by one, then accelerate
- Slight camera shake to convey overwhelm
- Documents vary in type: PDF icons, Word docs, spreadsheets, web pages

---

### Scene 1.2 — The Broken Pipeline (0:15 – 0:30)

**Visual:** A document flows into a grinder labeled "Vector DB / Traditional RAG." It gets shredded into random floating chunks — isolated, disconnected fragments.

**Narration:**
> "Today's AI tools shred your documents into disconnected chunks. Structure is lost. Context is destroyed."

**Animation Notes:**
- A beautifully structured document (with visible headings, sections, subsections) enters left
- It passes through a stylized "shredder" machine
- Out come floating text fragments — scattered, randomly sized, no hierarchy
- Red dotted lines show broken connections between chunks
- Some chunks fade to gray (lost context)

---

### Scene 1.3 — The Failure (0:30 – 0:45)

**Visual:** An AI chatbot icon tries to answer a question. It grabs random chunks, producing a garbled, contradictory answer. A red "X" or warning icon appears.

**Narration:**
> "The result? AI that hallucinates, misses critical context, and gives you wrong answers when it matters most."

**Animation Notes:**
- Chat bubble appears: "What are the termination conditions in our contract?"
- AI icon frantically grabs random floating chunks
- Answer bubble assembles with visible gaps and contradictions
- Red glow/pulse, a "confidence: 23%" meter drops
- Subtle screen shake — failure state

---

## ACT 2: THE SOLUTION — INTRODUCING REASONDB (0:45 – 1:15)

### Scene 2.1 — The Reveal (0:45 – 1:00)

**Visual:** The scattered chunks dissolve. Screen goes dark. The ReasonDB logo materializes with a subtle glow. Tagline types out below.

**Narration:**
> "Meet ReasonDB. The database that understands your documents."

**Animation Notes:**
- All debris fades to black
- Brief pause (0.5s) — dramatic silence
- Logo assembles from particles, electric blue glow
- Tagline fades in: "AI-Native Document Intelligence"
- Subtle pulse/heartbeat effect on the logo

---

### Scene 2.2 — The Core Idea (1:00 – 1:15)

**Visual:** Split screen comparison. Left: scattered chunks (old way, grayed out). Right: a beautiful, glowing document tree (ReasonDB way, vibrant).

**Narration:**
> "ReasonDB doesn't shred your documents. It preserves their structure — so AI can reason through them like a human expert."

**Animation Notes:**
- Left side: scattered chunks labeled "Vector DB" with a dim red tint
- Right side: a hierarchical tree glows into existence
  - Root node at top (document title)
  - Branches spread to chapters/sections
  - Leaves contain actual content
  - Each node has a subtle summary preview tooltip
- Connection lines pulse with flowing light (data flowing through the tree)

---

## ACT 3: HOW IT WORKS (1:15 – 2:45)

### Scene 3.1 — Ingestion: Building the Knowledge Tree (1:15 – 1:45)

**Visual:** A document (e.g., a legal contract) enters from the left. It passes through a pipeline of stages, each transforming it.

**Narration:**
> "When you ingest a document, ReasonDB builds a navigable knowledge tree. Every section, heading, and paragraph preserves its place in the hierarchy."

**Animation Notes:**

**Stage 1 — Extract (1:15 – 1:22)**
- Document icon (PDF) enters a glowing portal labeled "Extract"
- Out comes clean markdown text, headings visible
- Supported formats flash briefly: PDF, Word, Excel, HTML, Audio, Video

**Stage 2 — Structure (1:22 – 1:30)**
- The markdown flows into a "Structure" module
- Text reorganizes itself into a tree:
  - Root: "Master Services Agreement"
  - Branch: "Section 1: Definitions" → "Section 2: Scope" → ... → "Section 8: Termination"
  - Leaves: individual paragraphs/clauses
- Tree assembles with satisfying snap animations

**Stage 3 — Summarize (1:30 – 1:45)**
- An AI icon (amber glow) visits each node bottom-up
- Starting at leaves: small summary badges appear
- Moving up: parent nodes get summaries synthesized from children
- Root gets a master summary
- The tree now glows fully — every node has a summary
- Label: "Bottom-Up LLM Summarization"

---

### Scene 3.2 — Retrieval: The Reasoning Engine (1:45 – 2:45)

**Visual:** A user types a natural language question. The system processes it through multiple phases.

**Narration (at 1:45):**
> "Now watch what happens when you ask a question."

**The Question (1:45 – 1:50)**
- Chat input appears: "What are the late payment penalties across all our vendor contracts?"
- Question floats up and enters the ReasonDB engine

---

**Phase 1 — Smart Filtering (1:50 – 2:00)**

**Visual:** A grid of document icons. A fast scan beam sweeps across them. Most fade out. A handful light up.

**Narration:**
> "Phase one: fast keyword search narrows thousands of documents to the most relevant candidates in milliseconds."

**Animation Notes:**
- Grid of ~50 document icons
- Blue scan line sweeps left to right
- ~40 documents dim/fade
- ~10 documents glow blue, float forward
- Timer shows: "~50ms"
- Label: "BM25 Full-Text Search"

---

**Phase 2 — Summary Ranking (2:00 – 2:15)**

**Visual:** The surviving documents show their root summaries. An AI eye scans each summary, assigning scores.

**Narration:**
> "Phase two: the AI reads each document's summary — like scanning a table of contents — to rank which ones are most promising."

**Animation Notes:**
- 10 document cards spread out, each showing title + root summary preview
- Amber AI eye/icon scans each card
- Score badges appear: 0.92, 0.87, 0.71, 0.45, 0.32...
- Low-scoring documents slide away
- Top 3–5 documents remain, arranged in a row
- Label: "Agentic Summary Ranking"

---

**Phase 3 — Deep Tree Traversal (2:15 – 2:40)**

**Visual:** Camera zooms into one of the top documents. We see its full tree. The AI navigates through it.

**Narration:**
> "Phase three: the AI navigates each document's tree — reading summaries at each level, choosing the most relevant branches, drilling deeper until it finds the precise answer."

**Animation Notes:**
- Zoom into a single document tree (the "Master Services Agreement")
- Tree has 3 levels: Root → Sections → Paragraphs
- AI cursor (amber dot with trail) starts at root
- Root summary flashes: "Covers service terms, payments, liabilities, termination..."
- AI evaluates children — "Section 5: Payment Terms" glows bright (selected)
- Other sections dim
- AI drops to Section 5's children
- "5.3: Late Payment Penalties" lights up green
- AI reaches the leaf node — actual text highlights:
  *"Late payments incur 1.5% monthly interest..."*
- Green checkmark: "Answer found"
- Confidence meter: 94%
- A dotted trail shows the path: Root → Section 5 → 5.3 (breadcrumb trail)

**Parallel Paths (2:25 – 2:35):**
- Split view: show 3 documents being traversed simultaneously
- Each has its own AI cursor navigating different trees in parallel
- Label: "Parallel Beam Search"

**Result Assembly (2:35 – 2:45):**
- Results from all paths merge into a clean answer card
- Answer: "Late payment penalties: 1.5% monthly interest (Vendor A), 2% after 30 days (Vendor B), $500 flat fee (Vendor C)"
- Each claim has a source citation with the full path: "Section 5.3, Master Services Agreement"
- Green glow — success state

---

## ACT 4: THE QUERY LANGUAGE — RQL (2:45 – 3:05)

### Scene 4.1 — Familiar Power (2:45 – 3:05)

**Visual:** A code editor with syntax-highlighted RQL queries.

**Narration:**
> "Query your knowledge with RQL — a familiar SQL-like language that combines filtering, search, and reasoning in one query."

**Animation Notes:**
- Dark code editor materializes
- Query types in character by character with syntax highlighting:

```sql
SELECT * FROM contracts
WHERE tags CONTAINS ANY ('vendor', 'nda')
  AND metadata.value_usd > 10000
SEARCH 'payment terms'
REASON 'What are the late fees and penalties?'
LIMIT 5
```

- Each clause highlights as it's explained:
  - `FROM contracts` → "Choose your table" (table icon)
  - `WHERE ...` → "Filter by metadata" (funnel icon)
  - `SEARCH ...` → "Fast keyword search" (magnifying glass, blue)
  - `REASON ...` → "LLM-guided reasoning" (brain icon, amber)
  - `LIMIT 5` → "Top 5 results" (list icon)
- Results panel slides in from the right showing structured results

---

## ACT 5: THE ECOSYSTEM (3:05 – 3:25)

### Scene 5.1 — Full Stack (3:05 – 3:25)

**Visual:** An architecture diagram assembles piece by piece.

**Narration:**
> "ReasonDB is a complete platform — a blazing-fast Rust core, REST API server, CLI tools, a desktop client, and a plugin system that speaks any language."

**Animation Notes:**
- Center: ReasonDB Core (Rust gear icon, electric blue)
- Top: REST API Server (Axum) — radiating connection lines
- Left: CLI terminal icon
- Right: Desktop Client (Tauri app screenshot/mockup)
- Bottom: Plugin slots — Python, Node.js, Bash icons plug in
- Around the outside: Provider logos orbit — OpenAI, Anthropic, Google Gemini, Ollama, Cohere
- Label: "Hot-swap LLM providers at runtime. No restart required."
- Each component animates in with a satisfying "click" sound effect
- Connection lines pulse to show data flow

---

## ACT 6: CLOSING (3:25 – 3:45)

### Scene 6.1 — The Contrast (3:25 – 3:35)

**Visual:** Final side-by-side comparison.

| Vector DB (Old Way) | ReasonDB |
|---|---|
| Shreds documents | Preserves structure |
| Finds "similar" chunks | Finds precise answers |
| Black-box retrieval | Explainable reasoning paths |
| Hallucination-prone | Context-aware, verifiable |

**Narration:**
> "Stop searching. Start reasoning."

**Animation Notes:**
- Two columns animate in
- Left column: dim, red-tinted, each row appears with a subtle "wrong" animation
- Right column: bright, blue/green-tinted, each row appears with a "correct" checkmark
- Rows stagger in for dramatic effect

---

### Scene 6.2 — Call to Action (3:35 – 3:45)

**Visual:** ReasonDB logo, large and centered. URL and GitHub link below.

**Narration:**
> "ReasonDB. AI-Native Document Intelligence. Built for AI agents that need to reason, not just retrieve."

**Animation Notes:**
- Logo pulses with electric blue glow
- Tagline fades in below
- GitHub star icon + URL
- "Get Started" button with subtle hover animation
- Fade to black

---

## VISUAL STYLE GUIDE

### Color System
| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Background | Near-black | `#0A0A0F` | All backgrounds |
| Primary | Electric Blue | `#3B82F6` | ReasonDB brand, data flow, search |
| AI/LLM | Amber | `#F59E0B` | AI operations, reasoning |
| Success | Emerald | `#10B981` | Found answers, correct results |
| Error | Red | `#EF4444` | Failures, old way, problems |
| Text | White | `#F8FAFC` | Primary text |
| Muted | Gray | `#64748B` | Secondary elements, dimmed items |

### Typography
- Headings: Inter Bold or similar geometric sans-serif
- Code/Queries: JetBrains Mono or Fira Code
- Body: Inter Regular

### Motion Principles
- **Ease:** Use ease-out for entrances, ease-in for exits
- **Stagger:** Elements in groups appear with 50–100ms stagger
- **Glow:** Important elements have subtle outer glow matching their color
- **Flow:** Data movement uses particle trails along connection paths
- **Snap:** Components "click" into place with slight overshoot + settle
- **Parallax:** Subtle depth layers in backgrounds (grid, particles)

### Recurring Visual Motifs
- **The Tree:** Always show the document hierarchy as a clean node-edge tree (top-down or radial)
- **The AI Cursor:** Amber dot with comet trail — represents LLM reasoning
- **The Scan Line:** Blue horizontal sweep — represents fast search
- **Particle Trails:** Dots flowing along connection lines — represents data movement
- **Summary Badges:** Small rounded rectangles that appear on tree nodes

### Sound Design Notes (for reference)
- Subtle ambient synth pad throughout
- Satisfying "click" for components connecting
- Soft "whoosh" for scan/search operations
- Gentle "chime" for answer found / success
- Low "buzz" for error/failure states

---

## SHOT LIST SUMMARY

| # | Time | Shot | Key Visual |
|---|------|------|-----------|
| 1 | 0:00 | Document chaos | Scattered 3D documents |
| 2 | 0:15 | The shredder | Document → chunks (broken) |
| 3 | 0:30 | AI failure | Wrong answer, red warning |
| 4 | 0:45 | Logo reveal | ReasonDB logo + tagline |
| 5 | 1:00 | The comparison | Chunks vs. tree (split screen) |
| 6 | 1:15 | Ingestion: Extract | Document → markdown |
| 7 | 1:22 | Ingestion: Structure | Markdown → tree |
| 8 | 1:30 | Ingestion: Summarize | Bottom-up AI summarization |
| 9 | 1:45 | The question | User types natural language query |
| 10 | 1:50 | Phase 1: Filter | Fast BM25 scan, documents narrow |
| 11 | 2:00 | Phase 2: Rank | AI reads summaries, scores docs |
| 12 | 2:15 | Phase 3: Traverse | AI navigates document tree |
| 13 | 2:25 | Parallel paths | Multiple trees traversed simultaneously |
| 14 | 2:35 | Result assembly | Clean answer with citations |
| 15 | 2:45 | RQL query | Code editor, syntax-highlighted query |
| 16 | 3:05 | Architecture | Full platform ecosystem diagram |
| 17 | 3:25 | Comparison table | Old way vs. ReasonDB |
| 18 | 3:35 | Call to action | Logo, tagline, links |

---

## NARRATION FULL SCRIPT (for voiceover recording)

> Your organization runs on documents. Contracts, research papers, compliance manuals — mountains of critical knowledge.
>
> Today's AI tools shred your documents into disconnected chunks. Structure is lost. Context is destroyed.
>
> The result? AI that hallucinates, misses critical context, and gives you wrong answers when it matters most.
>
> Meet ReasonDB. The database that understands your documents.
>
> ReasonDB doesn't shred your documents. It preserves their structure — so AI can reason through them like a human expert.
>
> When you ingest a document, ReasonDB builds a navigable knowledge tree. Every section, heading, and paragraph preserves its place in the hierarchy.
>
> Now watch what happens when you ask a question.
>
> Phase one: fast keyword search narrows thousands of documents to the most relevant candidates in milliseconds.
>
> Phase two: the AI reads each document's summary — like scanning a table of contents — to rank which ones are most promising.
>
> Phase three: the AI navigates each document's tree — reading summaries at each level, choosing the most relevant branches, drilling deeper until it finds the precise answer.
>
> Query your knowledge with RQL — a familiar SQL-like language that combines filtering, search, and reasoning in one query.
>
> ReasonDB is a complete platform — a blazing-fast Rust core, REST API server, CLI tools, a desktop client, and a plugin system that speaks any language.
>
> Stop searching. Start reasoning.
>
> ReasonDB. AI-Native Document Intelligence. Built for AI agents that need to reason, not just retrieve.
