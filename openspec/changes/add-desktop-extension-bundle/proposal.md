## Why

In Claude Desktop the Open Design plugin gives you its skills everywhere, but its MCP server only starts in a Chat with a folder, and only if Node.js is set up the way Desktop expects:

- **The plugin's server needs Node on PATH.** `packages/claude-plugin/.mcp.json` runs `"command": "node"` on `scripts/open-design-mcp.mjs`. Desktop installs no npm dependencies (Cowork spike, `npmDependencyInstalled: false`), so the launcher falls back to `npx -y @feimacode/open-design-agent-kit-mcp@0.1.8` (`scripts/open-design-mcp.mjs`, pin from `packages/claude-plugin/package.json`). That needs system Node and npx, the network on first start (about 12 MB), and on macOS a Node that Desktop can find when launched from the Dock (`docs/getting-started/claude-desktop.md`, Known limits). On Windows, Cowork does not use its bundled Node for a plugin's `"command": "node"`; the issue was closed "not planned" (research `install-landscape.md` §3e, anthropics/claude-code#66183).
- **The Figma token has no form.** Desktop won't start a plugin server whose `.mcp.json` refers to `${user_config.*}` (desktop-figma-token-source), so the token now has to be written into `~/.config/open-design/figma-token` by hand (`packages/mcp-server/src/env.ts`, `getFigmaToken`).
- **Desktop extensions (`.mcpb`) fix both.** A `.mcpb` is a zip with a stdio server and a `manifest.json`. Desktop installs it in one click and runs `server.type: "node"` with its own bundled Node. A `user_config` block gets a generated settings form, with `sensitive` values kept in the OS keychain and passed through `env` (research §1). A Desktop extension's tools are also available in Desktop Chat, where a plugin's local server is ignored (§3e).

The research also sets the limits. The Claude directory no longer accepts `.mcpb` listings and steers local servers into plugins. A self-hosted `.mcpb` does not auto-update. A `.mcpb` carries prompts but not skills. A plugin can embed one (`"mcpServers": "./x.mcpb"`), but the directory then holds every version for human review (§1, §3d, §7). `design.md` weighs these and recommends a standalone extension attached to each GitHub release, next to the plugin.

## What Changes

- **New package `packages/desktop-extension`.** It holds a `manifest.json` template (`manifest_version` 0.3, `server.type: "node"`), the plugin's icon and a build script. The build bundles the MCP server the same way `packages/mcp-server/.esbuild.ts` does, except it also inlines `@modelcontextprotocol/sdk`. It vendors `@feimacode/open-design-agent-kit-content` from the content tarball built in the same release run (the content package has no dependencies of its own), then runs `mcpb validate` and `mcpb pack` from a pinned `@anthropic-ai/mcpb` devDependency. The output is `open-design-<version>.mcpb`, with no network access at runtime and no system Node.
- **Settings form.** `user_config.figma_token` is an optional `string` with `sensitive: true`, mapped to `OPEN_DESIGN_FIGMA_TOKEN`. `user_config.workspace` is an optional `directory`, mapped to a new `OPEN_DESIGN_DEFAULT_WORKSPACE`.
- **Server: suggested workspace folder.** `OPEN_DESIGN_DEFAULT_WORKSPACE` replaces the working directory as the last fallback for the workspace root. It does not override `set_open_design_workspace`, `OPEN_DESIGN_WORKSPACE_ROOT` or MCP roots. Until the agent sets a folder, the home-folder guard also applies to it and names it as the folder to use when no folder is connected, so a Chat with a different connected folder can't silently write into the default (`packages/mcp-server/src/env.ts`, `src/index.ts`).
- **Server: unfilled settings count as unset.** A value that is still a literal `${user_config.…}` placeholder counts as empty, for the token and for the folder (`getFigmaToken`).
- **One set of tools when both are installed.** The extension's server writes a small lock file under `$XDG_CONFIG_HOME/open-design/` while it runs. A server started by the plugin's launcher, talking to a client other than Claude Code, lists no tools while a live extension instance holds the lock, and sends `tools/list_changed` when that changes. Claude Code (CLI, IDE, Desktop Code tab) never defers, because it doesn't load Desktop extensions. Skills name tools without the `mcp__plugin_…` prefix (checked: no copy under `packages/claude-plugin/skills` or `packages/content` does), so they work with either server.
- **Release.** `.github/workflows/release.yml` builds the `.mcpb` after the npm tarballs are packed, validates it, smoke-tests it (unzip, start with Node, MCP `initialize` and `tools/list`), writes a `.sha256` and attaches both to the same GitHub Release. The extension's version is the release version.
- **Docs.** `docs/getting-started/claude-desktop.md` gains "Install the desktop extension" (download from Releases, double-click, fill in the form, update by reinstalling) and the plugin + extension setup. Plus troubleshooting entries (duplicate tools, outdated extension, token not used), `docs/reference/settings-and-env.md` (`OPEN_DESIGN_DEFAULT_WORKSPACE`), `docs/guides/figma.md` (token through the extension's settings) and the README install table.

Not in this change: embedding the `.mcpb` in the plugin, a directory listing, signing, an update check that contacts the network, and making Chat without a folder able to author designs (see design.md, Open Questions).

## Capabilities

### New Capabilities
- `claude-desktop-extension`: the `.mcpb` bundle, its settings form and environment mapping, offline start on Desktop's bundled Node, and deferring to it when both it and the plugin are installed.

### Modified Capabilities
- `open-design-agent-plugins`: workspace root precedence gains `OPEN_DESIGN_DEFAULT_WORKSPACE` as the last fallback before the working directory.
- `npm-package-publishing`: the shared GitHub Release also carries the `.mcpb` and its checksum.

## Impact

- New: `packages/desktop-extension/` (`manifest.template.json`, `scripts/build-mcpb.mjs`, `package.json` with the pinned `@anthropic-ai/mcpb`), root workspace entry and lockfile.
- `packages/mcp-server/src/env.ts` (default workspace, placeholder handling, lock-file helpers), `src/index.ts` (precedence, guard, deferral, `tools/list_changed`), unit tests.
- `packages/claude-plugin/scripts/open-design-mcp.mjs`: sets `OPEN_DESIGN_LAUNCHER=claude-plugin` in the child's environment. No change to `.mcp.json` (its lint still forbids `${user_config.*}`).
- `.github/workflows/release.yml` (build, validate, smoke test, checksum, attach, summary). `scripts/test-npm-publish.mjs`'s handshake reused for the smoke test.
- Docs listed above, CHANGELOG.
- Depends on desktop-set-workspace-tool (archived first; this change's MODIFIED workspace requirement builds on its version) and desktop-figma-token-source. The plugin keeps its pin at 0.1.8 until the parked server release with `set_open_design_workspace` ships; the extension always carries the server from its own release.
