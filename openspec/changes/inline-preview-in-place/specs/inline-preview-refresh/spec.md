## ADDED Requirements

### Requirement: Inline Design Follows Edits
While visible, the inline artifact, exploration and campaign views SHALL check the design's revision through `get_open_design_preview_state` with `revisionOnly: true`, every 3 seconds, and every 10 seconds after 2 minutes with no change. When the revision changes, the view SHALL reload its state and show a brief "Updated" note. A view SHALL NOT reload while the user has an unsaved comment open, and SHALL stop checking after a failed call.

#### Scenario: Agent edits the shown design
- **WHEN** the inline view shows `.open-design/poster/poster.html` and the agent re-registers it after an edit
- **THEN** the view SHALL show the new version within a few seconds without another `show_open_design_artifact` call

#### Scenario: Comment being typed
- **WHEN** the design changes while the user is typing a comment
- **THEN** the view SHALL wait to reload until the comment is added or cancelled

#### Scenario: Hidden view
- **WHEN** the view isn't visible
- **THEN** it SHALL make no revision calls

### Requirement: Revision-Only State
`get_open_design_preview_state` SHALL accept `revisionOnly: true` with an `entryPath`, `explorationId` or campaign target and return only `{ revision }`, a short string that changes when the manifest, the entry file, a supporting file or the open comment count changes.

#### Scenario: Revision after a comment
- **WHEN** a comment is saved on the shown design
- **THEN** the revision SHALL differ from the one before

### Requirement: One Inline Copy Per Design
The overview skill SHALL tell the agent to call `show_open_design_artifact` after the first register of a design in a conversation, and afterwards only for another design or when the user asks to see it again. In a host that renders MCP Apps, `register_open_design_artifact` SHALL say "it updates by itself" when that entry was already shown in this server process, and otherwise SHALL tell the agent to call `show_open_design_artifact`, and SHALL NOT suggest `open_open_design_preview`.

#### Scenario: Second round in Chat
- **WHEN** the agent applies comments and re-registers a design already shown inline
- **THEN** the register result SHALL say the inline copy updates by itself, and the agent SHALL NOT show it again

#### Scenario: Host without MCP Apps
- **WHEN** the host doesn't render MCP Apps
- **THEN** the register result SHALL keep suggesting `open_open_design_preview`

### Requirement: Tool Annotations
Every tool the server lists SHALL carry `annotations` with `readOnlyHint`. Tools that only read or return text SHALL have `readOnlyHint: true`; tools that write in the workspace SHALL have `readOnlyHint: false` and `destructiveHint: false`; tools that reach other services SHALL also have `openWorldHint: true`. A unit test SHALL fail when a listed tool has no annotations.

#### Scenario: Listing tool
- **WHEN** a host lists the tools
- **THEN** `list_open_design_skills` SHALL have `readOnlyHint: true`

#### Scenario: Publishing tool
- **WHEN** a host lists the tools
- **THEN** `publish_open_design_artifact` SHALL have `readOnlyHint: false` and `openWorldHint: true`
