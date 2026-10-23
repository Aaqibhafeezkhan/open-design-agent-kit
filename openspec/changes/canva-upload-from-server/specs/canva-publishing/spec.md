## MODIFIED Requirements

### Requirement: Connector-Aware Canva Instructions
`publish_open_design_artifact_to_canva` SHALL be available on both the VS Code extension and the MCP server with the input `entryPath` and the optional inputs `filePath` and `uploadUrl` (route B, below). Called with `entryPath` alone, it SHALL compose instructions without writing files or contacting Canva. After deriving metadata and exporting (`pptx` for a deck, `pdf` otherwise), the instructions SHALL:
1. direct the agent to call `list_open_design_integrations` with `integration: "canva"`;
2. have it check its own tools, including deferred ones, for Canva's tools.

When Canva is connected, the instructions SHALL:
- describe route A (editable import through a temporary public link) and route B (private upload into Canva's Uploads);
- recommend A;
- require the user's choice before continuing.

When Canva isn't connected, they SHALL offer setup once per the integration rules. If the user declines, or setup fails, they SHALL continue with the manual import steps (route C).

#### Scenario: Canva tool available on the MCP server
- **WHEN** an MCP client calls `publish_open_design_artifact_to_canva` with a registered artifact's `entryPath`
- **THEN** it SHALL return the same instructions the VS Code tool returns for that artifact

#### Scenario: Route choice required
- **WHEN** the instructions are composed for any registered artifact
- **THEN** they SHALL describe routes A and B, recommend A, and tell the agent to wait for the user's choice before hosting or uploading anything

#### Scenario: Manual fallback kept
- **WHEN** Canva isn't connected and the user declines setup
- **THEN** the instructions SHALL direct the agent to hand over the exported file with Canva's own Import a file steps

### Requirement: Private Upload Route
Route B SHALL:
1. call Canva's `create-upload-url`;
2. call `publish_open_design_artifact_to_canva` again with `filePath` (the export) and `uploadUrl` (the returned URL), so that the server POSTs the export's raw bytes to that URL with `Content-Type: application/octet-stream`;
3. tell the user that the file is in Canva's Uploads and becomes an editable design when they open it there.

It SHALL NOT claim a design was created. A used or expired upload URL SHALL be replaced by calling `create-upload-url` again.

The server SHALL send nothing unless `uploadUrl` is an https URL on `canva.com` or one of its subdomains and `filePath` is a file in the artifact's `exports/` folder.

#### Scenario: Upload is not a design
- **WHEN** route B instructions are composed
- **THEN** they SHALL have the agent pass `filePath` and `uploadUrl` to `publish_open_design_artifact_to_canva`, SHALL NOT need a terminal, and SHALL state that the result is a file in Uploads, not a design

#### Scenario: Server uploads the export
- **WHEN** the tool is called with an exported PDF's `filePath` and a canva.com `uploadUrl`
- **THEN** it SHALL POST the file's bytes as `application/octet-stream` and return the `fileId` Canva answered

#### Scenario: Guards
- **WHEN** `uploadUrl` is not on canva.com, or `filePath` is outside the artifact's `exports/` folder
- **THEN** the tool SHALL send nothing and say so
