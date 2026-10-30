## Why

In Claude Desktop Chat and Cowork, Open Design already shows designs inline as an MCP App (`show_open_design_artifact`), with no local server: the design is bundled and loaded through the app-only `get_open_design_preview_state`. Three things still get in the way:

- **The inline page doesn't follow edits.** It loads the design once. The skill works around this by calling `show_open_design_artifact` again after every `register_open_design_artifact`, so each round of feedback adds another copy of the design to the conversation, and the older copies go stale without saying so.
- **Register still points at the local server.** After a register, the result tells the agent to "call open_open_design_preview to show it to the user in a live browser preview", even in a host that renders MCP Apps. The skill overrides this for Chat, but the tool result and the skill disagree, and an agent that follows the tool starts a local server and opens a browser window next to the chat.
- **Hosts can't tell which tools only read.** None of the 45 tools carry MCP tool annotations. Hosts use `readOnlyHint` (and `destructiveHint`, `openWorldHint`) to decide how much to ask before a call, so today a listing or a state read looks as risky as a publish.

The device-link route (a cloud Chat reaching tools on the user's computer) passes tool results through but doesn't draw MCP Apps (seen on Linux, October 2026). It needs a retest on current Desktop builds before we rely on the inline page there.

## What Changes

- **The inline design refreshes in place.** The artifact view checks a cheap revision of the design (manifest and entry file times, open comment count) every few seconds while it's visible, and reloads when it changes. A small "Updated" note shows when it did. Explorations and campaign sheets do the same.
- **One inline copy per design.** The skill shows a design inline once per conversation, after its first register. Later rounds update that copy in place; the agent calls `show_open_design_artifact` again only for a different design, or when the user asks to see it again.
- **Register speaks for the host.** In a host that renders MCP Apps, the register result tells the agent to show the design inline (or that the shown copy updates by itself) instead of suggesting the browser preview. `open_open_design_preview` still works when the user asks for a browser window.
- **Tool annotations.** Every tool gets `annotations`: `readOnlyHint: true` for tools that only read or compose text (the list, get, show, recommend and prepare tools, and the app-only state tool). Tools that write in the workspace get `readOnlyHint: false` and `destructiveHint: false`. Tools that reach other services (publish, Figma, Canva) also get `openWorldHint: true`. A unit test keeps every tool annotated.
- **Device-link retest.** A verification task on current Desktop (macOS and Windows) for the device-link route, and the inline-preview guide updated with what it shows.

Not in this change: removing the local preview server (VS Code, the terminal and the browser preview still use it), and anything that needs the artifact host bridge.

## Capabilities

### New Capabilities
- `inline-preview-refresh`: the inline views follow edits in place, one inline copy per design, register text that matches the host, and annotations on every tool.

### Modified Capabilities
None.

## Impact

- `packages/core/src/preview/mcpApp/` (polling and the "Updated" note), `packages/core/src/preview/server/mcpApp.ts` or the state builder (a `revision` field and a revision-only request).
- `packages/mcp-server/src/index.ts` (annotations on every tool, the app-only state tool's revision argument), `packages/mcp-server/src/tools.ts` (`previewNoteAfterRegister` for MCP Apps hosts), unit and browser tests.
- Skills: the overview skill's Chat lines, `open-design-preview` and any prompt that says to call `show_open_design_artifact` after each register; regenerated copies.
- Docs: `docs/guides/inline-preview.md` (refresh, device link), `docs/reference/tools.md` (annotations, the register note).
