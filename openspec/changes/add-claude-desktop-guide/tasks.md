## 1. Docs

- [x] 1.1 `docs/getting-started/claude-desktop.md`: install, Code tab, Chat with a folder, Chat without a folder, known limits
- [x] 1.2 Link it from `docs/README.md` and the getting-started index; add troubleshooting entries (server `not_started`, writes going to the home folder, Node not found on macOS)
- [x] 1.3 Run the docs and link checks

## 2. Skills

- [x] 2.1 Shared instruction source: give the entry path on its own line after register/update, plus comparison page and contact sheet paths
- [x] 2.2 Regenerate and run the drift check

## 3. init

- [x] 3.1 Merge an `open-design-preview` configuration into `.claude/launch.json` (create if absent, keep other configurations, update ours in place)
- [x] 3.2 Tests: fresh project, existing launch.json with other entries, re-run is a no-op
- [x] 3.3 Confirm the exact launch.json fields against the MCP App spike's working `od-preview` entry (same `version` and `name`/`runtimeExecutable`/`runtimeArgs`/`port` fields; the spike ran `node` by its absolute nvm path, so 4.2 should confirm Desktop finds `npx` on its PATH)
- [x] 3.4 The preview only answers under a random token path, so the launch entry passes `--root-redirect`: a GET of `/` redirects to the tokened page (opt-in; plain `preview` is unchanged)

## 4. Verification

- [ ] 4.1 Code tab: click a poster path in the reply, it opens in the Browser pane
- [ ] 4.2 Code tab: start `open-design-preview` from launch.json, comment in the pane, ask Claude to apply
- [ ] 4.3 Chat with a folder: follow the guide from a clean plugin install (after the server release in desktop-plugin-server-launcher)
