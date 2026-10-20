> **Status: implemented.** Shipped in PR #3 (branch `claude/project-thread-s40bk1`, merged to `main` as `9fb7dfd`). This proposal records the change after the fact so its spec deltas can be synced and the change archived.

## Why

Claude Desktop refuses to start a plugin's local MCP server when the plugin's `.mcp.json` refers to a plugin setting (`${user_config.*}`). The Cowork spike on 20 Oct 2026 (Desktop 2.42304.2, Linux build in WSL2) showed it: the `open-design` server was reported `not_started` with reason `user_config_unsupported`, so Chat with a folder got the kit's skills but none of its tools. The only plugin setting the kit used was `figma_token`, which only `pull_open_design_figma_frame` needs, and only when Figma's own MCP server isn't connected.

## What Changes

- **Drop the `figma_token` plugin setting.** `packages/claude-plugin/.claude-plugin/plugin.json` no longer declares `userConfig`, and `.mcp.json` no longer passes `OPEN_DESIGN_FIGMA_TOKEN` from it.
- **Read the token from the environment or a token file.** The MCP server reads `OPEN_DESIGN_FIGMA_TOKEN` first, then `$XDG_CONFIG_HOME/open-design/figma-token` (default `~/.config/open-design/figma-token`). It reads on every call, so a token saved while the server runs works without a restart.
- **Guard against regressions.** The plugin's lint fails if `.mcp.json` refers to `${user_config.*}` again.
- **Docs.** `docs/guides/figma.md`, `docs/reference/settings-and-env.md` and `docs/troubleshooting.md` describe the token file.

Trade-off: Claude Code users lose the token field in the plugin's install dialog. People connected to Figma's MCP server never needed it.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `figma-integration`: where the MCP server finds a Figma token.
- `open-design-agent-plugins`: the Claude Code plugin bundle declares no plugin settings that its server registration depends on.

## Impact

- `packages/mcp-server/src/env.ts` (`getFigmaToken`, `figmaTokenFilePath`), `src/index.ts` (token read per call), unit tests in `src/test/unit/env.test.ts`.
- `packages/claude-plugin/.claude-plugin/plugin.json`, `.mcp.json`, `scripts/update-plugin-lock.mjs` (lint check).
- Docs listed above. No new dependencies.
