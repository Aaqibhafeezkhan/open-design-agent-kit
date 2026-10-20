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

## Risks

- MCP Apps metadata names may still move; pin the ext-apps SDK and keep the resource declaration in one place.
- Large designs inlined into a resource can be slow; fall back to a check screenshot plus text over a size threshold.

## Open Questions

- Does the Code tab render MCP Apps in a later Desktop version? Re-test before writing skill text that assumes it doesn't.
- macOS and Windows Desktop runs (parked by Iven on 20 Oct 2026).
