## 1. Server

- [ ] 1.1 `env.ts`: `getDefaultWorkspace()` reads `OPEN_DESIGN_DEFAULT_WORKSPACE` (existing directory only); treat a literal `${user_config.…}` value as unset here and in `getFigmaToken`
- [ ] 1.2 `index.ts`: precedence agent-set > `OPEN_DESIGN_WORKSPACE_ROOT` > roots > default > cwd; extend the home-folder guard to a root that came from the default, naming it in the message
- [ ] 1.3 Lock file: when `OPEN_DESIGN_HOST=claude-desktop-extension`, write `$XDG_CONFIG_HOME/open-design/desktop-extension.lock` (`pid`, `version`, `startedAt`) at start, remove on exit and on SIGINT/SIGTERM
- [ ] 1.4 Deferral: with `OPEN_DESIGN_LAUNCHER=claude-plugin` and a client other than `claude-code`, list no tools and refuse calls while a live lock exists; declare `tools.listChanged`, watch the folder and send `notifications/tools/list_changed` on change
- [ ] 1.5 Report the package version in `serverInfo` instead of the hard-coded `0.1.0`
- [ ] 1.6 Unit tests: precedence with and without default, guard message, placeholder values, live/stale/absent lock, Claude Code never defers

## 2. Plugin

- [ ] 2.1 `packages/claude-plugin/scripts/open-design-mcp.mjs`: pass `OPEN_DESIGN_LAUNCHER=claude-plugin` in the child's environment
- [ ] 2.2 Skill drift check: fail when any generated skill names a tool with the `mcp__plugin_` prefix

## 3. Extension package

- [ ] 3.1 `packages/desktop-extension/`: `package.json` (private) with an exact `@anthropic-ai/mcpb` devDependency, root workspace entry, regenerated root lockfile
- [ ] 3.2 `manifest.template.json` per design.md §5 (`manifest_version` 0.3, `server.type` node, `user_config` `figma_token` and `workspace`, `env` mapping, `compatibility`)
- [ ] 3.3 Factor shared esbuild options out of `packages/mcp-server/.esbuild.ts`; `scripts/build-mcpb.mjs` bundles with only the content package external, adds preview bundles, stages content from `--content <tgz>`, icon and manifest, then runs `mcpb validate` and `mcpb pack`
- [ ] 3.4 Local check: build from a locally packed content tarball and run the smoke test script (3.5) on the result
- [ ] 3.5 `scripts/test-mcpb.mjs`: unzip into a temp dir, start with Node, `initialize` and `tools/list` (reuse the handshake from `scripts/test-npm-publish.mjs`), assert required tools, size limit 40 MB

## 4. CI release step

- [ ] 4.1 `release.yml` build job: after "Pack npm packages", build the `.mcpb` from `release/feimacode-open-design-agent-kit-content-$VERSION.tgz`
- [ ] 4.2 `mcpb info` name and version check; run `scripts/test-mcpb.mjs`
- [ ] 4.3 Write `open-design-$VERSION.mcpb.sha256`; add `release/*.mcpb` to the upload and to the GitHub Release `files`; list it in the release summary
- [ ] 4.4 Dry run with `workflow_dispatch` `dry_run: true` and inspect the uploaded artifact

## 5. Docs

- [ ] 5.1 `docs/getting-started/claude-desktop.md`: "Install the desktop extension" (download from Releases, double-click or Settings > Extensions, fill in token and folder), "Plugin and extension together", "Updating" (reinstall the newer file); adjust "Before you start" so Node is needed only without the extension
- [ ] 5.2 `docs/troubleshooting.md`: duplicate Open Design tools, extension out of date (check `serverInfo` version), plugin server failed on Windows without Node while the extension runs, token from settings not used
- [ ] 5.3 `docs/reference/settings-and-env.md`: `OPEN_DESIGN_DEFAULT_WORKSPACE`, `OPEN_DESIGN_HOST`, `OPEN_DESIGN_LAUNCHER`; `docs/guides/figma.md`: token through the extension's settings
- [ ] 5.4 README install table and `docs/README.md`: link the extension; CHANGELOG entry; release-notes line template for "reinstall the Desktop extension"
- [ ] 5.5 Run the docs and link checks

## 6. Verification

- [ ] 6.1 macOS Desktop without Node: install the `.mcpb`, Chat with a folder makes a poster; token from the form pulls a Figma frame
- [ ] 6.2 Windows Desktop without Node: same as 6.1; the plugin's server fails to spawn and the extension's tools work
- [ ] 6.3 Record the `clientInfo.name` that Desktop Chat and the Code tab send; adjust the deferral rule if the Code tab is not `claude-code`
- [ ] 6.4 Plugin and extension both installed: Claude lists one set of tools in a Chat with a folder; the Code tab still has the plugin's tools
- [ ] 6.5 Check what an empty optional field passes (empty string or placeholder), whether reinstalling keeps settings, and whether Desktop honors `tools/list_changed`
- [ ] 6.6 Linux beta: try install and bundled Node; add `linux` to `platforms` only if it works
