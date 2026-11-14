# Fox projects

Three separate browser-native AI applications maintained by Monty Kubasek.

| Project | Purpose | Launch | Files |
| --- | --- | --- | --- |
| **Think Fox 1** | Full multi-provider AI workspace | [Open Think Fox 1](think-fox-1/) | [Project documentation](think-fox-1/README.md) |
| **Free Fox** | OpenRouter free-model interface | [Open Free Fox](free-fox/) | [Project documentation](free-fox/README.md) |
| **Fox Four** | Four parallel models followed by MiniMax analysis, synthesis and critique | [Open Fox Four](fox-four/) | [Project documentation](fox-four/README.md) |

## Layout

```text
think-fox-1/       Current v0.8.5 build and project documentation
  releases/        Other builds previously at repository root
  legacy/          Older Think Fox builds and historical landing page
  patches/         Historical patches and assembly scripts
  tools/           Update script and browser patcher
free-fox/          Current root-line v0.1(i) build
  legacy/          Preserved v0.1(a), (c), (f), and (k) builds
fox-four/          Fox Four single-file application
shared/
  avatar/          Engine portraits
  callsign/        Engine logos, including Free Fox logos
  icons/           Shared SVG controls
  images/          Landing-page and app artwork
  legacy/          Historical screenshots, backgrounds and artwork
index.html         Shared landing page
```

The name **Think Fox Legacy** also appears on the landing page, linking to the separately hosted older interface. It is not a fourth current application source tree here. Historical local Think Fox builds live under `think-fox-1/legacy/`.

## Run locally

From the **repository root**:

```bash
python3 -m http.server 8000
```

Open [the landing page](http://localhost:8000/) or a project's launch link above. Keep `shared/` alongside the project folders when deploying. There is no package-install or build step for these HTML apps.

Existing root application URLs are retained as small redirect pages. They preserve query strings and fragments. Browser storage remains scoped to the same origin; no API-key or conversation storage keys were changed.

## Historical files

All original files are retained in their project or shared-asset folders. Known broken builds remain labelled as such; organisation does not certify them as working releases. Free Fox v0.1(k) remains archived where it was previously classified; this reorganisation does not silently promote it over the root-line v0.1(i).

See [the migration inventory](docs/directory-migration.md) for every original path, destination and original Git blob SHA.
