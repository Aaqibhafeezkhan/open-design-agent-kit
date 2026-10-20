## ADDED Requirements

### Requirement: Plugin Server Launcher
The Claude Code plugin SHALL start its MCP server through a launcher script in the plugin (`bin/open-design-mcp.mjs`) that has no dependencies of its own. When the pinned server package is installed in the plugin's `node_modules`, the launcher SHALL run it with the current Node. Otherwise it SHALL run `npx -y @feimacode/open-design-agent-kit-mcp@<pin>`, where `<pin>` is the version the plugin's `package.json` depends on. It SHALL pass stdio through, exit with the server's exit code, forward SIGINT and SIGTERM, and print an error naming the command when it can't be started.

#### Scenario: Claude Code install
- **WHEN** the plugin is installed by Claude Code, which installs its locked dependencies
- **THEN** the launcher SHALL run the server from `node_modules` and SHALL NOT call npx

#### Scenario: Claude Desktop install
- **WHEN** the plugin is installed in Claude Desktop, which installs no plugin dependencies
- **THEN** the launcher SHALL run the same pinned version through npx, and the server's tools SHALL appear in the chat

#### Scenario: Node missing
- **WHEN** the fallback command can't be started
- **THEN** the launcher SHALL exit non-zero with a message saying Node.js 18 or later must be on PATH

## MODIFIED Requirements

### Requirement: Claude Code Plugin Bundle
The system SHALL provide a Claude Code plugin (`packages/claude-plugin`) bundling an MCP server registration for `packages/mcp-server`, one skill document (`skills/open-design/SKILL.md`) describing the end-to-end OpenDesign workflow, and a generated set of slash commands for curated vendored entries — mirroring, respectively, the VS Code extension's tool registration, its single `chatInstructions` document, and its generated `chatPromptFiles`. The server registration SHALL start the server through the Plugin Server Launcher, so the same plugin works in Claude Code and in Claude Desktop. The plugin SHALL be installable directly from this repository via a root-level `.claude-plugin/marketplace.json`. The system SHALL NOT generate an individual Claude Skill per vendored OpenDesign skill or design-template.

#### Scenario: Plugin installs from the repo directly
- **WHEN** a user adds this repository as a Claude Code plugin marketplace and installs the OpenDesign plugin
- **THEN** the MCP server, the overview skill document, and the generated per-entry skills SHALL all become available in that Claude Code session without any manual MCP configuration step

#### Scenario: Plugin installs in Claude Desktop
- **WHEN** a user installs the same plugin in Claude Desktop and opens a Chat with a connected folder
- **THEN** the skills SHALL load and the MCP server SHALL start, without the user running `npm install`

#### Scenario: One overview skill document, not one per full-catalog entry
- **WHEN** the Claude Code plugin is installed
- **THEN** exactly one OpenDesign overview skill document SHALL be present, and the long tail of vendored skills/design-templates beyond the curated subset SHALL remain reachable only through the `list_open_design_skills` MCP tool, not as individually registered Claude Skills

#### Scenario: Curated entries get their own explicit-only skill
- **WHEN** a vendored catalog entry carries the same curation signal (`featured`, `recommended`, or `od.default_for`) that drives a VS Code prompt file today
- **THEN** the Claude Code plugin's `skills/` directory SHALL include a corresponding `disable-model-invocation: true` skill generated from that same signal, invocable as `/open-design:<id>`
