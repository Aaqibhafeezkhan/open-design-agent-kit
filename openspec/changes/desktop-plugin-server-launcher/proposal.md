> **Status: implemented**, except publishing a server release and bumping the plugin's pin (task 4). Shipped in PR #3 (branch `claude/project-thread-s40bk1`, merged to `main` as `9fb7dfd`).

## Why

The Claude Code plugin started its MCP server from `${CLAUDE_PLUGIN_ROOT}/node_modules/@feimacode/open-design-agent-kit-mcp/out/index.js`. Claude Code installs the plugin's locked dependencies at install time, so that file exists there. The Cowork spike on 20 Oct 2026 showed Claude Desktop installs none: `npmDependencyInstalled: false` and no `node_modules` in the plugin folder. So even with the plugin-setting problem fixed (desktop-figma-token-source), Desktop would have had nothing to run.

## What Changes

- **A dependency-free launcher.** `packages/claude-plugin/bin/open-design-mcp.mjs` runs the installed copy in `node_modules` when it exists (Claude Code). Otherwise it runs `npx -y @feimacode/open-design-agent-kit-mcp@<pin>`, where `<pin>` is the version in the plugin's `package.json` `dependencies`, so both hosts run the same server version. On Windows it starts `npx.cmd` through a shell. It forwards stdio, exit codes and SIGINT/SIGTERM, and prints a clear message when Node or npx can't be started.
- **`.mcp.json`** runs `node ${CLAUDE_PLUGIN_ROOT}/bin/open-design-mcp.mjs`.
- **The lock tooling** (`scripts/update-plugin-lock.mjs`) keeps the launcher's pin source and the lock file in step.

Trade-offs: the first Desktop start downloads the server package (about 12 MB, mostly design content) and needs the network once; npm caches it afterwards. A single bundled server file in the plugin was the alternative, rejected because it would add about 12 MB to the repo on every content update. On macOS, apps launched from the Dock may not see a Node installed through nvm; that is untested.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `open-design-agent-plugins`: the Claude Code plugin bundle starts its server through a launcher that works whether or not the host installed the plugin's dependencies.

## Impact

- `packages/claude-plugin/bin/open-design-mcp.mjs` (new), `.mcp.json`, `scripts/update-plugin-lock.mjs`, `docs/contributing/releasing.md`.
- Release process: marketplace users only get Desktop support once a server version with these changes is published and the plugin's pin points at it.
