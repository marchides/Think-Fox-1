# Think Fox 1

<p align="center">
  <img src="fox_icon.png" alt="Think Fox logo" width="96">
</p>

<p align="center">
  <strong>Twenty-one AI engines. One browser-native command interface.</strong>
</p>

<p align="center">
  <img src="thinkfox-wall3.png" alt="Think Fox interface" width="100%">
</p>

Think Fox is a multi-provider AI workspace delivered as a single HTML application. Bring your own API keys, switch between curated models, search the web, work with documents, generate images, listen with text-to-speech, and preserve branching conversations—without running an application backend.

**Current release:** v0.7.6.7b<br>
**Author:** Montaigne Kubasek

## Highlights

- **21 curated engines** across the Anvil, Banshee, and Cobalt squadrons
- **OpenRouter or direct APIs** from OpenAI, Anthropic, Google, xAI, Moonshot, Alibaba, DeepSeek, Z.AI, MiniMax, Mistral, NVIDIA, and Tencent
- **Streaming chat and reasoning** with stop, continue, regenerate, and edit controls
- **Persistent conversation branches** with an interactive branch tree
- **Local document workflows** for PDF, DOCX, EPUB, Markdown, text, and code files
- **Bookshelf retrieval** using in-browser TF-IDF search or full-text injection
- **Web search** through OpenRouter, Tavily, Brave Search, or SearXNG
- **Image generation** through supported OpenAI and Google routes
- **Text-to-speech** through OpenAI, ElevenLabs, Deepgram, or MiniMax
- **Local-first project data** stored in `localStorage` and IndexedDB

## Quick start

No package manager or build step is required.

1. Clone or download this repository.
2. Start a static web server from the repository root:

   ```bash
   python3 -m http.server 8000
   ```

3. Open the current application at [http://localhost:8000/thinkfox_1-v0767b.html](http://localhost:8000/thinkfox_1-v0767b.html).
4. Open **Model Parameters → AI API source**.
5. Select a provider, enter your API key, and use **Test connection**.
6. Choose an engine and start a conversation.

You can also open `thinkfox_1-v0767b.html` directly in a modern browser. A local server is recommended because browser security rules can restrict API, file, and clipboard features on `file://` pages.

> `index.html` is the project landing page. Its launch buttons target `thinkfox.html`; when deploying the site, copy or rename the current versioned application to `thinkfox.html`.

## Engine deck

Each engine combines a model mapping, callsign, colour theme, capability profile, default parameters, and concise system prompt. Model availability can change upstream; the in-app provider catalogue is the source of truth for live limits, modalities, parameters, and pricing.

| Squadron | Engines |
| --- | --- |
| **Anvil** | Shuriken, Katana, Tempest, Scythe, Hellblade, Typhoon, Cinder, Glaive |
| **Banshee** | Citadel, Stronghold, Gargoyle, Orbit, Rocketship, Ancestral, Mudcake, Eight Ball, Neon, Harlequin, Dagger |
| **Cobalt** | Monolith, Trident |

OpenRouter exposes the complete deck with one key. Direct-provider mode enables only compatible engines and explains why other engines are locked. Harlequin and Dagger are OpenRouter-only.

## Core capabilities

### Chat and model control

- Server-sent event streaming with collapsible reasoning traces
- Per-engine system prompt, sampling, reasoning, and output-token settings
- Live capability gating for unsupported parameters
- Conversation-aware engine switching and per-engine settings
- Adaptive context trimming, retry with backoff, request timeouts, and partial-output recovery
- Per-session token counts, latency, and estimated cost using live provider pricing

### Conversations and context

- Edit or re-stream any message to create a non-destructive fork
- Navigate sibling branches inline or use the full branch-tree overlay
- Organise conversations with folders, tags, search, and starred messages
- Maintain a user profile, pinned memories, and reusable slash-command prompts
- Export conversations as Markdown or structured JSON

### Documents and media

- Attach images, PDFs, and more than 40 text/code file types
- Store large attachments and generated images in IndexedDB
- Build reference bookshelves from PDF, DOCX, EPUB, TXT, or Markdown
- Render Markdown, syntax-highlighted code, KaTeX maths, and Mermaid diagrams
- Generate images inline and play responses with configurable text-to-speech

### Search

The **Search** pill can use the OpenRouter web plugin or call Tavily, Brave Search, or a CORS-enabled SearXNG instance. Search results, attachments, books, and memories are clearly framed as untrusted context before being sent to a model.

## Screenshots

| Engine selection | Model parameters | Conversation branches |
| --- | --- | --- |
| ![Engine selector](selectengine.png) | ![Model parameters](modelparameters.png) | ![Conversation branch tree](branches.png) |

| Bookshelf | Memories | Prompt templates |
| --- | --- | --- |
| ![Bookshelf](bookshelf.png) | ![Memories](memories.png) | ![Prompt templates](prompttemplate.png) |

## Data and privacy

Think Fox has no application server, account system, analytics, or cookies. Its local data is split as follows:

| Data | Browser storage |
| --- | --- |
| Conversations, settings, API keys, memories, prompts, and folders | `localStorage` |
| Attached and generated images | IndexedDB `thinkfox_store/images` |
| Chat documents | IndexedDB `thinkfox_store/files` |
| Bookshelf documents | IndexedDB `thinkfox_bookshelf` |
| Model capability cache | `localStorage` with a six-hour TTL |

API keys remain in the browser, but prompts and any selected context are sent directly to the provider or search service you configure. Use Think Fox on a trusted device, review each provider's data policy, and avoid attaching secrets you do not intend to transmit. Clearing site data removes locally stored Think Fox content unless you exported a backup.

External libraries—including KaTeX, highlight.js, Mermaid, PDF.js, Mammoth, and JSZip—load from CDNs, so the interface is not fully offline by default.

## Repository layout

```text
.
├── index.html                  # Project landing page
├── thinkfox_1-v0767b.html     # Current single-file application
├── avatar/                    # Full-size engine artwork
├── callsign/                  # Engine logos and compact artwork
├── legacy/                    # Previous application releases
└── *.png                      # README and landing-page assets
```

When releasing a new version, keep the version shown in the application, landing page, filename, and this README aligned. Retain older builds under `legacy/` when historical releases are needed.

## Browser support

A current desktop or mobile browser with JavaScript, `localStorage`, IndexedDB, `fetch`, and streaming response support is required. Provider APIs must permit browser-origin requests; some services or self-hosted endpoints may require CORS configuration. Brave Search commonly blocks direct browser requests, depending on the plan and endpoint.

## License

© 2026 Montaigne Kubasek. Think Fox 1. All rights reserved.

---

<p align="center"><em>Pick an engine. Bring a key. Keep your workflow.</em> 🦊</p>
