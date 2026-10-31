## 0. Decisions

- [ ] 0.1 Iven picks the host, domain and budget cap (design.md, decision 5)

## 1. Storage interface

- [ ] 1.1 `WorkspaceStore` in `packages/core` (read, write, list, stat, delete, materialise); `FsWorkspaceStore` from today's code
- [ ] 1.2 Move every workspace disk access in core and the server behind the store; full unit and browser test suites pass unchanged

## 2. Remote mode

- [ ] 2.1 `--http [--port]`: streamable HTTP at `/mcp`, `/healthz`; integration test with the SDK client
- [ ] 2.2 `OPEN_DESIGN_PROFILE=remote`: always folderless, per-session workspace; `REMOTE_HIDDEN_TOOLS` with a test that every tool is classified
- [ ] 2.3 Object-storage store with session ids, 7-day expiry sweep; tests against a local emulator
- [ ] 2.4 Exports return expiring HTTPS links; the preview fallback points at `publish_open_design_artifact`
- [ ] 2.5 Per-session limits (files, bytes, exports, request rate) with plain-language errors; unit tests
- [ ] 2.6 Bearer token check for the private instance

## 3. Image and deploy

- [ ] 3.1 `deploy/Dockerfile` (Node, bundled server and content, Chromium); container smoke test in CI
- [ ] 3.2 Manual workflow that builds and pushes the image; `deploy/README.md` for the chosen host
- [ ] 3.3 Deploy the private instance

## 4. Verification

- [ ] 4.1 ChatGPT web, developer mode: add the URL, make a poster, see it in chat (view or link), export a PDF and download it
- [ ] 4.2 Claude web custom connector: the same
- [ ] 4.3 Stdio unchanged: plugin and `.mcpb` smoke tests pass
- [ ] 4.4 Write up cost per design and what phase 2 needs
