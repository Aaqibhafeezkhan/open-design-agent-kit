## 1. Bridge script

- [x] 1.1 `src/webview/bridge/` in-page bridge: message protocol types (shared with `main.ts`), `set-mode` pick style + hover/click capture, element snapshot, rect reporting (rAF-throttled on scroll/resize/layout), pin anchors via the comment anchor lookup, `apply-patch` → `applyPatch` + `serializeDocument`, `capture-figma`, view-mode local-link handling (hash scroll only on the `srcdoc` copy), `ready`
- [x] 1.2 esbuild entry `dist/webview/bridge.js` (IIFE)
- [x] 1.3 Tests in real Chromium via `puppeteer-core` (as core's page-script tests do), driving the built `bridge.js` in a test page: snapshot fields, patch round-trip strips preview-only nodes, pin anchors, rects after scroll

## 2. Injection

- [x] 2.1 Extension reads `dist/webview/bridge.js` once; injects it (preview-only) into the served entry via `transformEntry` and into the `srcdoc` HTML in `previewHtml()` (nonce applied)
- [x] 2.2 Confirm `serializeDocument` drops the bridge and its pick-mode style; test

## 3. Preview (`main.ts`)

- [x] 3.1 Bridge client: post to the iframe, accept only `event.source === iframe.contentWindow`, single-use request ids for patch and capture
- [x] 3.2 Comment: hover/selection/pins from bridge rects; comment fields from the snapshot
- [x] 3.3 Edit: panel built from the snapshot; Save/Remove send `apply-patch`, write `newSource` only on a matching reply
- [x] 3.4 Export → Figma via `capture-figma`
- [x] 3.5 Served-page choice: served unless Tweaks is open or the design is a fluid poster (Comment/Edit no longer force `srcdoc`)
- [x] 3.6 Bridge not ready → Comment/Edit show as unavailable for this design
- [x] 3.7 Edit Save writes only the Style fields the user changed (found by the end-to-end test: every field was written, so a transparent background was saved as black; pre-existing)

## 4. Verification

- [x] 4.1 VS Code test host (test-electron + remote debugging, driven with puppeteer): served page (`src`, no `srcdoc`), Edit panel prefilled from the cross-origin page, Save → file has only the new text (no preview-only nodes, no extra styles); a forged `patched` posted by the page never reached the file
- [x] 4.2 Manual in Insiders on WSL, setting on: StockPulse tabs, Comment pin on a holding row (stays aligned while scrolling), Edit a price, Export → Figma
- [x] 4.3 Manual, setting off: the same Comment/Edit/Figma checks on the embedded copy
- [x] 4.4 Typecheck, compile, lint, core and vscode unit tests
