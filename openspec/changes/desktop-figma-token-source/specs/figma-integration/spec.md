## ADDED Requirements

### Requirement: Figma Token Sources on the MCP Server
The MCP server SHALL read a Figma personal access token from `OPEN_DESIGN_FIGMA_TOKEN` in its own environment and, when that is unset or empty, from the file `$XDG_CONFIG_HOME/open-design/figma-token` (defaulting to `~/.config/open-design/figma-token`), trimmed. It SHALL read the token on each tool call, not once at start-up. A missing, unreadable or empty file SHALL count as no token. The server SHALL NOT depend on a host plugin setting to receive the token.

#### Scenario: Token from the environment
- **WHEN** `OPEN_DESIGN_FIGMA_TOKEN` is set and a token file also exists
- **THEN** the server SHALL use the environment value

#### Scenario: Token from the file
- **WHEN** `OPEN_DESIGN_FIGMA_TOKEN` is unset and `~/.config/open-design/figma-token` contains a token
- **THEN** `pull_open_design_figma_frame` SHALL use that token

#### Scenario: Token saved while the server runs
- **WHEN** the token file is written after the server started
- **THEN** the next `pull_open_design_figma_frame` call SHALL use it without a restart

#### Scenario: No token anywhere
- **WHEN** neither the variable nor the file provides a token
- **THEN** the tool SHALL behave as Connector-First Figma Pull describes for no token
