## 1. Server

- [ ] 1.1 `env.ts`: managed root (`OPEN_DESIGN_MANAGED_ROOT`, else `~/Open Design`), name-to-slug, and a containment check that resolves symlinks and rejects anything outside `<workspace>/<outputDir>/`
- [ ] 1.2 `use_open_design_managed_workspace`: create or reopen the folder, rebuild the context in `main()`, mark the session as managed; reply with the absolute folder path
- [ ] 1.3 `write_open_design_file`: managed-only, output-directory-only, file-type allowlist, server-owned names refused, 5 MiB cap, base64 for binary types; write bytes unchanged; return path, bytes and SHA-256
- [ ] 1.4 Listing rule: list both tools only when the server has no folder of its own (home cwd, no override, no roots), evaluated after the first roots lookup
- [ ] 1.5 Home-folder guard text names `use_open_design_managed_workspace` for users with no folder
- [ ] 1.6 Unit tests: refusal outside a managed workspace, `..` and symlink escapes, sidecar names, disallowed type, oversize, byte-exact round trip, listing in a project cwd vs home cwd

## 2. Publishing

- [ ] 2.1 `composeArtifactPublishInstructions`: inline variant for managed workspaces (standalone page as text up to 2 MiB, else the too-large message with the file path)
- [ ] 2.2 Publish handler passes the managed flag; tests for both branches

## 3. Skills and docs

- [ ] 3.1 Overview skill: no-folder Desktop line (managed workspace, write tool, say the folder path, skip the per-round artifact preview); no-tools fallback line; regenerate copies and pass the drift check
- [ ] 3.2 `docs/getting-started/claude-desktop.md` "Chat without a folder" rewrite and table row; filesystem-extension alternative in one paragraph
- [ ] 3.3 `docs/guides/inline-preview.md` row correction; `docs/reference/tools.md` entries; troubleshooting entry for files not found
- [ ] 3.4 After add-claude-desktop-guide archives, update the `claude-desktop-surfaces` "Chat without a folder" scenario to match

## 4. Verification

- [ ] 4.1 Desktop Chat with no folder and the server installed via `claude_desktop_config.json` (or the add-desktop-extension-bundle `.mcpb`): poster from a brief, inline preview, one comment applied, PNG export; files appear in `~/Open Design/<name>/`
- [ ] 4.2 Same chat with code execution on: confirm the agent writes through the tool, not only its sandbox (design open question 1)
- [ ] 4.3 claude.ai web chat with the plugin only: the agent explains what's missing and, asked to proceed, publishes one page as an artifact
- [ ] 4.4 Claude Code: neither tool is listed
