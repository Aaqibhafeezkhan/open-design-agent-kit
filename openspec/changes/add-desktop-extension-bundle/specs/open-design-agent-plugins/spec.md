## MODIFIED Requirements

### Requirement: MCP Server Workspace Root and Local Persistence
The MCP server SHALL choose its workspace root in this order: a folder the agent set with `set_open_design_workspace`; the `OPEN_DESIGN_WORKSPACE_ROOT` environment variable; the client's MCP roots, when the client advertises them; the `OPEN_DESIGN_DEFAULT_WORKSPACE` environment variable, when it names an existing directory; its own working directory (`process.cwd()` at launch). It SHALL persist the active design system id as a local JSON file (`.open-design/config.json` under the workspace root) rather than any editor-specific settings store, and SHALL write generated artifacts and manifests under the same workspace-root-relative `.open-design/` convention the VS Code extension uses by default.

#### Scenario: Default workspace root
- **WHEN** the MCP server is launched with neither `OPEN_DESIGN_WORKSPACE_ROOT` nor `OPEN_DESIGN_DEFAULT_WORKSPACE` set, the client advertises no roots, and the agent sets no folder
- **THEN** it SHALL treat its own process working directory as the workspace root for all file reads and writes

#### Scenario: Agent-set folder wins over roots
- **WHEN** the agent has called `set_open_design_workspace` and the client later reports different MCP roots
- **THEN** the server SHALL keep the agent's folder

#### Scenario: Default workspace replaces the working directory
- **WHEN** `OPEN_DESIGN_DEFAULT_WORKSPACE` names an existing directory, the client advertises no roots, and the agent sets no folder
- **THEN** the server SHALL use that directory instead of its working directory

#### Scenario: Active design system persists across tool calls
- **WHEN** `set_active_design_system` is invoked with a `designSystemId`, followed by a separate `prepare_open_design_brief` call with no explicit `designSystemId`
- **THEN** the second call SHALL resolve to the design system set by the first, read back from `.open-design/config.json`

#### Scenario: Stale active id degrades gracefully
- **WHEN** `.open-design/config.json` names a design system id no longer present in the vendored catalog
- **THEN** `prepare_open_design_brief` SHALL proceed as if no design system were active, rather than returning an error
