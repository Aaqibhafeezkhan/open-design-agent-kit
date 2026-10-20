## ADDED Requirements

### Requirement: Agent-Set Workspace Folder
The MCP server SHALL provide `set_open_design_workspace` (MCP only) with a required `path`: the absolute path, on the machine the server runs on, of the folder to work in. When `path` is not absolute or is not an existing directory, it SHALL return an error that tells the agent to pass the host machine's path for the folder (in Claude Desktop, the one `get_device_info` lists under `connectedFolders`), not the path its own file tools use. On success it SHALL make that folder the workspace root for the rest of the session and return the folder and the output directory under it.

#### Scenario: Desktop folder set
- **WHEN** the agent calls `set_open_design_workspace` with `/home/iven/work/od-test`
- **THEN** later tools SHALL read and write under that folder, and the paths they return SHALL be relative to it

#### Scenario: Sandbox path rejected
- **WHEN** the agent passes `/sessions/abc/mnt/od-test`, which doesn't exist on the server's machine
- **THEN** the tool SHALL return an error naming `connectedFolders` and SHALL NOT change the workspace

### Requirement: Home-Folder Guard
When the workspace root is the user's home folder and neither `set_open_design_workspace` nor `OPEN_DESIGN_WORKSPACE_ROOT` chose it, every tool other than `set_open_design_workspace` SHALL refuse with an error that says to call `set_open_design_workspace` with the user's folder and then retry, and that passing the home folder explicitly is allowed.

#### Scenario: Skill skipped the step
- **WHEN** Claude Desktop starts the server in `/home/iven` and the agent calls `prepare_open_design_brief` first
- **THEN** the call SHALL fail with the guard message and nothing SHALL be written under `/home/iven/.open-design`

#### Scenario: Home folder chosen on purpose
- **WHEN** the agent calls `set_open_design_workspace` with the home folder's path
- **THEN** later tools SHALL work there

### Requirement: Desktop Workspace Guidance
The `open-design` overview skill for the Claude Code plugin and its generated copies SHALL tell the agent that in Claude Desktop with a connected folder it must call `set_open_design_workspace` with the folder's host path before any other Open Design tool, and must join the workspace-relative paths other tools return onto its own path for that folder.

#### Scenario: Copies stay in sync
- **WHEN** the skills are generated or checked for drift
- **THEN** every copy of the overview skill SHALL name `set_open_design_workspace`

## MODIFIED Requirements

### Requirement: MCP Server Workspace Root and Local Persistence
The MCP server SHALL choose its workspace root in this order: a folder the agent set with `set_open_design_workspace`; the `OPEN_DESIGN_WORKSPACE_ROOT` environment variable; the client's MCP roots, when the client advertises them; its own working directory (`process.cwd()` at launch). It SHALL persist the active design system id as a local JSON file (`.open-design/config.json` under the workspace root) rather than any editor-specific settings store, and SHALL write generated artifacts and manifests under the same workspace-root-relative `.open-design/` convention the VS Code extension uses by default.

#### Scenario: Default workspace root
- **WHEN** the MCP server is launched with no `OPEN_DESIGN_WORKSPACE_ROOT` set, the client advertises no roots, and the agent sets no folder
- **THEN** it SHALL treat its own process working directory as the workspace root for all file reads and writes

#### Scenario: Agent-set folder wins over roots
- **WHEN** the agent has called `set_open_design_workspace` and the client later reports different MCP roots
- **THEN** the server SHALL keep the agent's folder

#### Scenario: Active design system persists across tool calls
- **WHEN** `set_active_design_system` is invoked with a `designSystemId`, followed by a separate `prepare_open_design_brief` call with no explicit `designSystemId`
- **THEN** the second call SHALL resolve to the design system set by the first, read back from `.open-design/config.json`

#### Scenario: Stale active id degrades gracefully
- **WHEN** `.open-design/config.json` names a design system id no longer present in the vendored catalog
- **THEN** `prepare_open_design_brief` SHALL proceed as if no design system were active, rather than returning an error
