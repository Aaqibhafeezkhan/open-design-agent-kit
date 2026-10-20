## ADDED Requirements

### Requirement: Preview MCP App Resource
The MCP server SHALL register an MCP Apps UI resource `ui://open-design/preview`: a single self-contained HTML page holding the preview shell and comment controller shared with the browser preview, using a transport over the MCP Apps bridge. The page SHALL render the design in a nested frame from its standalone export, and the resource SHALL declare the remote domains the design still needs (at least Google Fonts) in its content-security metadata.

#### Scenario: Design renders inline
- **WHEN** Claude Desktop Chat shows the preview for a registered poster that uses Google Fonts
- **THEN** the poster SHALL render inline with its fonts

### Requirement: Show Artifact Tool
The MCP server SHALL provide `show_open_design_artifact` taking `entryPath`, declaring the preview resource as its UI. Hosts that support MCP Apps SHALL show the design inline. Every host SHALL also receive a text result with the title, entry path and open comments, and, for hosts without MCP Apps, a hint to use `open_open_design_preview`.

#### Scenario: Host without MCP Apps
- **WHEN** the Claude Code terminal calls `show_open_design_artifact`
- **THEN** it SHALL get the text result and no error

#### Scenario: Unregistered entry
- **WHEN** the entry has no manifest
- **THEN** the tool SHALL return a not-registered result

### Requirement: App-Only Comment Tools
The server SHALL provide `save_open_design_comment` (create, edit or delete one comment in `<entry>.comments.json`, using the same record and merge-by-id write as the browser preview) and `get_open_design_preview_state` (entry content, comments, latest check images), both visible to the app and not to the model.

#### Scenario: Comment saved from the inline page
- **WHEN** the person clicks the headline in the inline preview and saves "too dark"
- **THEN** the sidecar SHALL contain that comment anchored to the headline, and `get_open_design_artifact` SHALL list it as open

#### Scenario: Hidden from the model
- **WHEN** the model's tool list is requested
- **THEN** it SHALL NOT include the app-only tools

### Requirement: Hand-Off to Chat
"Ask Claude to apply" SHALL send a chat message through the bridge naming the entry and the open comment ids. Export actions SHALL send a chat request for `export_open_design_artifact` with the chosen format; the page SHALL NOT start a download or rely on opening links.

#### Scenario: Apply comments
- **WHEN** the person clicks "Ask Claude to apply" with one open comment
- **THEN** a message naming the entry and that comment SHALL appear in the chat

#### Scenario: Export from the page
- **WHEN** the person clicks "Export PNG"
- **THEN** a chat request SHALL be sent, and the export SHALL be written by the server tool, not downloaded by the page

### Requirement: Exploration Picks Inline
For an exploration, the preview SHALL show its directions side by side with a "take this one" action that sends the choice to the chat. The agent SHALL call `choose_open_design_direction` only after the person confirms.

#### Scenario: Pick a direction
- **WHEN** the person clicks "take this one" on direction B
- **THEN** a chat message naming direction B SHALL be sent
