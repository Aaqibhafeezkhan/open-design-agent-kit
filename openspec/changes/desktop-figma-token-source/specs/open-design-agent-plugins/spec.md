## ADDED Requirements

### Requirement: No Plugin Settings in the Server Registration
The Claude Code plugin's `.mcp.json` SHALL NOT refer to plugin settings (`${user_config.*}`), because Claude Desktop does not start a plugin server whose registration does. The plugin's lint step SHALL fail when it does.

#### Scenario: Plugin server starts in Claude Desktop
- **WHEN** the plugin is installed in Claude Desktop and a Chat with a connected folder starts
- **THEN** the `open-design` server SHALL NOT be reported as `not_started` with reason `user_config_unsupported`

#### Scenario: Regression caught
- **WHEN** someone adds `"${user_config.figma_token}"` to `.mcp.json`
- **THEN** the plugin lint SHALL fail and name the offending reference
