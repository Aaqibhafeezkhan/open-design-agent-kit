## ADDED Requirements

### Requirement: Supported Claude Desktop Surfaces
The kit SHALL support Claude Desktop's Code tab and Chat with a connected folder through the same Claude Code plugin, and SHALL document that Chat without a folder is not supported because it has no tool that writes to the user's disk. In Chat with a folder the MCP server runs on the user's machine and the agent sets the workspace with `set_open_design_workspace`.

#### Scenario: Chat with a folder
- **WHEN** the plugin is installed in Desktop and the person asks for a poster in a Chat with a connected folder
- **THEN** the skills SHALL load, the server SHALL start, and the design SHALL be written in that folder

#### Scenario: Chat without a folder
- **WHEN** the person asks for a design in a Chat with no folder
- **THEN** the documentation SHALL say the kit can't write files there and how to connect a folder

### Requirement: Code Tab Path Hand-Off
After registering or updating a design, and after building an exploration's comparison page or contact sheet, the Claude skills SHALL give each file's workspace-relative path on its own line, so a click in the Code tab opens it in the Browser pane.

#### Scenario: Poster registered in the Code tab
- **WHEN** the agent registers `.open-design/coffee-poster/coffee-poster.html`
- **THEN** its reply SHALL contain that path on its own line
