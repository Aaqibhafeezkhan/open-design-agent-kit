## Context

The facts this design relies on, from `/mnt/project-files/desktop-research/install-landscape.md` (21 Oct 2026; §1 Desktop extensions, §3 plugins, §7 Open Design) and the Cowork spike (`/mnt/project-files/cowork-spike/FINDINGS.md`):

| Fact | Source |
|---|---|
| The directory no longer accepts `.mcpb` listings. Local servers should ship inside a plugin. | §0.1, §1 |
| Directory extensions auto-update. A privately distributed `.mcpb` has to be reinstalled by hand. | §1 Updates |
| Desktop runs a `server.type: "node"` extension on its own bundled Node (macOS, Windows; Linux beta UNCONFIRMED). | §1 Bundled runtime |
| `user_config` gets a generated form. `sensitive` values go to the Keychain or Credential Manager and reach the server through `env`. | §1 Manifest |
| A `.mcpb` carries `prompts[]` but no skills. | §1 |
| A plugin can embed one with `"mcpServers": "./x.mcpb"`. The directory holds such a plugin for human review on every version, holds binaries and files over 256 KiB, and blocks a `.mcpb` fetched from a URL. | §1, §3d, §7.4 |
| Chat ignores a plugin's local MCP, including an embedded `.mcpb`. Cowork loads it only in a session on your computer. A Desktop extension's tools are available in Desktop Chat. | §3e, §6 |
| On Windows, Cowork spawns a plugin's `"command": "node"` from PATH, not the bundled Node (`spawn node ENOENT`; closed "not planned"). | §3e |
| In a Chat with a folder, the plugin's server runs on the host, starts in the home folder, gets no MCP roots and has no installed `node_modules`. | FINDINGS |

Where the kit stands today: the plugin (`packages/claude-plugin`) pins the server at 0.1.8 and starts it through `scripts/open-design-mcp.mjs`, which uses `npx` when there is no `node_modules`. The token comes from `OPEN_DESIGN_FIGMA_TOKEN` or the token file (desktop-figma-token-source). `set_open_design_workspace` and the home-folder guard are in `main` (desktop-set-workspace-tool), but the server release that carries them is parked.

## Goals / Non-Goals

**Goals**
- Desktop users get the kit's tools with no system Node, no npx and no first-run download.
- A form for the Figma token, kept in the OS keychain.
- A form for a default design folder.
- Installing both the plugin (for skills) and the extension (for tools) doesn't show Claude two copies of every tool.
- Built, checked and attached to the release by CI, from pinned versions.

**Non-Goals**
- A directory listing (closed to `.mcpb`).
- Auto-update or an update check that calls the network.
- Code signing (no documented enforcement; see Open Questions).
- Making Chat without a folder able to author designs. The extension's tools show up there, but Claude still has no tool that writes to your disk (add-claude-desktop-guide).
- Linux packaging beyond what `mcpb pack` produces. The manifest declares `darwin` and `win32`, plus `linux` once verified.

## Decisions

### 1. Distribution: standalone `.mcpb` on GitHub Releases (option a)

| | (a) Standalone `.mcpb` on Releases | (b) `.mcpb` embedded in the plugin | (c) Both |
|---|---|---|---|
| Desktop Chat tools | **Yes** | No (Chat ignores plugin local MCP) | Yes, via (a) |
| Chat with a folder / local Cowork | Yes | Yes | Yes, twice unless deduplicated |
| Bundled Node | Yes | UNCONFIRMED for an embedded bundle. The Windows bug report concerns `"command"` servers. | Partly |
| Token form | Desktop's extension settings | Claude Code's `/plugin` > Configure only. Cowork doesn't prompt; Chat ignores the server. | Both |
| Updates | Manual reinstall | Automatic with the plugin (marketplace) | Mixed |
| Directory impact | None (the plugin stays as it is) | Human review on every version. A multi-MB binary is held. | Same as (b) |
| Repo / release cost | One release asset | A multi-MB binary committed or synced into the plugin tree each release, so it exists before the marketplace serves the plugin | Both |
| Claude Code (CLI/IDE/Code tab) | Unaffected (doesn't load Desktop extensions) | Would replace today's lockfile install with the bundle | Same as (b) |

(b) gives up the one thing only a `.mcpb` can do, Desktop Chat, and it costs the plugin its smooth directory path. What it adds over today's plugin is a Configure form that only Claude Code shows, and Claude Code already installs the server from the lockfile and needs no npx. (c) pays (b)'s costs on top of (a)'s for a marginal gain.

**Recommendation: (a).** The plugin stays the cross-surface product: skills everywhere, the server in Claude Code and in Chat with a folder. The extension is an optional Desktop add-on, recommended to Desktop users who want no Node prerequisite, a token form, or tools in Chat. Revisit (b) if the directory starts accepting `.mcpb` without per-version review, or if Desktop Chat starts loading plugin local servers.

### 2. Avoiding duplicate tools

When a Desktop user installs both, a Chat with a folder starts two servers: the extension's and the plugin's, shown as `mcp__plugin_open-design_open-design__*`. Claude would see every tool twice, and two servers would each track their own workspace.

Options considered:
- **Docs only ("disable the plugin's server").** Desktop gives no per-server toggle for a plugin, and disabling the plugin also removes the skills. Rejected as the main answer, kept as the fallback.
- **Plugin launcher looks for Desktop's extension install folder.** Ties the kit to undocumented Desktop paths and can't tell installed from enabled. Rejected.
- **Same server name in both.** Tool names still differ by prefix. Doesn't help.
- **Chosen: a lock file written by the running extension, honored by the plugin's server.**
  - The extension sets `OPEN_DESIGN_HOST=claude-desktop-extension`. While it runs, its server holds `$XDG_CONFIG_HOME/open-design/desktop-extension.lock` (`{ pid, version, startedAt }`) and removes it on exit.
  - The plugin's launcher sets `OPEN_DESIGN_LAUNCHER=claude-plugin` for its child.
  - A server with that variable, whose client is not Claude Code (`clientInfo.name` other than `claude-code`), checks the lock on `tools/list` and before each call. A lock counts only while its `pid` is alive (`process.kill(pid, 0)`), so a crashed extension never blocks the plugin.
  - While a live lock exists, `tools/list` returns no tools, and a call that arrives anyway returns an error saying the Open Design desktop extension provides these tools.
  - The server watches the folder. When the lock appears or goes away it sends `notifications/tools/list_changed` (it declares `tools.listChanged`), which covers the plugin server starting first.
  - Claude Code never defers, because it doesn't load Desktop extensions. So the Code tab, the CLI and the IDE keep the plugin's server even when the extension is running on the same machine.

Why the extension wins: it has the bundled Node, the keychain token and the form, and it is the copy that also works in Chat without a folder. Skills call tools by bare name (`set_open_design_workspace`, `prepare_open_design_brief`, …). No skill names the `mcp__plugin_…` form, so nothing in the skill text changes. A lint check keeps it that way.

On Windows without system Node, the plugin's server fails to spawn (`ENOENT`) and Desktop shows it as failed. The extension still provides the tools. The guide says to ignore that error, and recommends the extension precisely for that machine.

### 3. Workspace folder: a suggested default, not an override

`user_config.workspace` maps to a new `OPEN_DESIGN_DEFAULT_WORKSPACE`, not to `OPEN_DESIGN_WORKSPACE_ROOT`. The existing variable outranks `set_open_design_workspace` and switches the home-folder guard off (`src/index.ts`, `syncRootsFromClient` and the guard). As an extension setting it would pin every chat to one folder, even when the user connects another.

New precedence: agent-set folder, `OPEN_DESIGN_WORKSPACE_ROOT`, MCP roots, `OPEN_DESIGN_DEFAULT_WORKSPACE`, working directory.

When the server runs as the extension (`OPEN_DESIGN_HOST=claude-desktop-extension`), its working directory is wherever Desktop starts extensions, never the user's folder, so the guard treats a working-directory root like the home folder there.

The guard also covers a root that came from the default: until the agent calls `set_open_design_workspace`, tools refuse. The message names the default as the folder to pass when no folder is connected, and otherwise says to pass the connected folder's host path. That costs one extra call. In exchange, Claude can't write into the default folder while joining paths onto a different connected folder.

### 4. Figma token

`user_config.figma_token`: `type: "string"`, `sensitive: true`, `required: false`, mapped to `env.OPEN_DESIGN_FIGMA_TOKEN`. `getFigmaToken` already prefers the variable and falls back to the token file when it is empty. An unfilled optional field may reach the server as an empty string or as a literal `${user_config.figma_token}` (UNCONFIRMED which), so the server treats a value matching `^\$\{user_config\.[^}]*\}$` as unset, here and for the folder. The plugin's `.mcp.json` stays free of `${user_config.*}`: the existing lint keeps guarding it, and the extension's manifest is a separate file outside that check.

### 5. Build

`packages/desktop-extension/scripts/build-mcpb.mjs`, run as `npm run build --workspace=packages/desktop-extension -- --content <tgz> --out <file>`:

1. Read the version from `packages/mcp-server/package.json` (already checked against the tag by `release.yml`).
2. Bundle `packages/mcp-server/src/index.ts` with the same esbuild settings and plugins as `.esbuild.ts`, except `external: ['@feimacode/open-design-agent-kit-content']` only, so the MCP SDK is inlined. Call `buildPreviewBundles` for `out/preview/`. Factor the shared options out of `.esbuild.ts` so the two builds can't drift.
3. Stage `server/out/`, `server/node_modules/@feimacode/open-design-agent-kit-content/` (extracted from the release's own content tarball: it isn't on npm yet when `release.yml` runs, and it has no dependencies), `icon.png` (copied from `packages/claude-plugin/.claude-plugin/icon.png`), and `manifest.json` rendered from the template with the version.
4. Run `mcpb validate` and then `mcpb pack <stage> <out>` from `node_modules/.bin`.

**Pinned versions.** `@anthropic-ai/mcpb` is an exact devDependency (no range), resolved through the root `package-lock.json` and installed by `npm ci`. CI never runs `npx @anthropic-ai/mcpb` or `@latest`. esbuild is the repo's locked one. The manifest declares `manifest_version: "0.3"` (the latest documented; `uv` would need 0.4, which we don't use) and `compatibility.runtimes.node: ">=18"` to match `engines`. The staged tree holds no `package-lock` resolution step at all: everything comes from this checkout or this run's tarball.

Manifest sketch:

```json
{
  "manifest_version": "0.3",
  "name": "open-design",
  "display_name": "Open Design",
  "version": "${VERSION}",
  "description": "Design landing pages, decks, posters and more with Open Design's skills and design systems.",
  "author": { "name": "feimacode" },
  "repository": { "type": "git", "url": "https://github.com/feimacode/open-design-agent-kit" },
  "license": "MIT",
  "icon": "icon.png",
  "server": {
    "type": "node",
    "entry_point": "server/out/index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/server/out/index.js"],
      "env": {
        "OPEN_DESIGN_HOST": "claude-desktop-extension",
        "OPEN_DESIGN_FIGMA_TOKEN": "${user_config.figma_token}",
        "OPEN_DESIGN_DEFAULT_WORKSPACE": "${user_config.workspace}"
      }
    }
  },
  "tools_generated": true,
  "prompts_generated": true,
  "user_config": {
    "figma_token": { "type": "string", "title": "Figma access token", "description": "Optional. Only needed to pull Figma frames when Figma's own connector isn't connected.", "sensitive": true, "required": false },
    "workspace": { "type": "directory", "title": "Default design folder", "description": "Optional. Used when a chat has no connected folder.", "required": false }
  },
  "compatibility": { "platforms": ["darwin", "win32"], "runtimes": { "node": ">=18" } }
}
```

The server already serves its remixable-example prompts over `prompts/list`. That is the nearest a `.mcpb` gets to skills, and it needs no manifest entries beyond `prompts_generated`.

### 6. CI release step

Added to `release.yml`'s `build` job, after "Pack npm packages":

1. **Build `.mcpb`:** `npm run build --workspace=packages/desktop-extension -- --content release/feimacode-open-design-agent-kit-content-$VERSION.tgz --out release/open-design-$VERSION.mcpb`.
2. **Inspect:** `mcpb info` prints the file, size and signature status (in 2.1.2 it doesn't print the manifest), and `scripts/test-mcpb.mjs` checks the bundle's `manifest.json` name and that `version` matches `$VERSION`.
3. **Smoke test:** unzip into a temp folder outside the checkout and run `node server/out/index.js` with `OPEN_DESIGN_DEFAULT_WORKSPACE` set to a temp dir. Do the same JSON-RPC `initialize` and `tools/list` handshake as `scripts/test-npm-publish.mjs`, and require `list_open_design_skills` and `set_open_design_workspace` in the list. This proves the bundle runs with no repo `node_modules`.
4. **Size guard:** fail above 40 MB. That is well over the expected size (content about 19 MB uncompressed) and catches an accidental sweep of the monorepo, the problem `--no-dependencies` solved for the `.vsix`.
5. **Checksum** `open-design-$VERSION.mcpb.sha256`, upload with the other artifacts, attach to the GitHub Release (`files:` gains `release/*.mcpb`), and list it in the release summary.

No publish workflow is needed: attaching the file to the release is the distribution step. The release body points to the Desktop guide's install section.

## Risks / Trade-offs

- **No auto-update.** Users stay on old versions. Mitigation: each release note leads with "Desktop extension: reinstall `open-design-<v>.mcpb`", and the guide explains that reinstalling keeps the settings (UNCONFIRMED; verify). The server reports its version in `serverInfo` (today hard-coded `0.1.0` in `src/index.ts`; set it from `package.json`), so troubleshooting can ask for it.
- **Plugin and extension versions drift.** The plugin pins 0.1.8 while the extension follows each release. Skills are written against tool names, which stay stable. A skill that needs a newer tool tells the user to update (existing pattern in the Desktop guide).
- **Deferral depends on `tools/list_changed`.** If Desktop ignores it, a plugin server that started before the extension keeps its tools until the next chat. That is accepted and documented, and the extension usually starts first, at app launch (verify).
- **Client name.** Deferral keys on `clientInfo.name !== "claude-code"`. Record the names Desktop Chat and the Code tab actually send (task 6.3), and narrow to an allowlist if the Code tab sends something else.
- **Bundle size** of roughly 8 to 12 MB compressed is fine for a release asset, and it is why (b) would be held by directory review.

## Open Questions

- Do `.mcpb` install and bundled Node work on Desktop's Linux beta? Add `linux` to `platforms` only after a test.
- Does Desktop enforce or reward `mcpb sign`? If it warns on unsigned bundles in a way users find alarming, add a signing step with a project certificate.
- Is the Filesystem desktop extension (or an equivalent) still offered? Pointed at the same folder as `workspace`, it would let Chat without a folder author designs. Otherwise a server-side write tool would be needed, which add-folderless-chat-support proposes (`use_open_design_managed_workspace` plus `write_open_design_file`).
- Can a cloud Cowork task reach an extension's tools through the open desktop app? (UNCONFIRMED in the research.)
