## MODIFIED Requirements

### Requirement: MCP Server Workspace Root and Local Persistence
The MCP server SHALL treat its own working directory (`process.cwd()` at launch) as the workspace root by default, overridable via an `OPEN_DESIGN_WORKSPACE_ROOT` environment variable. It SHALL persist the active design system id as a local JSON file (`.open-design/config.json` under the workspace root) rather than any editor-specific settings store. It SHALL keep that config file under the workspace's hidden `.open-design/` folder, and SHALL write generated artifacts, their manifests, exports, saved design systems, recurring job files and check history (in a hidden `.checks/`) under the workspace's designs folder: `.open-design/`, the same convention the VS Code extension uses by default, unless the visible layout applies.

#### Scenario: Default workspace root
- **WHEN** the MCP server is launched with no `OPEN_DESIGN_WORKSPACE_ROOT` set
- **THEN** it SHALL treat its own process working directory as the workspace root for all file reads and writes

#### Scenario: Active design system persists across tool calls
- **WHEN** `set_active_design_system` is invoked with a `designSystemId`, followed by a separate `prepare_open_design_brief` call with no explicit `designSystemId`
- **THEN** the second call SHALL resolve to the design system set by the first, read back from `.open-design/config.json`

#### Scenario: Stale active id degrades gracefully
- **WHEN** `.open-design/config.json` names a design system id no longer present in the vendored catalog
- **THEN** `prepare_open_design_brief` SHALL proceed as if no design system were active, rather than returning an error

#### Scenario: Classic layout in a project
- **WHEN** the server starts in a project folder (Claude Code, Codex, VS Code) and neither Desktop workspace tool is called
- **THEN** designs, manifests and exports SHALL go under `.open-design/` exactly as before

## ADDED Requirements

### Requirement: Visible Designs Folder in Claude Desktop
When the workspace is set by `set_open_design_workspace` or `use_open_design_managed_workspace`, the server SHALL use the visible layout: designs, manifests and exports go in `Open Design/` in a connected folder (or in the workspace root itself in a managed workspace), while state stays in `.open-design/`.

#### Scenario: New connected folder
- **WHEN** the agent calls `set_open_design_workspace` on a folder with no `.open-design/` and then makes a poster named "Seed swap flyer"
- **THEN** the entry SHALL be written under `Open Design/seed-swap-flyer/` and `config.json` SHALL be under `.open-design/`

### Requirement: Classic Layout Takes Precedence
The server SHALL keep the classic layout, even when a Desktop workspace tool set the workspace, when `OPEN_DESIGN_OUTPUT_DIR` is set (that directory is then the designs folder) or when the workspace's `.open-design/` already holds a registered artifact.

#### Scenario: Folder with existing designs
- **WHEN** the folder's `.open-design/` already holds a `*.artifact.json`
- **THEN** new designs SHALL also go under `.open-design/`

#### Scenario: Explicit override
- **WHEN** `OPEN_DESIGN_OUTPUT_DIR` is `designs`
- **THEN** designs SHALL go under `designs/` regardless of how the workspace was set

### Requirement: One Managed Folder With a Subfolder per Design
In a chat with no folder, `use_open_design_managed_workspace` SHALL make the managed root the workspace: `OPEN_DESIGN_MANAGED_ROOT`, else `OPEN_DESIGN_DEFAULT_WORKSPACE` when it names an existing folder, else `Open Design` in the user's Documents folder when that exists, else `Open Design` in the home folder. It SHALL put each design in its own subfolder named by the slug of its name. Its result SHALL give that subfolder's absolute path.

#### Scenario: First design with no folder
- **WHEN** the agent calls `use_open_design_managed_workspace` with `name: "Seed swap flyer"`
- **THEN** the design SHALL be written as `~/Documents/Open Design/seed-swap-flyer/seed-swap-flyer.html` and the result SHALL give `~/Documents/Open Design/seed-swap-flyer/` as an absolute path

### Requirement: Legacy Managed Folders Reopen in Place
A per-design folder created by an earlier release, under the managed root or under the old default `~/Open Design/`, whose `.open-design/` holds registered artifacts, SHALL be reopened where it is, as its own workspace in the classic layout.

#### Scenario: Legacy managed folder
- **WHEN** `~/Open Design/coffee-poster/.open-design/coffee-poster/coffee-poster.html.artifact.json` exists and the agent asks for "Coffee poster"
- **THEN** the server SHALL reopen `~/Open Design/coffee-poster/` with its existing layout
