# Think Fox 1

<p align="center">
  <img src="fox_icon.png" alt="Think Fox logo" width="96">
</p>

<p align="center">
  <strong>Twenty-two AI engines. One browser-native command interface.</strong>
</p>

<p align="center">
  <img src="thinkfox-wall3.png" alt="Think Fox interface" width="100%">
</p>

Think Fox is a multi-provider AI workspace delivered as a single HTML application. Bring your own API keys, switch between curated models, organise work into Projects with searchable context retrieval, connect GitHub repositories, search the web, work with documents, generate images, listen with text-to-speech, and preserve branching conversations—without running an application backend.

**Current release:** v0.7.7.7<br>
**Author:** Monty Kubasek

## Highlights

- **22 curated engines** across Command Core, Vector Wing, Strike Squadron, Oracle Wing, and Hammer Division
- **OpenRouter or direct APIs** from OpenAI, Anthropic, Google, xAI, Moonshot, Alibaba, DeepSeek, Z.AI, MiniMax, Mistral, NVIDIA, and Tencent
- **Projects and Workplaces** for organising conversations, memories, and context per workstream
- **GitHub repo access** with fine-grained PAT, tree browsing, file sync, SHA-guarded writes, and patch export
- **Project context retrieval** with lexical search, scored chunk selection, and token-budgeted injection
- **Streaming chat and reasoning** with stop, continue, regenerate, and edit controls
- **Persistent conversation branches** with an interactive branch tree
- **Local document workflows** for PDF, DOCX, EPUB, Markdown, text, and code files
- **Bookshelf retrieval** using in-browser TF-IDF search or full-text injection
- **Web search** through OpenRouter, Tavily, Brave Search, or SearXNG
- **Image generation** through supported OpenAI and Google routes
- **Text-to-speech** through OpenAI, ElevenLabs, Deepgram, or MiniMax
- **Diagnostics and repair tools** with emergency backup export
- **Workplace export/import** as a single JSON file—GitHub tokens never included
- **Local-first data** stored in `localStorage` and IndexedDB

## Quick start

No package manager or build step is required.

1. Clone or download this repository.
2. Start a static web server from the repository root:

   ```bash
   python3 -m http.server 8000
   ```

3. Open the current application at [http://localhost:8000/thinkfox_1-v0777.html](http://localhost:8000/thinkfox_1-v0777.html).
4. Open **Model Parameters → AI API source**.
5. Select a provider, enter your API key, and use **Test connection**.
6. Choose an engine and start a conversation.

You can also open `thinkfox_1-v0777.html` directly in a modern browser. A local server is recommended because browser security rules can restrict API, file, and clipboard features on `file://` pages.

> `index.html` is the project landing page. Its launch buttons target `thinkfox.html`; when deploying the site, copy or rename the current versioned application to `thinkfox.html`.

## Engine deck

Each engine combines a model mapping, callsign, colour theme, capability profile, default parameters, and concise system prompt. Model availability can change upstream; the in-app provider catalogue is the source of truth for live limits, modalities, parameters, and pricing.

| Division | Engines |
| --- | --- |
| **Command Core** | Shuriken, Katana, Tempest, Supercell, Cinder |
| **Vector Wing** | Scythe, Hellblade, Typhoon, Trident, Glaive |
| **Strike Squadron** | Orbit, Rocketship, Ancestral, Citadel, Stronghold |
| **Oracle Wing** | Mudcake, Gargoyle, Eight Ball, Neon |
| **Hammer Division** | Monolith, Dagger, Harlequin |

OpenRouter exposes the complete 22-engine deck with one key. Direct-provider mode enables only compatible engines and explains why other engines are locked. Harlequin and Dagger are OpenRouter-only.

Latest engine colour/artwork updates:

| Engine | Colour | Asset paths |
| --- | --- | --- |
| **Supercell** | Pure white `#FFFFFF` | `avatar/supercell.png`, `callsign/logo-sup-small.png`, `callsign/supercell.png` |
| **Tempest** | Pearl silver `#D9DDE3` | `avatar/tempest.png`, `callsign/logo-tem-small.png`, `callsign/tempest.png` |
| **Dagger** | Medium silver `#9CA3AB` | `avatar/dagger.png`, `callsign/logo-dag-small.png`, `callsign/dagger.png` |
| **Citadel** | Gunmetal grey `#646A73` | `avatar/citadel.png`, `callsign/logo-cit-small.png`, `callsign/citadel.png` |

## Core capabilities

### Chat and model control

- Server-sent event streaming with collapsible reasoning traces
- Per-engine system prompt, sampling, reasoning, and output-token settings
- Live capability gating for unsupported parameters
- Conversation-aware engine switching and per-engine settings
- Adaptive context trimming, retry with backoff, request timeouts, and partial-output recovery
- Per-session token counts, latency, and estimated cost using live provider pricing

### Projects and Workplaces

- Organise conversations into Projects inside Workplaces
- Assign, move, filter, archive, and delete Projects
- Project colour, icon, description, and status (Active / Paused / Archived)
- Project memories: manual entries and conversation summaries with pin, enable, and stale tracking
- Project context index: conversations chunked into searchable segments with lexical search
- Project context modes: Off, Pinned only, Pinned + Summaries, and Search
- Budget-limited retrieval with scored chunk selection and used-context inspection
- Workplace export/import as a single JSON backup with full round-trip fidelity

### GitHub repo access

- Connect a Project to a GitHub repository using a fine-grained personal access token
- Browse the repository tree with include/exclude glob filters
- Sync selected files into the Project context index
- Retrieve relevant repo files during conversation via scored search
- Write modes: update existing file, create new file, export `.patch` locally
- SHA-guarded writes with diff preview and explicit confirmation before commit
- Stale detection when remote files change after sync
- Token stored locally only and never included in Workplace exports

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

### Diagnostics and repair

- Built-in diagnostics panel showing system state, storage estimates, stale items, and orphan records
- Repair tools: fix orphan conversations, rebuild Project index, export emergency backup
- Schema migration system with automatic backup before upgrade
- Release notes accessible from the sidebar

## Screenshots

| Engine selection | Model parameters | Conversation branches |
| --- | --- | --- |
| ![Engine selector](icons/tf-engine-select.svg) | ![Model parameters](icons/tf-engine-parameters.svg) | ![Conversation branch tree](icons/tf-conversation-branches.svg) |

| Bookshelf | Memories | Prompt templates |
| --- | --- | --- |
| ![Bookshelf](icons/tf-book-shelf.svg) | ![Memories](icons/tf-memories.svg) | ![Prompt templates](icons/tf-prompt-library.svg) |

## Data and privacy

Think Fox has no application server, account system, analytics, or cookies. Its local data is split as follows:

| Data | Browser storage |
| --- | --- |
| Conversations, settings, API keys, memories, prompts, and folders | `localStorage` |
| Projects, Project memories, context modes, and retrieval settings | `localStorage` (scoped per Workplace) |
| Project context index (conversation chunks, summaries, repo files) | IndexedDB `thinkfox_project_context` |
| GitHub file contents | IndexedDB `thinkfox_github_files` |
| GitHub tokens | `localStorage` (never exported) |
| Attached and generated images | IndexedDB `thinkfox_store/images` |
| Chat documents | IndexedDB `thinkfox_store/files` |
| Bookshelf documents | IndexedDB `thinkfox_bookshelf` |
| Model capability cache | `localStorage` with a six-hour TTL |

API keys and GitHub tokens remain in the browser, but prompts and any selected context are sent directly to the provider, GitHub API, or search service you configure. Use Think Fox on a trusted device, review each provider's data policy, and avoid attaching secrets you do not intend to transmit. Clearing site data removes locally stored Think Fox content unless you exported a backup.

Workplace exports include conversations, Projects, memories, context index, canvas, attachments, and settings—but never GitHub tokens. Imported Workplaces restore GitHub connections as disconnected, requiring the user to re-enter tokens.

External libraries—including KaTeX, highlight.js, Mermaid, PDF.js, Mammoth, and JSZip—load from CDNs, so the interface is not fully offline by default.

## Repository layout

```text
.
├── index.html # Project landing page
├── thinkfox_1-v0777.html # Current single-file application
├── icons/ # Topbar SVG icon set
│ ├── tf-engine-select.svg
│ ├── tf-engine-parameters.svg
│ ├── tf-memories.svg
│ ├── tf-prompt-library.svg
│ ├── tf-book-shelf.svg
│ ├── tf-workplaces.svg
│ ├── tf-canvas.svg
│ ├── tf-artifacts.svg
│ ├── tf-starred-messages.svg
│ ├── tf-conversation-branches.svg
│ └── tf-export-conversation.svg
├── avatar/ # Full-size engine artwork
├── callsign/ # Engine logos and compact artwork
├── legacy/ # Previous application releases
└── *.png # README and landing-page assets
```

When releasing a new version, keep the version shown in the application, landing page, filename, and this README aligned. Retain older builds under `legacy/` when historical releases are needed.

## Version history

| Version | Milestone |
| --- | --- |
| v0.7.7.1 | Projects Foundation — organisational layer inside Workplaces |
| v0.7.7.2 | Project Memories — manual and generated memory with pin/enable controls |
| v0.7.7.3 | Project Context Index — chunked conversation indexing with lexical search |
| v0.7.7.4 | Project Retrieval — scored search, budget-limited injection, used-context inspector |
| v0.7.7.5 | GitHub Repo Access — PAT connection, tree browsing, file sync, SHA-guarded writes |
| v0.7.7.6 | Polish, Hardening, Release Candidate — schema freeze, migration, diagnostics, repair |
| v0.7.7.7 | Supercell update — added Z.ai GLM 5.3, own Supercell artwork paths, and revised Tempest/Dagger/Citadel colours |

## Browser support

A current desktop or mobile browser with JavaScript, `localStorage`, IndexedDB, `fetch`, and streaming response support is required. Provider APIs must permit browser-origin requests; some services or self-hosted endpoints may require CORS configuration. Brave Search commonly blocks direct browser requests, depending on the plan and endpoint.

## License

Think Fox 1 is an AI interface created by Monty Kubasek · monty@middleroad.au

---

<p align="center"><em>Pick an engine. Bring a key. Keep your workflow.</em> 🦊</p>
