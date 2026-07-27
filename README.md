# 🦊 Think Fox 1

**A single-file, browser-native, multi-engine AI command interface.**

Think Fox is a complete AI chat client that runs entirely in your browser from one HTML file. No build step, no server, no account, no telemetry. Connect with your own API keys — via OpenRouter for the full engine deck, or directly to any of 12 source-company APIs — and everything (conversations, memories, books, images, settings) stays in your browser.

**Current Version:** v0.7.4 (with updates) · **Author:** Montaigne Kubasek

---

## Quick Start

1. Clone git repo (All files and folders, main files: `index.html` and the actual interface `thinkfox_1-v074-updated.html**`. Folders `avatar/` and `callsign/` are for optional image files).
2. Rename `thinkfox_1-v074-updated.html**` to `thinkfox.html`.
3. Open it in any modern browser — or serve it locally (`python -m http.server`).
4. Open **Model Parameters → AI API source**, pick a provider, paste your API key.
5. Chat.

** `thinkfox_1-v074-updated.html` is the file name at time of writing. This will be updated regularly to latest version number.

That's it. No install, no dependencies to manage — external libraries (KaTeX, highlight.js, Mermaid, PDF.js, Mammoth, JSZip) load from CDNs.

---

## The Engine Deck

16 themed "engines" — each a curated model with its own personality prompt, colour theme, avatar, and tuned defaults — organised into four families:

| Family | Engines | Underlying Models |
|---|---|---|
| **Anvil** | Tempest, Scythe, Typhoon, Katana, Shuriken | GLM 5.2, Qwen 3.7 Max, DeepSeek V4 Pro, Kimi K3, Kimi K2.6 |
| **Banshee** | Orbit, Ancestral, Citadel, Gargoyle, Eight Ball | Claude Opus 4.8, Claude Fable 5, GPT-5.3 Chat, Gemini Pro, Grok |
| **Cobalt** | Monolith, Cinder, Neon, Glaive | Mistral Large 2512, MiniMax M3, Nemotron 3 Ultra 550B, Hunyuan 3 |
| **Dire** | Harlequin, Dagger | Hermes 3 Llama 405B, Dolphin Mistral 24B Venice (OpenRouter-only, unfiltered) |

- Full-screen engine selector with **live model stats** (context length, max output, modalities, supported parameters, per-million pricing) pulled from the provider's model catalogue
- Per-conversation engine memory — sessions reopen with the engine they were created with
- Per-engine theming: accent colour, glow, grid background, sidebar art (avatar or logo mode)
- Special **Kimi K3 handling**: preserved reasoning round-tripping, fixed Max-effort thinking, and automatic stripping of unsupported sampling fields

## Multi-Provider API Layer

- **OpenRouter** — one key unlocks all 16 engines
- **Direct source APIs** — OpenAI, Anthropic, Google Gemini, xAI, Moonshot, Alibaba DashScope, DeepSeek, Z.AI, MiniMax, Mistral, NVIDIA NIM, Tencent TokenHub
- Direct mode automatically **locks incompatible engines** (greyed tiles with lock reasons) and falls back gracefully
- Native **Anthropic Messages API** translation (system prompt extraction, content-block conversion, image blocks, thinking deltas)
- Editable **OpenAI-compatible base URL** per provider (point at proxies or self-hosted gateways)
- Connection tester with latency readout, model catalogue matching, and 6-hour capability caching
- Automatic `max_tokens` ↔ `max_completion_tokens` fallback retry when a provider rejects the field
- Keys stored only in `localStorage` — never sent anywhere except the provider you chose

## Chat & Streaming

- SSE streaming with **live reasoning traces** in a collapsible panel
- Batched, requestAnimationFrame-throttled rendering for smooth long streams
- Stop button mid-stream (partial output is preserved and saved)
- **Continue** button when output hits the token limit
- Regenerate / **Re-stream from here** on any assistant message
- **Edit assistant responses** inline; edit user messages to fork
- Per-message actions: Copy, Star, Edit, TTS, Refresh
- Copy with reasoning stripped; clipboard fallback for non-secure contexts
- Auto-scroll with smart follow detection and a "Jump to latest" pill
- Thinking indicator with per-engine artwork
- 1,000,000-character input box with live char/token estimate, drag-to-resize grip, and mobile-safe layout

## Conversation Branching

- Every edit or re-stream creates a **fork** — nothing is ever overwritten
- Inline ← → branch navigation on any message with siblings
- Full **branch tree overlay**: visual tree of every fork, click any node to switch the active path
- Root-level branching supported (fork from the very first message)

## Markdown & Rich Rendering

- Custom sanitising Markdown renderer (headings, lists, tables, blockquotes, nested code fences, inline formatting, safe links)
- **Syntax highlighting** via highlight.js
- **LaTeX math** via KaTeX (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`)
- **Mermaid diagrams** rendered from ```` ```mermaid ```` blocks (strict security mode)
- Search citations rendered as numbered source links

## Bookshelf + RAG

- Upload or paste reference documents — **PDF, DOCX, EPUB, TXT, Markdown** — up to 5M characters each
- Stored in **IndexedDB** (no localStorage limits)
- **Smart retrieval (TF-IDF RAG)**: only relevant passages are injected per message, with paragraph-aware chunking and cosine-similarity ranking
- Full-text injection mode for large-context models, with context-budget warnings
- Activate/deactivate books per shelf; live char/token accounting

## Attachments

- **Images** (vision-capable engines), stored in IndexedDB with legacy migration
- **PDFs** with in-browser text extraction (PDF.js)
- **Text/code files** — 40+ extensions (`.py`, `.ts`, `.rs`, `.sql`, `.yaml`, …)
- Attached documents injected as clearly-fenced **untrusted content** with prompt-injection guards
- Per-message file chips, removable previews, size caps (1.5M chars/file, 3M total per message)

## Web Search

- Toggle-pill search on any message, with your choice of backend:
  - **OpenRouter web plugin**
  - **Tavily** (direct)
  - **Brave Search** (direct)
  - **SearXNG** (self-hosted)
- Results injected as untrusted reference context with injection-hardened framing
- Inline **source citations** on responses, including streamed annotation capture

## Image Generation

- Inline image generation via direct provider keys:
  - **OpenAI** (gpt-image-1.5 / gpt-image-1 / gpt-image-1-mini / DALL·E 3) with size and quality control
  - **Google Gemini** image models with aspect ratio and 1K/2K/4K resolution
- Generated images stored in IndexedDB with the prompt as metadata
- Dedicated Image Mode pill (auto-enabled only for supported engine/provider combos)

## Text-to-Speech

Four providers, configurable in-app:

- **OpenAI** (tts-1 / tts-1-hd, 6 voices)
- **ElevenLabs** (any voice ID)
- **Deepgram Aura** (10 voices)
- **MiniMax T2A v2** (14 voices, hex-audio decoding)

With smart sentence-aware chunking, sequential playback, speed control (0.5×–2×), Markdown stripping, a test button, and robust audio error handling.

## Memories & Profile

- Persistent memory notes (up to 40,000 chars each) with categories and **pin-to-inject** control
- Pinned memories injected into every request as explicitly untrusted background context (240K char budget)
- **JSON export/import** with merge or replace modes and timestamp conflict resolution
- User profile name (or anonymous mode) shown on messages and shared as guarded profile context
- First-run name prompt, fully skippable

## Prompt Library

- Saveable, searchable prompt templates with categories
- **Slash commands**: type `/` in the chat box for a keyboard-navigable inline picker
- Editable starter cards on the welcome screen
- Ships with sane defaults; fully replaceable

## Conversation Management

- Sessions saved to localStorage with automatic **size management** (message trimming, aggressive compaction, oldest-first eviction) — never silently corrupts
- **Folders** with custom colours and drag-and-drop assignment
- **Coloured tags** per conversation (with optional hex syntax `Work:#FF5500`)
- Full-text conversation search (titles, tags, message content)
- Rename, delete (with IndexedDB image/file cleanup)
- **Starred messages** overlay — jump straight to any starred response in any conversation
- **Export** as Markdown or structured JSON (with reasoning, engines, citations, usage)

## Model Parameters (per-engine)

- System prompt override / personality replacement
- Temperature, Top-P, Top-K, frequency/presence/repetition penalties, seed
- **Live capability gating** — unsupported parameters are greyed out and omitted from requests
- Reasoning effort: Off → Minimal → Low → Medium → High → X-High → Max (cyclable from the chat pill)
- Include/exclude reasoning trace in stream
- Max output tokens: 10 presets from 1K to **1,048,576**, plus dynamic "Max Possible" using live model limits and a custom field
- All settings stored **separately per engine**

## Reliability

- **Adaptive context management** — trims only older API context to fit the live context window; saved conversation stays intact, with an explicit note to the model
- **Transient retry** — exponential backoff with Retry-After support for 429/5xx/timeouts
- Per-request timeout + 90s stream-stall detection
- Mid-stream error recovery — partial output is always saved
- Token budgeting with prompt-size clamping and clear "prompt too large" errors

## Usage Tracking

- Per-session token counters (prompt / completion / total)
- **Live cost estimation** from provider pricing, including cached-token pricing
- Latency ping in the sidebar with 15-minute background health checks

## UI/UX

- Dark, glassmorphic themed interface with per-engine dynamic colour system
- **Resizable, collapsible sidebar** (drag handle, double-click reset, persisted width)
- Full responsive mobile layout with safe-area insets
- Toast notifications, keyboard shortcuts (`Ctrl+K` new chat, `Ctrl+Enter` send/stop, `Esc` closes overlays in order)
- `content-visibility` message virtualisation for long chats
- CSP-hardened page (`form-action 'none'`, `object-src 'none'`, upgrade-insecure-requests)

---

## Privacy

- **Zero backend.** All requests go directly from your browser to the API provider you configured.
- API keys, conversations, memories, and documents never leave your machine.
- `noindex, nofollow` meta; no analytics; no cookies.
- Attached documents, search results, and memories are all framed as **untrusted data** in the prompt to resist injection.

## Storage Architecture

| Data | Location |
|---|---|
| Conversations, settings, keys, memories, prompts, folders | `localStorage` (auto-compacted at ~4MB) |
| Images (attached + generated) | IndexedDB `thinkfox_store/images` |
| Chat documents (PDF/text) | IndexedDB `thinkfox_store/files` |
| Bookshelf documents | IndexedDB `thinkfox_bookshelf` |
| Model capability cache | `localStorage` (6h TTL) |

## 📄 License

© 2026 Montaigne Kubasek. Think Fox 1. All rights reserved.

---

*Think Fox — pick an engine, bring a key, keep your data.* 🦊
