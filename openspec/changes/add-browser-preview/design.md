## Context

The VS Code Artifact Preview (`packages/vscode`) has three layers:

```
artifactEditorProvider.ts (extension host, node)
  │  postMessage: init/source-updated (html, servedUrl, comments, tweaks…),
  │  comments-changed, send-comments-to-chat, apply-patch, tweaks-*, figma-capture…
  ▼
webview/main.ts (≈1000 LOC shell: toolbar, modes, comment input & pins,
  │              Edit panel, Tweaks panel, shapes, export menus)
  │  postMessage, `od: 'bridge'` (webview/bridge/protocol.ts)
  ▼
webview/bridge/main.ts — injected into the design page; pick mode, hover/selection
  rects, ElementSnapshot (selector, htmlHint, styles), pin rects, apply patches +
  serialize, Figma capture. Uses dom/elementTargeting, commentOverlay, sourcePatches.
```

Facts that shape this design:

- The bridge and protocol depend only on DOM APIs and `postMessage`, plus `captureIr` from core. They are host-neutral already.
- The shell depends on VS Code in one place, `acquireVsCodeApi().postMessage`, plus messages from the provider.
- Tweaks (`tweaksPanel.ts`) still reads and writes `iframe.contentDocument`. It works only on the srcdoc copy, so it can't run against a page on another origin until the bridge gains a variables message.
- `dom/commentOverlay.ts` duplicates `ArtifactComment` because core's `workspace/artifactComments.ts` imports `node:fs`.
- Comments already store `selector`, `elementId` and `htmlHint`. But `elementId` is an `auto-…` id that `ensureDataOdId` sets on the live DOM only, so it never reaches the source. That leaves the `nth-of-type` chain from `cssSelectorFor` as the real anchor, and it is brittle.
- Core has `startStaticServer` (with `pathToken`, `transformEntry`), `findBrowser`, and `openArtifactPage`, which launches headless `puppeteer-core`. `puppeteer-core` is already a core dependency.
- `check_open_design_artifact` returns JPEGs as MCP `image` items. Cursor renders them in chat. Claude Code and Codex CLI don't render tool-result images in the terminal, so the person never sees them there.
- The MCP server is a long-lived stdio process per agent session, so it can own a preview server for that session.

## Goals / Non-Goals

**Goals:**
- A browser preview for MCP and CLI hosts, with View and Comment modes, live reload, and comments written to the same sidecar VS Code uses.
- Comments that identify an element firmly enough for an agent: a better selector, a text excerpt, a rect and a crop.
- The person sees check screenshots, before and after, in every host.
- A single implementation of bridge, DOM helpers and comment logic, shared by VS Code and the browser preview.
- Works with whatever Chromium-family browser is installed. Degrades cleanly when there isn't one, including WSL and remote/SSH sessions.

**Non-Goals:**
- Edit and Tweaks in the browser preview (follow-up, after the bridge gains a variables message).
- Pushing comments into the agent's session without the person asking.
- Playwright, or downloading a browser.
- CI screenshot gate, promote-to-code per stack, Figma variables round trip.

## Decisions

### D1. Browser driver: `puppeteer-core` headed, via `findBrowser`, with a plain-URL fallback

| Option | For | Against |
|---|---|---|
| Playwright (`playwright-core`) | Nice API; multi-engine | A second automation stack next to puppeteer-core; its Chromium channel discovery duplicates `findBrowser`; a full `playwright` install downloads browsers, which goes against the export decision "never downloads one" |
| **puppeteer-core (existing launcher)** | Already a dependency and already the launcher for check and export. CDP gives exact crops of what the person sees, reload, and window focus/navigation. Process lifetime is tied to ours | Chromium only; needs a local executable we can drive (not Windows Chrome from WSL) |
| Spawn browser / OS `open` only | Works with any browser, including Firefox, Safari and Windows-from-WSL | No CDP: no server-side crop, no window reuse |

**Decision:** keep one stack. `openPreviewWindow()` tries the following in order:

1. **Headed puppeteer-core:**
   - `findBrowser()`;
   - `headless: false`, `defaultViewport: null`, `--app=<shellUrl>`, `--window-size=1280,900`;
   - a persistent profile under the OS cache dir (`open-design/preview-profile`), so the window size sticks and the person's real profile is never touched.
2. **Default browser** with no CDP: `open` (macOS), `xdg-open` (Linux), `cmd /c start` (Windows). On WSL (`WSL_DISTRO_NAME` set) it uses `wslview`, else `cmd.exe /c start`, so Windows opens `http://127.0.0.1:<port>`; WSL2 forwards localhost.
3. **Print the URL**, for SSH, containers and cases where neither works. The tool result and the CLI output always include the URL anyway.

`OPEN_DESIGN_BROWSER_PATH` keeps its meaning. A new `OPEN_DESIGN_PREVIEW_BROWSER=default` forces step 2, for people who want their own browser and its extensions.

### D2. Two origins: shell and design

The preview server listens on two loopback ports:

- **Shell origin** (`127.0.0.1:A/<token>/`): the shell HTML/JS, the JSON API (`GET/PUT comments`, `POST crop`, `GET checks`) and the SSE stream (`/events`).
- **Design origin** (`127.0.0.1:B/<token>/`): `startStaticServer`, rooted at the workspace, with the bridge injected into the entry (`transformEntry`, as the VS Code served preview does).

The design runs the person's or a remixed example's scripts. On a separate origin, those scripts can't call the write API (no CORS, different token), and the shell treats bridge messages as untrusted, exactly as served-preview requires. A same-origin design would let any page script write comments.

Both tokens are 128-bit random. The API requires the shell token and an `Origin` header equal to the shell origin, so a cross-site page that guesses the port still gets nothing. Request bodies are capped (comments 256 KB, crops 4 MB). Writes are allowed only to `<entry>.comments.json` and `<entry>.comments/` of a registered artifact entry inside the workspace. The server binds to `127.0.0.1` only.

### D3. What moves to core (`packages/core/src/preview/`, browser-target)

```
core/src/preview/
  protocol.ts          ← vscode/src/webview/bridge/protocol.ts
  bridge.ts            ← vscode/src/webview/bridge/main.ts
  dom/elementTargeting.ts, commentAnchors.ts, sourcePatches.ts  ← vscode/src/webview/dom/*
  commentController.ts   NEW: comment list, pins, input popover, statuses, send-to-agent,
                         over a HostTransport; extracted from main.ts comment code
  shell/main.ts          NEW: browser shell (toolbar, View/Comment, Checks panel, reload)
  shell/transport.ts     NEW: fetch + EventSource HostTransport
  (node side)
  previewServer.ts       NEW: D2 server, file watch, SSE
  openPreviewWindow.ts   NEW: D1 launcher
  captureCrop.ts         NEW: D5
core/src/workspace/artifactCommentTypes.ts  NEW: pure ArtifactComment type + helpers
```

```ts
interface HostTransport {
  post(message: ShellToHost): void;               // comments-changed, send-comments, crop-request…
  onMessage(handler: (m: HostToShell) => void): void; // init, source-updated, comments-updated…
}
```

The VS Code webview implements `HostTransport` with `acquireVsCodeApi`. The browser shell implements it with `fetch` and `EventSource`. The webview's `main.ts` keeps Edit, Tweaks, shapes and export menus for now. It imports the bridge protocol, DOM helpers and comment controller from core, as it already imports `captureIr`. Each consumer bundles the browser code with its own esbuild from core sources, as today: VS Code builds `bridge.js`, and mcp-server and cli each build `preview-shell.js` and `bridge.js` into their `out/`. That avoids a build step and a publish layout for core. A test checks that nothing under `core/src/preview` (apart from the node files) imports `node:`.

*Alternative:* move all of `main.ts` (Edit and Tweaks too). Rejected for this change. Tweaks needs a bridge message first, and moving the 1000-line shell in the same change as a new host makes regressions hard to attribute. The controller seam makes the later move mechanical.

### D4. Selector strategy and comment record

`selectorFor(el)` returns the first candidate that matches exactly one element in the document:

1. `#id`, when the id is unique and doesn't look generated (`/^[a-z][\w-]*$/i`, no long digit runs).
2. A stable attribute: `data-od-id` **when present in source** (not `auto-`), `data-testid`, `data-od-node`, `data-od-slide`, `name`, `aria-label`.
3. `tag.class1.class2`, choosing classes that aren't utility-looking (skip Tailwind-style tokens containing `:`, `[`, `/`), under the nearest ancestor anchored by 1 or 2.
4. The current `nth-of-type` chain.

Comment fields, additive and optional, so old sidecars and VS Code stay valid:

```ts
interface ArtifactComment {
  id; elementId?; selector; htmlHint; note; status; createdAt; updatedAt;
  text?: string;                 // element textContent, whitespace-collapsed, ≤120 chars
  rect?: { x; y; width; height };// document coordinates (scroll included), CSS px
  viewport?: { width; height };
  screenshot?: string;           // entry-relative, e.g. "index.html.comments/c_ab12.png"
  host?: 'vscode' | 'browser';
}
```

Comments no longer store `auto-` elementIds; `elementId` is set only when the source carries `data-od-id`. Edit mode still assigns `auto-` ids so its patches can find their targets. Today those ids leak into the saved file, so `serializeDocument` now strips them. The resolution ladder for pins: elementId, then selector, then a text-excerpt match among elements with the same tag, then lost.

### D5. Crop capture

When the person saves a comment, the shell hides its overlays, waits a frame and asks the host for a crop of the element's rect plus 24 px of context, clamped to the viewport, at device scale 1. The long edge is capped at 800 px, and the crop is saved as PNG.

- **Headed puppeteer session:** the server takes `page.screenshot({ clip })` on the shell page. The clip is the iframe offset plus the element rect. This is exactly what the person sees, including interaction state such as an open tab.
- **No CDP** (default browser): the server re-renders the entry headless with `openArtifactPage` at the reported viewport, scrolls to `rect.y`, and clips. Interaction state may differ, so the crop is labelled "re-rendered" in the comment.
- **No browser at all:** no crop. The comment keeps selector, text and rect.

Crops are written to `<entry>.comments/<commentId>.png`. Deleting a comment deletes its crop. `get_open_design_artifact` returns up to 4 crops of open comments, newest first, as `image` items after the JSON text. The JSON lists every comment's `screenshot` path, so an agent can read the rest.

### D6. Live reload and concurrent writers

The server watches the entry's directory and its subfolders, debounced at 150 ms, plus the workspace files the entry references. On macOS and Windows it uses the platform's recursive `fs.watch`. On Linux, Node emulates recursive watching and loses track of a file once it is replaced by a rename, which is exactly how atomic sidecar writes work. So on Linux each folder gets its own plain watch (up to 64 folders). It ignores `*.artifact.json` churn and the `.comments` dir. On change it sends `source-updated` over SSE. The shell reloads the design iframe, keeping scroll position and mode (it saves `scrollY` from the bridge `rects`/`ready` and restores it after `ready`). It also watches `<entry>.comments.json` and sends `comments-updated`, so pins update when the agent resolves comments.

The VS Code provider, the browser preview and the agent may all write the sidecar. `writeArtifactComments` becomes `updateArtifactComments(mutator)`: it reads, applies, then writes to a temp file and renames. Merging is by `id` with last-`updatedAt`-wins. This replaces blind whole-array writes from the shells: they send changed comments, not the whole list. A comment present on both sides is merged field by field, so a writer that never saw a field (a crop added by the browser preview) doesn't drop it. Within one process, updates to a sidecar are queued. Across processes, two writes in the same instant can still lose one update; the rename keeps the file whole either way.

### D7. How each host opens it

| Host | How | Lifetime |
|---|---|---|
| Claude Code / Codex / Cursor (MCP) | `open_open_design_preview { entryPath?, open? }` returns the URL and how it was opened. Skill text: call it once after the first `register_open_design_artifact` in a session, unless `OPEN_DESIGN_PREVIEW=off` or the person said no. With `OPEN_DESIGN_PREVIEW=auto`, `register` opens it itself | One preview server per MCP process; one window, navigated between artifacts; closed when the process exits |
| CLI | `npx @feimacode/open-design-agent-kit preview [entryPath] [--no-open] [--port]`, which runs in the foreground. Without an entry, the shell lists registered artifacts | Until Ctrl-C |
| Claude Code plugin | `/open-design:preview` prompt, which calls the tool | as MCP |
| VS Code | Unchanged (custom editor). It shares code but not the server | as today |

A second call for the same entry focuses the existing window via CDP, or reopens the URL when there's no CDP. It never starts a second server. The default for `OPEN_DESIGN_PREVIEW` is `manual`: the skill asks the agent to open it, but a GUI window never appears from a tool the person didn't expect.

Comments get back to the agent through **Send to agent** in the shell. It marks the selected comments `sent`, copies "Apply the Open Design comments on `<entry>` (call get_open_design_artifact)" to the clipboard, and shows "Paste this into your agent". `openComments` is extended to return both `open` and `sent` comments, with each one's status, so a handed-off comment stays visible to the agent until it's resolved. After addressing comments, the agent passes their ids as `resolvedCommentIds` to `register_open_design_artifact`, which it already calls after edits. That marks them `resolved`, and the pins update over SSE. This avoids adding a tool; see Open Questions.

### D8. Check history and before/after

`checkArtifact` writes each run's images and findings summary to `.open-design/.checks/<entry-slug>/<iso-time>/`. It keeps the last 5 runs per entry and prunes older ones. The images are the same JPEGs it returns. The MCP text adds:

```
Screenshots saved: .open-design/.checks/landing/2026-10-19T10-22-01/desktop.jpg …
Previous run: …/2026-10-19T10-15-40/ (2 errors → 0)
```

The shell's Checks panel lists runs and shows each label, `before | after`, side by side, with the findings delta. When a check finishes while a preview is open in the same MCP process, the server pushes `checks-updated` and the panel highlights the new run. This is the "after each generation or edit" moment, since the skills already call check after each generation and substantial edit.

History lives under `.open-design/.checks/`. `init` adds that path to `.gitignore` guidance in the docs; it isn't written by default.

## Risks / Trade-offs

- [The headed window steals focus while the person types in the terminal] → open only on an explicit tool call or a CLI command, reuse one window, and never re-open on reload.
- [puppeteer kills the window when the MCP process restarts (agent reconnect)] → acceptable. The tool result says how to reopen, and the persistent profile keeps the size.
- [WSL: Linux Chrome may exist without a display (no WSLg)] → if headed launch fails within 5 s, fall back to step 2 and log why.
- [Snap Chromium can't read `.open-design/`] → this doesn't matter for the preview: the browser reads over HTTP, not from disk. The persistent profile goes in the snap-allowed cache dir.
- [`fs.watch` recursive isn't supported on Linux before Node 20] → engines say Node ≥18, so fall back to watching the entry dir plus the referenced files, non-recursively.
- [A design that blocks the bridge (overrides `postMessage`)] → the Bridge Availability behaviour carries over: Comment is shown as unavailable.
- [Moving files breaks VS Code imports or tests] → the moves come first in their own commit, with no behaviour change, and the VS Code test-electron suite runs before any new code.
- [Crops of sensitive content written to the workspace] → they live next to the sidecar the person already controls, and the docs say to `.gitignore` `*.comments/` if wanted.
- [Clipboard handoff is one manual step] → it's honest about hosts with no push channel. A channels/notification push is a noted follow-up.

## Migration Plan

Additive. Old sidecars stay valid: new fields are optional, and `auto-` elementIds in existing comments still resolve through the ladder. VS Code behaviour is unchanged apart from comments saved without `auto-` ids and with the better selector. Rollback: remove the tool and command; the shared modules stay.

## Open Questions

- Does Codex run MCP servers with permission to launch GUI processes and bind loopback ports under its sandbox modes? A spike is needed; if not, `open:false` prints the URL.
- Should Cursor users be pointed at Cursor's built-in browser (Simple Browser) instead of an external window? Printing the URL already allows it.
- `OPEN_DESIGN_PREVIEW` default: `manual` (proposed) or `auto` for the plugin install?
- Resolving comments through `register_open_design_artifact.resolvedCommentIds` vs a small `resolve_open_design_comments` tool. A dedicated tool is clearer, but it adds to the tool count every host loads.

## Implementation Notes

- **Prompt hosts.** Local prompts gained an optional `hosts` frontmatter list (`vscode`, `claude`, `codex`, `mcp`). `open-design-preview` is for `claude`, `codex` and `mcp` only, because VS Code has its own preview and no `open_open_design_preview` tool.
- **Paths in `openComments`.** `get_open_design_artifact` returns each comment's `screenshot` as a workspace-relative path. The sidecar keeps it relative to the entry's folder.
- **Shared chrome.** Besides the bridge, DOM helpers and comment controller, the Open Design tokens (`preview/theme.ts`, with an `od-dark` class next to `vscode-dark`), the preview chrome CSS, the icons and the menu also moved to core, so both shells look the same.
- **Bundles.** `core/build/previewBundles.ts` builds `shell.js` and `bridge.js` into each host's `out/preview/`. `loadPreviewAssets()` reads them back at runtime, and bundles them in memory under tsx and in core's own tests.
