## MODIFIED Requirements

### Requirement: Per-Agent Install Templates
For each installable entry, the system SHALL render install steps for `claude-code`, `claude-desktop`, `codex`, `vscode`, `cursor` and `generic`. Each template SHALL include:
- the command or config snippet;
- the sign-in step;
- any reload step;
- a verify step naming the tool-name patterns to look for.

Templates SHALL:
- target user-level configuration, never a project file that is committed to the repository;
- reference secrets only through an env var or the agent's secret-input mechanism, never as a literal value.

For `claude-code`, an entry with a claude.ai connector SHALL list connecting it on claude.ai before the local command. A `claude-ai-only` entry SHALL render only the claude.ai step and state that other agents are unsupported. An entry with `installable: false` SHALL render only its manual setup steps.

For `claude-desktop` (Claude Desktop Chat, Cowork and claude.ai):
- an entry with a claude.ai connector, including a `claude-ai-only` entry, SHALL render connecting it under Settings > Connectors in Desktop or at claude.ai's connectors page, and SHALL say the connector is saved to the account and appears in Desktop, claude.ai, mobile and Cowork;
- another remote server with a browser sign-in SHALL render adding it as a custom connector by URL, and SHALL say that on Team and Enterprise plans only an Owner adds custom connectors, after which members connect with their own account;
- an entry that needs an API-key header SHALL be manual only and SHALL NOT render a `claude_desktop_config.json` or `mcpServers` snippet;
- no `claude-desktop` template SHALL contain a shell command.

#### Scenario: API-key provider on Codex
- **WHEN** the Buffer template is rendered for `codex`
- **THEN** it SHALL configure the bearer token through `bearer_token_env_var = "BUFFER_API_KEY"` and SHALL NOT contain any literal key

#### Scenario: Connector-first on Claude Code
- **WHEN** the Canva template is rendered for `claude-code`
- **THEN** its first step SHALL be connecting Canva at claude.ai's connectors page, followed by the `claude mcp add --transport http --scope user` alternative

#### Scenario: Self-hosted official server
- **WHEN** the X template is rendered for any agent
- **THEN** it SHALL contain only the manual setup steps, with no install command

#### Scenario: Connector on Claude Desktop
- **WHEN** the Canva template is rendered for `claude-desktop`
- **THEN** its first step SHALL be connecting Canva under Settings > Connectors or at claude.ai's connectors page, and it SHALL NOT contain `claude mcp add` or an `mcpServers` snippet

#### Scenario: API-key provider on Claude Desktop
- **WHEN** the Buffer template is rendered for `claude-desktop`
- **THEN** it SHALL be manual only and SHALL contain no config snippet and no key

### Requirement: Integration Lookup Tool on Every Host
The VS Code extension and the MCP server SHALL both expose `list_open_design_integrations` with the same inputs (`capability`, `integration`, `platform`, `agent`, all optional) and the same output shape.

With no filters, the tool SHALL return a compact catalog of entries. With filters, it SHALL return:
- the resolved providers in priority order;
- each provider's caveats and tool-name hints;
- the install template for the agent;
- the consent rules.

The VS Code host SHALL treat the agent as `vscode`. The MCP server SHALL infer the agent from the client name sent during the MCP handshake, falling back to `generic`. A name that identifies Claude Code SHALL map to `claude-code`; any other name containing `claude`, case-insensitive (Claude Desktop sends one such as `claude-ai`), SHALL map to `claude-desktop`. An explicit `agent` input SHALL override the inferred value.

The tool SHALL NOT write files, run commands or contact any third-party service.

#### Scenario: Same answer on both hosts
- **WHEN** the tool is called with `integration: "canva"` and `agent: "cursor"` on the VS Code extension and on the MCP server
- **THEN** both SHALL return the same providers, hints and Cursor install template

#### Scenario: Agent inferred from the MCP client
- **WHEN** the MCP server's client identified itself as Codex during the handshake and the tool is called without `agent`
- **THEN** the returned install template SHALL be the Codex template

#### Scenario: Unknown client
- **WHEN** the MCP client's name is not recognized and no `agent` is given
- **THEN** the tool SHALL return the generic template

#### Scenario: Claude Desktop client
- **WHEN** the MCP client identified itself as `claude-ai` and the tool is called with `integration: "figma"` and no `agent`
- **THEN** the returned install template SHALL be the `claude-desktop` template

#### Scenario: Claude Code still recognised first
- **WHEN** the MCP client identified itself as `claude-code`
- **THEN** the inferred agent SHALL be `claude-code`, not `claude-desktop`
