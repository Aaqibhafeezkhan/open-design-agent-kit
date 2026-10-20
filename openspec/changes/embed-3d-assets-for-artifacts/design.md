## Context

The spike page (`https://claude.ai/artifact/FS75ueHyxgyUyc2xsBkPwS`) gave these results in the artifact viewer:

| Technique | Result |
|---|---|
| `fetch` from Poly Haven | blocked |
| `<img>` from another site | blocked |
| `fetch` of a `data:` URI | blocked |
| `fetch` of a `blob:` URL | works |
| embedded texture in WebGL | works |
| three.js from jsDelivr | works |

## Decisions

- **Base64 in one JSON block, blob URLs at load.** `data:` URIs can't be fetched, and three.js's `FileLoader` fetches. Blob URLs created from embedded bytes can. One block keeps the page parseable and lets the size report count it.
- **URL modifier, not rewriting the page.** The 3D skills already route glTF relative paths through a `LoadingManager` URL modifier. Mapping original CDN URLs to blob URLs in the same place leaves the scene script untouched, so the source file and the export stay the same code.
- **1k by default.** A courtyard-sized scene at 1k is a few MB; base64 adds about a third. That fits in 16 MB with room for the page. 2k and 4k don't.
- **Only declared assets.** The export embeds what the scene spec's `assets` (or the 3D object comment) lists, not every URL it can find, so it never guesses at what a script loads.

## Risks

- A scene script that loads an asset not listed in its spec still hits the network and is blocked. The artifact preflight reports the remaining host.
- Scripts that create their own loaders without a manager bypass `DefaultLoadingManager`. The runtime also wraps `fetch` for exact matches of embedded URLs as a fallback.

## Open Questions

- Should non-3D pages with remote images (for example an Unsplash hero) use the same mechanism? Likely yes for images, behind the same option; left out of the first cut.
