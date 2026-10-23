## Why

Route B of the Canva flow (private upload) told the agent to POST the export to Canva's single-use upload URL with `curl` from its own terminal. In Claude Desktop Chat with a folder (2026-10-23), that failed: Claude's shell on the device was still booting ("Workspace still starting"), and it had to guess where the export lived (`$HOME/mnt/*/...`). The terminal step also assumes the agent's shell can see the file and reach canva.com, which isn't true for every host.

The Open Design server already runs where the export is and has the network, so it can send the bytes itself.

## What Changes

- `publish_open_design_artifact_to_canva` gains two optional inputs, `filePath` and `uploadUrl`. With both, it POSTs the file's raw bytes (`Content-Type: application/octet-stream`) to the URL and returns the outcome (the `fileId`, or why it failed) instead of instructions. With neither, it composes the instructions as before.
- Guards: the URL must be https on `canva.com` or a subdomain, and the file must be in the artifact's `exports/` folder (the same rule as `publish_open_design_artifact`'s `includeFiles`). Otherwise nothing is sent.
- Route B's instructions call the tool again with those inputs instead of `curl`. A used or expired URL is still replaced through `create-upload-url`.
- Both hosts (VS Code tool, MCP server) share the upload code in core (`generation/canvaUpload.ts`).
- The capability's "our code never talks to Canva" rule narrows to: our code talks to Canva only to send a private upload the user chose, to a URL Canva issued.

## Capabilities

### Modified Capabilities
- `canva-publishing`: route B is sent by the server.

## Impact

- `packages/core/src/generation/canvaUpload.ts` (new), `publishCanvaTemplateInstructions.ts`, their unit tests.
- `packages/mcp-server/src/index.ts`, `tools.ts`; `packages/vscode/package.json`, `src/tools/publishCanvaTemplateTool.ts`.
- `docs/reference/tools.md`.
