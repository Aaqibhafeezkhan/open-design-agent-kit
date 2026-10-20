## Why

3D scenes and 3D objects are the one kind of kit design that breaks as a Claude artifact. They load HDRIs, textures and `.glb` models from Poly Haven while the page runs. Iven ran the artifact test page on 20 Oct 2026, and the viewer blocked the Poly Haven fetch and an external image, and also blocked `fetch` of a `data:` URI, which three.js loaders use. What passed points to the fix: `blob:` URLs, an embedded texture in WebGL, and three.js loaded from jsDelivr all worked. Artifacts can't carry the files as extra files either: `.glb` and `.hdr` were refused, with or without a content type.

## What Changes

- **New standalone export option `embedAssets`.** For pages that declare their remote assets (a `3d-scene` page's scene spec `assets`, or a `3d-object` page's `application/od-assets+json` block), the export downloads each asset, embeds it in the page as base64 in one `application/od-embedded-assets+json` block, and adds a small inline runtime that, before the scene script runs, turns each into a `blob:` URL and answers `fetch`, XHR and `<img>` requests for the original URL with it (see design.md for why not a loading-manager URL modifier). glTF models keep their relative files: each included file is embedded under its CDN URL.
- **Resolution.** Poly Haven assets are fetched at 1k by default (the 3D skills' default already), with a `maxResolution` override. 2k and 4k assets won't fit in 16 MB.
- **Size report.** The result lists each embedded asset with its bytes and the page total; it warns from 12 MB and fails above 16 MB, naming the biggest assets.
- **The `claude-artifact` provider** (add-claude-artifact-provider) turns `embedAssets` on for pages that have declared remote assets, so the artifact preflight no longer reports their hosts.
- **Fail soft.** An asset that can't be downloaded is reported and left as a remote URL (which the artifact viewer will block), not a broken export.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `artifact-export`: Standalone HTML Export gains `embedAssets`, the blob-URL runtime and the size report.
- `artifact-publishing`: the `claude-artifact` provider embeds declared assets.

## Impact

- `packages/core`: `export/embedAssets.ts` (collect from the scene spec or asset comment, download with the polite fetch used by `search_open_design_3d_assets`, base64, runtime injection), `exportArtifact.ts` (option), `generation/publishInstructions.ts` (claude-artifact recipe turns it on).
- MCP server, VS Code tool and CLI: `embedAssets` and `maxResolution` on export (`--embed-assets`).
- Network: the export downloads the assets the page already loads at runtime, from the same CDN. Nothing new is uploaded.
- Docs: 3D guides and the export reference.
