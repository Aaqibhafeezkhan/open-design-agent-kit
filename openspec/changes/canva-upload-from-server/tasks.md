## 1. Core

- [x] 1.1 `uploadToCanva` in `generation/canvaUpload.ts`: canva.com https URL only, file in the artifact's `exports/`, one octet-stream POST, `fileId` or a retry message
- [x] 1.2 Route B instructions call `publish_open_design_artifact_to_canva` with `filePath` and `uploadUrl`; no `curl`
- [x] 1.3 Unit tests: URL guard, path guard, request shape, refused and unreachable cases, instructions

## 2. Hosts and docs

- [x] 2.1 MCP server and VS Code tool accept `filePath` and `uploadUrl` and return the upload outcome
- [x] 2.2 `docs/reference/tools.md`

## 3. Verification

- [ ] 3.1 In Claude Desktop Chat with a folder and the Canva connector, choose the private upload and confirm the file appears in Canva Uploads (needs a release with this change)
