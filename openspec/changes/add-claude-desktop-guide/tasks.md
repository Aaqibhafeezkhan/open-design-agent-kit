## 1. Docs

- [ ] 1.1 `docs/getting-started/claude-desktop.md`: install, Code tab, Chat with a folder, Chat without a folder, known limits
- [ ] 1.2 Link it from `docs/README.md` and the getting-started index; add troubleshooting entries (server `not_started`, writes going to the home folder, Node not found on macOS)
- [ ] 1.3 Run the docs and link checks

## 2. Skills

- [ ] 2.1 Shared instruction source: give the entry path on its own line after register/update, plus comparison page and contact sheet paths
- [ ] 2.2 Regenerate and run the drift check

## 3. init

- [ ] 3.1 Merge an `open-design-preview` configuration into `.claude/launch.json` (create if absent, keep other configurations, update ours in place)
- [ ] 3.2 Tests: fresh project, existing launch.json with other entries, re-run is a no-op
- [ ] 3.3 Confirm the exact launch.json fields against the MCP App spike's working `od-preview` entry

## 4. Verification

- [ ] 4.1 Code tab: click a poster path in the reply, it opens in the Browser pane
- [ ] 4.2 Code tab: start `open-design-preview` from launch.json, comment in the pane, ask Claude to apply
- [ ] 4.3 Chat with a folder: follow the guide from a clean plugin install (after the server release in desktop-plugin-server-launcher)
