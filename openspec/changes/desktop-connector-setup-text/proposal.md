## Why

`list_open_design_integrations` picks its setup steps from the MCP client's name. `agentFromClientName` in `packages/core/src/integrations/render.ts` only knows Claude Code (`claude-code`), Codex, Cursor and VS Code; every other name becomes `generic`. When the plugin's server runs under Claude Desktop (Chat with a folder, Cowork) the client name is not `claude-code`, so the user asking "connect Canva" gets the generic text: "Add this server to the agent's user-level MCP configuration" with an `mcpServers` JSON block. That is wrong for Desktop on two counts:

- Desktop does not connect to remote servers written into `claude_desktop_config.json`; remote servers must be added as connectors (research: `/mnt/project-files/desktop-research/install-landscape.md` section 2, support 11503834).
- Canva, Figma, Notion, Google Drive, Slack and Metricool all have a `claudeAiConnector` in `packages/content/assets/open-design/integrations.json`; on Desktop the right step is to connect that connector, which only the `claude-code` branch of `renderInstall` says today.

Which name Desktop sends is not recorded anywhere we can check. The only hint is a comment on `isClaudeClient` in `packages/mcp-server/src/tools.ts` ("Claude Desktop (\"claude-ai\")"), added with the artifact preview change without a capture. The spike's probe (`/mnt/project-files/cowork-spike/od-cowork-probe/server.mjs`) does record `clientInfo` in its report, but `FINDINGS.md` doesn't quote it and the report (`~/od-probe-report.plain.json`) stayed on the test machine. So the match has to be tolerant now and confirmed later.

## What Changes

- **New agent value `claude-desktop`** in `INTEGRATION_AGENTS` (`packages/core/src/integrations/render.ts`), covering Claude Desktop Chat, Cowork and claude.ai: every surface whose MCP servers come from the claude.ai account.
- **Tolerant client match.** `agentFromClientName` keeps its current `claude-code` rule first, then maps `claude-ai` and any other name containing `claude` (case-insensitive) to `claude-desktop`. This mirrors `isClaudeClient`, so the two can't disagree about what counts as a Claude client.
- **Desktop install template** in `renderInstall`:
  - entry with a claude.ai connector (`oauth-dcr`, `own-oauth-client`, `claude-ai-only`): connect it under **Settings > Connectors** in Desktop or at https://claude.ai/customize/connectors; it is saved to the account and appears in Desktop, claude.ai, mobile and Cowork. No local command and no OAuth-client step, since the connector handles sign-in.
  - other remote server with browser sign-in: add it as a custom connector (**Customize > Connectors > Add custom connector**, paste the URL). On Team and Enterprise only an Owner can add one (**Organization settings > Connectors > Add > Custom**); members then click Connect. Free plans get one custom connector. Mobile can use connectors but can't add them.
  - API-key header server (Buffer): manual only. Custom-connector request headers are a limited beta with Anthropic-approved header names, so the template says so and points at the entry's manual fallback rather than a config file Desktop ignores.
  - reload step: start a new chat or task so the connector's tools load.
  - tool-name hints: `mcp__claude_ai_<Connector>__*` and `mcp__<Connector>__*` plus the existing "any tool whose name ends with" hint. Desktop's naming is unverified, so the suffix hint stays.
- `installableOn` (`packages/core/src/integrations/status.ts`) treats `claude-ai-only` entries as installable on `claude-desktop` too, and API-key entries as manual there.
- The MCP tool's `agent` enum in `packages/mcp-server/src/index.ts` gains `claude-desktop`.
- `docs/guides/integrations.md` gains an "In Claude Desktop" note next to the Claude Code one.
- **Discovery task:** read the client name from the probe report or a debug log on Desktop (and on claude.ai if reachable), then tighten the comment and the unit test to the captured value.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `integration-registry`: install templates gain `claude-desktop`; the MCP server infers it from Claude client names.

## Impact

- `packages/core/src/integrations/render.ts` (agent list, `agentFromClientName`, `toolNameHints`, `RELOAD`, `renderInstall`), `packages/core/src/integrations/status.ts` (`installableOn`), `packages/core/src/test/unit/integrations.test.ts`.
- `packages/mcp-server/src/index.ts` (enum), `packages/mcp-server/src/tools.ts` (comment on `isClaudeClient` once confirmed).
- `docs/guides/integrations.md`, `docs/reference/tools.md` if it lists the agent values.
- No change for VS Code (always `vscode`) or the generated integrations tables, which have no per-agent column.
