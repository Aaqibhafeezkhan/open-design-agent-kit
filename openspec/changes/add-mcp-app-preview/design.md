## Context

Spike results from `~/toys/mcp-app-claude-test1` (README results table, `probe-results.jsonl`) in Claude Desktop Chat:

| Probe | Result |
|---|---|
| Inline render of the poster with Google Fonts | pass |
| Nested frame scriptable from the page | pass |
| Images from declared domains / other domains | load / blocked |
| Save comment through a tool call | pass, written to `coffee-poster.comments.json` |
| Send message to chat ("Ask Claude to apply") | pass, Claude acted on it |
| Fullscreen | pass |
| Open link | host shows a confirmation, then hands to the system browser |
| Download HTML | refused by the host |

The page only renders in Chat. The Code tab and the Claude Code terminal show the text result; the Code tab's visual route is the Browser pane (add-claude-desktop-guide).

## Decisions

- **Reuse the browser preview's shell and controller.** add-browser-preview already moved the bridge, DOM helpers and comment controller to `core/src/preview` behind a `HostTransport`. The MCP App adds one transport (bridge tool calls and messages) instead of a third UI.
- **A dedicated tool to show the design.** Attaching the UI to `check_open_design_artifact` or `get_open_design_artifact` would render a page every time the agent reads an artifact. A separate `show_open_design_artifact` lets the skill decide when the person sees it.
- **App-only tools for writes.** Comment writes come from the page, not the model, so they are hidden from the model's tool list.
- **No downloads.** The host refuses them; exports stay a server tool that returns a path.

## Implementation notes

- **Opaque-origin design frame.** The design's frame is `srcdoc` with `sandbox="allow-scripts allow-popups allow-forms"` and no `allow-same-origin`, so its scripts can't reach the app page or the host bridge. The shell addresses it by window (`postMessage(…, '*')`, `event.source` checked) instead of by origin.
- **App-only tools are listed only to MCP Apps hosts.** Those hosts keep `visibility: ["app"]` tools away from the model; a host without the extension would show them to it, so the server leaves them out of its `tools/list` there. Calls still work if one arrives.
- **CSP from what designs needed.** The resource declares Google Fonts plus the remote origins of every design `get_open_design_preview_state` packed in this process. A host that reads the resource before the first design is packed sees only Google Fonts.
- **The page stays small in the tool result.** `show_open_design_artifact` returns only `{ view, entryPath | explorationId, title }` as structured content; the page fetches the design (up to 5 MiB) through `get_open_design_preview_state`, so the model's context never holds the HTML.
- **SDK pin.** `@modelcontextprotocol/ext-apps` 1.7.5 (the 1.x line matches the server's `@modelcontextprotocol/sdk` 1.x; 2.x targets SDK 2). It is bundled into the page at build time, so the published server has no new runtime dependency.

## Risks

- MCP Apps metadata names may still move; pin the ext-apps SDK and keep the resource declaration in one place.
- Large designs inlined into a resource can be slow; fall back to a check screenshot plus text over a size threshold.

## Open Questions

- Does the Code tab render MCP Apps in a later Desktop version? Re-test before writing skill text that assumes it doesn't.
- macOS and Windows Desktop runs (parked by Iven on 20 Oct 2026).
