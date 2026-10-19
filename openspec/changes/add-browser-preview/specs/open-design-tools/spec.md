## MODIFIED Requirements

### Requirement: Element-Anchored Comments With Chat Handoff, No Apply Engine
The system SHALL let a user pin a comment to a specific element in the live preview (the VS Code Artifact Preview or the browser preview), persisted as a workspace-local sidecar file (`<entry>.comments.json`) rather than any external database. The system SHALL NOT provide any mechanism that applies a comment to the artifact automatically; instead, selected open comments SHALL be gathered into a scoped instruction and handed to the agent (a new chat message in VS Code, a copied instruction in the browser preview) for the calling model to act on with its own file-editing tools, matching the same mechanism by which any other requested change is made. `get_open_design_artifact` SHALL surface unaddressed comments (status `open` or `sent`) in its response as `openComments`, each with its status.

#### Scenario: Adding a comment persists it to the sidecar
- **WHEN** a user pins a comment on an element in either preview's Comment mode
- **THEN** a comment record (including an element/selector anchor and the note text) SHALL be written to `<entry>.comments.json`

#### Scenario: Sending comments to chat does not modify the artifact directly
- **WHEN** a user sends one or more open comments to chat or to the agent
- **THEN** a scoped instruction naming the targeted elements (VS Code) or the entry (browser preview) SHALL be handed off, and the artifact file SHALL remain unchanged until the calling model acts on it with its own tools

#### Scenario: Pending comments are visible to the model
- **WHEN** `get_open_design_artifact` is invoked for an entry with unaddressed comments
- **THEN** its response SHALL include those comments so the model can address them before considering the task complete

#### Scenario: Sent comments stay visible
- **WHEN** a comment has been sent to the agent but not resolved
- **THEN** `get_open_design_artifact` SHALL include it in `openComments` with status `sent`

### Requirement: Artifact Readback
The system SHALL expose `get_open_design_artifact`, returning the manifest (if present), entry file content, supporting file list and unaddressed comments for a given workspace-relative entry path. On the MCP server, when unaddressed comments have crops, the response SHALL be the JSON text followed by up to 4 of those crops as `image` items, newest first; the JSON SHALL name every comment's `screenshot` path.

#### Scenario: Registered artifact
- **WHEN** `get_open_design_artifact` is invoked with an `entryPath` that has both an entry file and a manifest sidecar
- **THEN** the manifest, entry content, and supporting file list SHALL all be returned

#### Scenario: Entry file not found
- **WHEN** `get_open_design_artifact` is invoked with an `entryPath` that does not exist
- **THEN** the tool SHALL return a clear "not found" result rather than throwing

#### Scenario: Comments with crops
- **WHEN** an entry has 6 open comments that all have crops
- **THEN** the MCP response SHALL contain one `text` item and 4 `image` items, and the text SHALL list all 6 screenshot paths

### Requirement: Artifact Registration Requires an Existing Entry File
The system SHALL expose `register_open_design_artifact`, which validates and writes an artifact manifest sidecar (`<entry>.artifact.json`) next to an already-written entry file. It SHALL reject registration when the entry file does not yet exist in the workspace. On MCP hosts its result SHALL NOT say that the host has no preview; when no preview is open it SHALL mention `open_open_design_preview`.

#### Scenario: Entry file already written
- **WHEN** `register_open_design_artifact` is invoked with an `entryPath` that exists in the workspace, plus a valid `kind` and `title`
- **THEN** a manifest sidecar SHALL be written at `<entryPath>.artifact.json` containing the validated manifest

#### Scenario: Entry file missing
- **WHEN** `register_open_design_artifact` is invoked with an `entryPath` that does not exist in the workspace
- **THEN** the tool SHALL return an error instructing the caller to write the file first, and SHALL NOT write a manifest

#### Scenario: Preview hint on MCP
- **WHEN** an MCP client registers an artifact and no preview is open
- **THEN** the result SHALL mention that `open_open_design_preview` shows it to the user
