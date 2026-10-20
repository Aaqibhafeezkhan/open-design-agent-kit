## Why

The "Claude Desktop support analysis" thread (19–20 Oct 2026) found Desktop is not one surface:

- **Code tab** runs the existing Claude Code plugin already. Its **Browser pane** (Cmd+Shift+B) opens local HTML, PDF, image and video paths clicked in the chat, and can open a local server registered in `.claude/launch.json`. That gives Code tab users a visual loop with almost no work. The MCP App spike then confirmed it: the preview page registered as `od-preview` in `.claude/launch.json` opened in the built-in browser, comments made there went to the same `.comments.json` as Chat, and Claude applied them.
- **Chat with a folder** (what used to be Cowork, now inside Chat with no separate mode, on paid plans the merge has reached) runs the plugin's skills and its server on the user's machine, once the three Desktop fixes are in (desktop-figma-token-source, desktop-plugin-server-launcher, desktop-set-workspace-tool).
- **Chat without a folder** has no tool that writes to the user's disk, so the kit can't run there.

The docs only cover VS Code, Claude Code, Codex and the CLI. Desktop users have no page telling them what works where, and the skills don't hand Code tab users the clickable path that opens the Browser pane.

## What Changes

- **New guide `docs/getting-started/claude-desktop.md`:** installing the plugin in Desktop; the Code tab (Browser pane, clicking artifact paths, the preview page through `.claude/launch.json`); Chat with a folder (connect a folder, `set_open_design_workspace` happens automatically, the Figma token file, first start downloads the server once); what Chat without a folder can't do; limits found in the spikes (no downloads from inline pages, links open in the system browser, Mac/Windows untested).
- **Skill line for the Code tab.** After registering or updating a design, the Claude skills give the entry's workspace-relative path on its own line so a click opens it in the Browser pane, and mention the comparison page and contact sheet the same way.
- **`init` writes a launch entry.** When `claude` is selected, `init` merges an `open-design-preview` configuration into `.claude/launch.json` that runs the kit's `preview` command without opening a window, on a fixed port, so the Code tab can open the preview in the Browser pane. Other entries stay untouched. The plugin install has no project folder to write to, so the guide shows the snippet to add by hand.
- **Surface matrix.** A short spec of which kit steps are expected to work on each Desktop surface, so later changes and tests have one reference.

## Capabilities

### New Capabilities
- `claude-desktop-surfaces`: what the kit supports on the Code tab, Chat with a folder and Chat without a folder, and the Code tab path hand-off.

### Modified Capabilities
- `documentation`: the getting-started set gains `claude-desktop`.
- `open-design-init-cli`: Claude Code setup also merges a `.claude/launch.json` preview entry.

## Impact

- `docs/getting-started/claude-desktop.md` (new), `docs/README.md`, `docs/getting-started/README.md`, troubleshooting entries.
- Content: Claude skills (shared instruction source); drift check.
- `packages/cli`: `init` launch.json merge, tests.
- Depends on add-browser-preview's `preview` command (merged in PR #2) and on the three Desktop fixes (merged in PR #3) for the Chat-with-a-folder section.
