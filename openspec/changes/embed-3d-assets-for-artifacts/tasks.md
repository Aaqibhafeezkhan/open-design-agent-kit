## 1. Asset collection and embedding (core)

- [x] 1.1 Read declared assets from the `application/od-scene+json` block (`assets[].url`) and the 3D object asset block (`application/od-assets+json`); expand glTF to its referenced files
- [x] 1.2 Download with the polite fetch used for 3D asset search; pick 1k Poly Haven files unless `maxResolution` says otherwise
- [x] 1.3 Write the `application/od-embedded-assets+json` block and the inline runtime (blob URLs answered for `fetch`, XHR and `<img>`; see design.md) before the first module script
- [x] 1.4 Size report: per-asset bytes, total, warning from 12 MB, error above 16 MB naming the largest assets
- [x] 1.5 Fail soft on download errors: report and keep the remote URL

## 2. Export surfaces

- [x] 2.1 `embedAssets` and `maxResolution` on `export_open_design_artifact` (MCP, VS Code) and `--embed-assets` / `--max-resolution` on the CLI
- [x] 2.2 `claude-artifact` provider turns `embedAssets` on when the page declares remote assets

## 3. Tests

- [x] 3.1 Unit: runtime maps an original URL to a blob URL; glTF with relative bin and textures; missing asset reported
- [ ] 3.2 Headless render of the embedded courtyard example with the network blocked renders the same as the online page (check screenshot diff)
- [ ] 3.3 Size: courtyard at 1k stays under 12 MB

## 4. Verification and docs

- [ ] 4.1 Publish the courtyard example as an artifact and confirm it renders in the viewer
- [x] 4.2 3D scenes and 3D objects guides, export reference
