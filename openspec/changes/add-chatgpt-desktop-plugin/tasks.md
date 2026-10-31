## 1. Format check

- [ ] 1.1 Confirm the `~/.agents/plugins/marketplace.json` entry fields and whether a local source needs a version or path field (current OpenAI docs or a `@plugin-creator` scaffold); write the result into design.md
- [ ] 1.2 Confirm the `extensions.com.openai.interface` fields used for the plugin card (name, short description, icon, brand colour)

## 2. Package

- [ ] 2.1 Move the server bundling step out of `packages/desktop-extension/scripts/build-mcpb.ts` into a shared script; the `.mcpb` build still passes `scripts/test-mcpb.mjs`
- [ ] 2.2 `packages/chatgpt-plugin/scripts/build-chatgpt-plugin.ts`: `plugin.json` from a template plus the server version, `skills/` from the Codex generator's output, `mcp.json` (stdio, `node ${PLUGIN_ROOT}/server/index.js`, `OPEN_DESIGN_LAUNCHER=chatgpt-plugin`), `server/`, icon; write `open-design-chatgpt-plugin-<version>.zip`
- [ ] 2.3 Drift check: the zip's `skills/` matches `.agents/skills/`; wired into `npm run lint`
- [ ] 2.4 Smoke test script: unzip into a temp folder outside the checkout, start the server from `mcp.json` with `${PLUGIN_ROOT}` replaced, complete an MCP handshake and `tools/list`

## 3. Server

- [ ] 3.1 `env.ts`: accept `chatgpt-plugin`; `launcherHost()`; unit tests
- [ ] 3.2 The folderless managed workspace and first-run welcome apply under `chatgpt-plugin`; unit tests
- [ ] 3.3 Claude-only handoffs (Claude Design systems, Claude artifacts, Cowork wording) are left out of replies and skill text when the host is ChatGPT; unit tests on the reply text

## 4. CLI

- [ ] 4.1 `install chatgpt [--from <zip>]`: download the release zip that matches the CLI version (or use `--from`), verify its checksum, unpack it into `~/.open-design/chatgpt-plugin/<version>/`, merge the marketplace entry, print the paths and next steps
- [ ] 4.2 Upgrade: repoint the entry and remove the older version folder; re-running the same version changes nothing
- [ ] 4.3 Malformed `marketplace.json`: refuse, print the entry; other entries are always kept
- [ ] 4.4 `uninstall chatgpt`: remove our entry and folders only
- [ ] 4.5 Unit tests for 4.1–4.4 with a temp home folder

## 5. Release and docs

- [ ] 5.1 `release.yml`: build, smoke-test, checksum, attach the zip
- [ ] 5.2 `docs/getting-started/chatgpt-desktop.md`; README install table; `docs/reference/cli.md`

## 6. Verification (needs Iven's ChatGPT account)

- [ ] 6.1 macOS: `install chatgpt`, restart, turn on in Plugins → Personal, ask in Work for a poster; the design lands in `~/Documents/Open Design`
- [ ] 6.2 Whether the local marketplace needs `.codex-plugin/plugin.json` too
- [ ] 6.3 Windows: the same flow
- [ ] 6.4 Whether the ChatGPT desktop app gives plugins a Node of its own; if so, use it and drop the Node requirement from the guide
- [ ] 6.5 Codex tab in the same app picks up the plugin
- [ ] 6.6 Record which plan was used (Free, Go, Plus) and whether Work was available
