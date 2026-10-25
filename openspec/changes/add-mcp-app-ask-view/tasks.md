## 1. Core

- [x] 1.1 Ask schema type, validator and limits in `mcpApp/protocol.ts`; answer message builder (readable and machine lines); tests
- [x] 1.2 Ask renderer and feedback chips in `mcpApp/main.ts`, styles in `appCss.ts`; copy-answers fallback
- [x] 1.3 `imageRef` resolution in `preview/server/mcpApp.ts` through the app-only state tool, with the existing size caps

## 2. Server

- [x] 2.1 `show_open_design_questions` in `packages/mcp-server` with preview `_meta`, MCP Apps list filter and text fallback; tests

## 3. Skills and docs

- [x] 3.1 Overview, `open-design-new`, `open-design-explore` skills: ask through the view where available; read the answers line; regenerate copies
- [x] 3.2 `docs/guides/inline-preview.md`, `docs/reference/tools.md`
- [ ] 3.3 Try in Claude Desktop Chat: a vague poster request, a direction pick; note what the host does with the message (needs a server release past the plugin pin; the device-link route draws no MCP Apps)
