## Why

In Claude Desktop Chat (with or without a folder) the person sees only a text reply and a file path after the agent builds a design. MCP Apps, an official MCP extension (`modelcontextprotocol/ext-apps`), let a server show its own interactive page inline in the conversation. The "MCP App feasibility spike" (20 Oct 2026, Desktop 2.42304.2 on Linux/WSL) built a tiny server that shows a poster inline and found it **feasible** in Desktop Chat:

- the kit's HTML design rendered inline with its Google Fonts, inside a nested frame the page can script;
- click-to-comment saved to `<entry>.comments.json` through a server tool call;
- "Ask Claude to apply" posted a message into the chat and Claude acted on it;
- fullscreen worked; images from allowlisted sites loaded and others were blocked as declared;
- **downloads were refused**, and "open link" goes to the system browser, not Claude's built-in one;
- the first render asks the person to Allow.

The Cowork spike confirmed the host advertises `io.modelcontextprotocol/ui`. Hosts without the extension (the Claude Code terminal, Codex) get the normal text result, so one server serves everyone. The Desktop analysis ranked this the biggest Desktop opportunity.

## What Changes

- **A preview MCP App.** The server registers a `ui://open-design/preview` resource: the browser preview's shell and comment controller from `core/src/preview` (add-browser-preview), with a third transport over the MCP Apps bridge. The design renders in a nested frame from the standalone export, so local fonts and images are inlined; remote hosts the design needs are declared in the resource's CSP metadata.
- **`show_open_design_artifact` tool** (MCP only) with `entryPath`. It declares the preview resource as its UI. Hosts with MCP Apps show the design inline; other hosts get a text summary (title, path, open comments) and the browser-preview hint.
- **App-only tools** for the page: `save_open_design_comment` (create, edit, delete a comment in the sidecar, same record and merge as the browser preview) and `get_open_design_preview_state` (entry HTML, comments, check images). Marked app-visible only so the model doesn't call them.
- **Hand-off.** "Ask Claude to apply" sends a chat message naming the entry and the open comments, using the bridge's message call. Exports are buttons that ask Claude to run `export_open_design_artifact`, which writes the file and returns its path; the page never starts a download.
- **Exploration.** The same app shows an exploration's directions side by side with a "take this one" action that sends the choice to Claude, which calls `choose_open_design_direction` after the person confirms.
- **Skills.** In Claude Desktop Chat, the overview skill calls `show_open_design_artifact` after registration and after applying feedback.

## Capabilities

### New Capabilities
- `mcp-app-preview`: the preview resource, `show_open_design_artifact`, app-only tools, hand-off to chat, exports without downloads, exploration picks, CSP declarations, fallback for hosts without MCP Apps.

### Modified Capabilities
- `open-design-agent-plugins`: No Editor Dependency in the MCP Server no longer forbids preview and comment tools on the server.

## Impact

- `packages/core/src/preview`: an MCP Apps transport for the comment controller; the shell builds as one self-contained HTML resource.
- `packages/mcp-server`: resource registration, the three tools, `@modelcontextprotocol/ext-apps` (new dependency, from the MCP project).
- Content and docs: overview skill (Claude), tools reference, a Claude Desktop guide section (add-claude-desktop-guide).
- Relationship to add-artifact-preview: both put a picture in front of the person in Claude's runtime. The MCP App is interactive and needs no Artifact tool, but renders only in Chat; the artifact preview also works in the Claude Code terminal and can be shared. Build the artifact preview first.
