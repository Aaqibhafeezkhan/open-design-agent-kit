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
- **Answer the requests, not rewrite the page.** The runtime maps each original URL to its blob URL where the browser makes the request: `fetch` (three.js's `FileLoader` sends a `Request`), `XMLHttpRequest`, and the `src` of an `<img>` (`ImageLoader`, so `TextureLoader`). The scene script is untouched, so the source file and the export stay the same code.
  - *Changed while building:* the first plan was `DefaultLoadingManager.setURLModifier`. A classic inline script can't reach the module's `THREE`, and the 3D skills give glTF loaders their own `LoadingManager`, which bypasses the default one. Patching the request APIs covers every loader, including the page's own managers.
- **1k by default.** A courtyard-sized scene at 1k is a few MB; base64 adds about a third. That fits in 16 MB with room for the page. 2k and 4k don't.
- **Only declared assets.** The export embeds what the scene spec's `assets` (or the 3D object's `application/od-assets+json` block) lists, not every URL it can find, so it never guesses at what a script loads. For a Poly Haven asset it reads Poly Haven's file list for the asset (the same API `find_open_design_3d_assets` uses) to expand a texture folder to its maps and a glTF to its included files, under the CDN URLs the page requests.
- **Models keep their resolution.** Textures and HDRIs above `maxResolution` are fetched at `maxResolution` and embedded under the page's URL. A lower-resolution glTF names different relative files than the page maps, so models stay as the page has them.

## Risks

- A scene script that loads an asset not listed in its spec still hits the network and is blocked. The artifact preflight reports the remaining host.
- A loader that requests files some other way (a CSS background, a `<video>`, a worker) isn't answered from the page. three.js's loaders aren't affected.
- A texture set embeds every map Poly Haven lists for it (diffuse, normal, roughness, ARM), whichever the page uses.

## Open Questions

- Should non-3D pages with remote images (for example an Unsplash hero) use the same mechanism? Likely yes for images, behind the same option; left out of the first cut.
