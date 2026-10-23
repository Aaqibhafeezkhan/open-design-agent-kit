## 1. Discovery

- [x] 1.1 Read `clientInfo.name` (and version) from the Desktop probe report (`~/od-probe-report.plain.json` on the test machine) or rerun the od-cowork-probe in Desktop Chat with a folder; record it in `/mnt/project-files/cowork-spike/FINDINGS.md` (captured 2026-10-23: `local-agent-mode-plugin:od-cowork-probe:od-probe`, version 1.0.0, no "claude" in it; `agentFromClientName` now matches the `local-agent-mode` prefix)
- [ ] 1.2 If reachable, capture the name a claude.ai web or Cowork cloud session sends too
- [ ] 1.3 Check how connector tools are named in Desktop's tool list (`mcp__claude_ai_<Connector>__*`, `mcp__<Connector>__*` or other) and adjust the hints

## 2. Core

- [x] 2.1 Add `claude-desktop` to `INTEGRATION_AGENTS`; `agentFromClientName` maps `claude-code` first, then any name containing `claude` to `claude-desktop`
- [x] 2.2 `toolNameHints` and `RELOAD` entries for `claude-desktop`
- [x] 2.3 `renderInstall` branch for `claude-desktop`: connector step for entries with `claudeAiConnector`; custom connector step with the Team/Enterprise Owner note for other browser sign-in servers; manual-only text for API-key header servers
- [x] 2.4 `installableOn`: `claude-ai-only` installable on `claude-desktop`; `api-key-header` manual there
- [x] 2.5 Unit tests: `claude-ai`, `Claude Desktop`, `claude-code` and an unrelated name; Canva on `claude-desktop` names Settings > Connectors and contains no `claude mcp add` or `mcpServers`; Buffer on `claude-desktop` is manual only and has no key

## 3. Server and docs

- [x] 3.1 Add `claude-desktop` to the `agent` enum of `list_open_design_integrations`
- [x] 3.2 Update the `isClaudeClient` comment to the captured name
- [x] 3.3 "In Claude Desktop" note in `docs/guides/integrations.md`; agent values in `docs/reference/tools.md` if listed

## 4. Verification

- [ ] 4.1 In Desktop Chat with a folder, ask "how do I connect Canva?" and confirm the answer uses the connector steps
