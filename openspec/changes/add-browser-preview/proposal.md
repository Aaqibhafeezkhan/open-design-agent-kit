## Why

Our growth audience (developers, founders, PMs, design engineers, web designers, email developers) already works in Claude Code, Codex and Cursor, and for them the biggest gap is visual feedback for the **person**: `check_open_design_artifact` shows the agent screenshots, but the person is told to "open the HTML in a browser" (docs/getting-started/claude-code.md), and Comment, Edit and Tweaks exist only in the VS Code Artifact Preview. The kit already drives the installed Chrome/Edge/Chromium headless for check and export, and the VS Code preview already talks to the page only through a host-neutral bridge (add-preview-bridge), so a headed, live-reloading browser preview of the same served page is a small step, not a new product.

## What Changes

- **Browser preview.** A loopback preview server in core serves a preview shell (toolbar, comment pins, comment list) and the design on a separate origin, with live reload over server-sent events when the design's files or its comments change. The MCP server opens it with a new `open_open_design_preview` tool; the CLI opens it with `open-design-agent-kit preview [entryPath]`. It launches the installed Chromium-family browser as an app window through `puppeteer-core` and `findBrowser`, which the kit already uses. If that fails, it opens the default browser. If it can't open anything, it prints the URL.
- **Click-to-comment in the browser.** Comment mode works as it does in VS Code. Comments are written to the same `<entry>.comments.json` that `get_open_design_artifact` returns as `openComments`. A "Send to agent" action copies a ready-made prompt and marks those comments as sent.
- **Comments point at an element.** Each comment carries a sturdier CSS selector (unique id, `data-*` or class first, verified unique, `nth-of-type` last), the element's text excerpt, its rectangle and viewport, and a cropped PNG of the element with some context around it, saved next to the sidecar. `get_open_design_artifact` returns the crops as image content, up to a cap.
- **Before/after check screenshots for the person.** `check_open_design_artifact` keeps the last runs per artifact on disk. Its result text names the before and after images, and the preview's Checks panel shows them side by side. Hosts that render MCP images (e.g. Cursor) show them in chat as today. Terminal hosts (Claude Code, Codex CLI) don't render tool-result images, so the preview is where the person sees them.
- **One shared implementation.** The preview bridge, its protocol, the DOM helpers (element targeting, comment anchors, source patches) and a host-agnostic comment controller move from `packages/vscode/src/webview` to `packages/core/src/preview` (browser-target, no `node:` imports). The VS Code webview and the browser shell differ only in their transport (`vscode.postMessage` vs `fetch` + SSE). The comment record type moves to a pure module, so the webview no longer duplicates it.
- **Instructions and docs.** The skills and instructions for MCP hosts tell the agent to open the preview once after the first registration and to read comments with `get_open_design_artifact`. The "no preview editor" lines go from the getting-started docs, the `register_open_design_artifact` result and the `get_open_design_artifact` description.

Not in scope (follow-ups): Edit and Tweaks in the browser preview (Tweaks needs a bridge "set root variables" message first); stack-aware promote-to-code (Tailwind, shadcn/ui); `check --fail-on error --screenshots` as a CI gate that posts screenshots to PRs; Figma variables round trip; pushing comments into the agent's session without the person typing (e.g. Claude Code channels); crops for comments made in VS Code.

## Capabilities

### New Capabilities
- `browser-preview`: the loopback preview server and shell, how each host opens it (MCP tool, CLI command), live reload, browser launch and fallbacks, origin separation and the write API's security rules.
- `element-comments`: the comment record (selector strategy, text excerpt, rect, viewport, crop), where crops are stored, how they're captured, and how comments get back to the agent (sidecar, `openComments` with images, Send to agent).
- `check-history`: keeping recent check runs per artifact and showing before/after screenshots to the person.

### Modified Capabilities
- `open-design-tools`: Artifact Readback returns comment crops; the comment requirement no longer says comments are authored only in the VS Code preview; registration no longer says there's no preview.
- `artifact-visual-check`: the "Other MCP tools unchanged" scenario now allows images from `get_open_design_artifact`; check results are saved to the check history; the check-before-done guidance mentions the preview.
- `served-preview`: the bridge and its protocol live in core and are shared with the browser preview; the bridge's `select` reports the improved selector and text excerpt.

## Impact

- **packages/core**: new `src/preview/` (browser modules moved from vscode, plus a new shell, `previewServer.ts`, `openPreviewWindow.ts`, crop capture, check history); `workspace/artifactComments.ts` splits into types and fs, with an atomic merge-by-id write; `export/checkArtifact.ts` saves its history. Build: core gets an esbuild step for the browser bundles (bridge, shell), or the bundles are built by each consumer from core sources, as the bridge is today.
- **packages/mcp-server**: new tool `open_open_design_preview`; `get_open_design_artifact` returns `ToolOutput` with images; preview server lifetime tied to the MCP process; env `OPEN_DESIGN_PREVIEW` (`auto` | `manual` | `off`).
- **packages/cli**: new `preview` command (foreground, Ctrl-C to stop).
- **packages/vscode**: webview imports bridge, DOM helpers and comment controller from core; behaviour unchanged.
- **content / docs**: skill and instruction text for MCP hosts; getting-started for Claude Code, Codex and Cursor; tools and CLI references (checked by the reference completeness check).
- **Dependencies**: none new. `puppeteer-core` is already a core dependency, and Playwright is not added.
