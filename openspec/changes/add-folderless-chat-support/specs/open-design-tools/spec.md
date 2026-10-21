## MODIFIED Requirements

### Requirement: Native File Authoring
The system SHALL NOT provide any tool that writes design content (HTML/CSS/JS/etc.) on the caller's behalf. Artifact content SHALL be authored by the calling model using VS Code's own native file-editing tools; the extension's only file-write responsibility is the artifact manifest sidecar. The single exception SHALL be the MCP server's `write_open_design_file`, which only writes content the calling model authored, unchanged, and only in a managed workspace created by `use_open_design_managed_workspace` for a chat where the model has no file tools that reach the server's files.

#### Scenario: Generation flow
- **WHEN** a chat agent follows the documented flow (list skills → optionally list design systems → prepare_open_design_brief → author files → register_open_design_artifact)
- **THEN** the entry and supporting files SHALL be written by the calling model's own tools, and this extension SHALL only have written the `.artifact.json` sidecar

#### Scenario: Managed workspace exception
- **WHEN** the agent in a Claude Desktop Chat with no folder writes a design through `write_open_design_file` in a managed workspace
- **THEN** the server SHALL write the model's content byte for byte, and SHALL NOT offer the same write in any workspace the model can reach with its own tools
