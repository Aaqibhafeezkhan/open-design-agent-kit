## 0. Spikes

- [ ] 0.1 Codex: check that an MCP server can bind a loopback port and launch a headed browser under each sandbox mode; record the result in design.md Open Questions
- [x] 0.2 WSL (the user's setup): headed puppeteer with Linux Chrome under WSLg works (one app window, ~0.9 s); the `cmd.exe /c start` fallback is still to be checked by hand
- [ ] 0.3 Confirm how Claude Code, Codex CLI and Cursor display MCP `image` items from tool results, and note it in docs

## 1. Move shared preview code to core (no behaviour change)

- [x] 1.1 Split `core/src/workspace/artifactComments.ts` into `artifactCommentTypes.ts` (pure type + helpers) and the fs module; drop the duplicate type in `vscode/src/webview/dom/commentOverlay.ts`
- [x] 1.2 Move `webview/bridge/{main,protocol}.ts` and `webview/dom/{elementTargeting,commentOverlay,sourcePatches}.ts` to `core/src/preview/`; update VS Code imports and `.esbuild.ts` (bridge entry from core)
- [x] 1.3 Add a unit test that fails if a browser-target file under `core/src/preview` imports `node:`
- [x] 1.4 Run the VS Code unit suite (the repo has no test-electron suite; the bridge test runs in real Chromium) and the core suite; commit the move on its own

## 2. Comment model and controller

- [x] 2.1 Implement `selectorFor()` (id → stable attribute → classes under an anchored ancestor → nth-of-type, verified unique) with unit tests on fixture DOMs, including Tailwind-style classes
- [x] 2.2 Add `text`, `rect` (document coords), `viewport`, `screenshot`, `host` to `ArtifactComment` and the bridge `select` snapshot; stop storing `auto-` ids in comments; strip `auto-` ids in `serializeDocument`
- [x] 2.3 Add the text-excerpt step to `resolveCommentAnchor`
- [x] 2.4 Replace `writeArtifactComments` with `updateArtifactComments(mutator)`: merge by id (later `updatedAt` wins), temp file + rename; tests for concurrent writers
- [x] 2.5 Extract `commentController.ts` (list, pins, input, statuses, send) over a `HostTransport` from `webview/main.ts`; switch the VS Code webview to it and send changed comments only
- [ ] 2.6 VS Code regression pass: Comment, Send to chat, Edit and Tweaks on served and srcdoc previews

## 3. Preview server and launcher (core)

- [x] 3.1 `previewServer.ts`: shell origin (shell assets, comments API, SSE) and design origin (`startStaticServer` + bridge injection) on two loopback ports, each with its own 128-bit token; Origin check, body caps, write allow-list
- [x] 3.2 Security tests: missing token → 404, design-origin request to the API rejected, `../` → 403, write outside `<entry>.comments*` refused
- [x] 3.3 File watching with a debounce (per-folder watches on Linux, where Node's recursive watch loses files replaced by rename), and the sidecar watch; SSE `source-updated` / `comments-updated` / `checks-updated`
- [x] 3.4 `openPreviewWindow.ts`: headed puppeteer-core (`--app`, persistent profile in the OS cache dir, 5 s appear timeout) → default browser (incl. WSL) → not opened; `OPEN_DESIGN_PREVIEW_BROWSER=default`; window reuse and navigation; tests with injected launchers
- [x] 3.5 `captureCrop.ts`: CDP clip of the shell page (iframe offset + rect + 24 px, ≤800 px) and a headless re-render fallback through `openArtifactPage`; save to `<entry>.comments/<id>.png`; delete the crop with its comment

## 4. Browser shell

- [x] 4.1 `core/src/preview/shell/`: toolbar, View/Comment modes, artifact picker when no entry is given, fetch + EventSource transport, reload keeping mode and scroll
- [x] 4.2 Comment UI from `commentController`, overlays hidden during crop, Bridge Availability message
- [x] 4.3 Send to agent: mark `sent`, copy the instruction, show the paste hint
- [x] 4.4 Checks panel: list runs, before/after per label, findings delta, live update on `checks-updated`
- [x] 4.5 Light/dark styling consistent with the VS Code preview's open-design visual language; works at narrow widths

## 5. Check history

- [x] 5.1 Save each run's images and findings summary to `<outputDir>/.checks/<entry-slug>/<timestamp>/`, prune to 5, and add saved paths plus the previous-run delta to `formatCheckResult`
- [x] 5.2 Notify a running preview server in the same process when a run is saved
- [x] 5.3 Tests: pruning, delta text, no writes under the artifact folder

## 6. MCP server

- [x] 6.1 `open_open_design_preview` tool (schema, handler, one server per process, closed on exit); `OPEN_DESIGN_PREVIEW` (`manual` default, `auto`, `off`)
- [x] 6.2 `get_open_design_artifact`: return `ToolOutput` with up to 4 crops, include `sent` comments with status, update the tool description
- [x] 6.3 `register_open_design_artifact`: `resolvedCommentIds`; replace the "no live preview editor" text with the preview hint; auto-open when `OPEN_DESIGN_PREVIEW=auto`
- [x] 6.4 Bundle `preview-shell.js` and `bridge.js` into `out/`; extend the npm publish smoke test to start the preview server with `--no-open`

## 7. CLI

- [x] 7.1 `preview [entryPath]` with `--no-open`, `--port`, `--browser`, `--workspace`; foreground until Ctrl-C, clean shutdown
- [x] 7.2 Bundle the shell assets; CLI tests for argument parsing and the not-opened path

## 8. Instructions, prompts and docs

- [ ] 8.1 Claude Code and Codex `open-design` skills and the shared instruction source: open the preview after the first registration; read comments with `get_open_design_artifact`; resolve with `resolvedCommentIds`; before/after in the Checks panel. Run the content drift check
- [ ] 8.2 Claude plugin prompt `/open-design:preview`
- [ ] 8.3 Docs: getting-started for Claude Code, Codex and Cursor (remove "no preview editor"), a guide "Preview and comment in the browser", tools and CLI references, env vars `OPEN_DESIGN_PREVIEW`, `OPEN_DESIGN_PREVIEW_BROWSER`, and `.gitignore` notes for `.checks/` and `*.comments/`; pass `check-docs`

## 9. Verification

- [ ] 9.1 Manual run in Claude Code: generate a landing page, preview opens, comment with crop, Send to agent, agent fixes and resolves, pin disappears, Checks panel shows before/after
- [ ] 9.2 Same flow with no Chromium (default browser, no crops) and with `--no-open` over SSH-style URL only
- [ ] 9.3 `openspec validate add-browser-preview --strict`
