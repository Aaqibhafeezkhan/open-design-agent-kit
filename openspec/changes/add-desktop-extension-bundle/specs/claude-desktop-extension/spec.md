## ADDED Requirements

### Requirement: Desktop Extension Bundle
The system SHALL build a Claude Desktop extension `open-design-<version>.mcpb` from `packages/desktop-extension`. Its `manifest.json` SHALL use `manifest_version` `0.3` and `server.type` `node`, and its version SHALL equal the release version. The bundle SHALL contain the bundled MCP server with the MCP SDK inlined and the vendored content package, so that it starts with Desktop's bundled Node, with no system Node, no `npx` and no network access.

#### Scenario: Starts offline from the bundle alone
- **WHEN** the `.mcpb` is unzipped into a folder outside the repository and its entry point is started with Node with the network unavailable
- **THEN** the server SHALL answer `initialize` and SHALL list `list_open_design_skills` and `set_open_design_workspace` in `tools/list`

#### Scenario: Manifest version follows the release
- **WHEN** the bundle is built for release 0.3.0
- **THEN** `mcpb info` SHALL report name `open-design` and version `0.3.0`

### Requirement: Desktop Extension Settings
The extension's `user_config` SHALL declare an optional `figma_token` of type `string` with `sensitive: true`, mapped to `OPEN_DESIGN_FIGMA_TOKEN`, and an optional `workspace` of type `directory`, mapped to `OPEN_DESIGN_DEFAULT_WORKSPACE`. The server SHALL treat an environment value that is still a literal `${user_config.<key>}` placeholder as unset.

#### Scenario: Token from the settings form
- **WHEN** the user enters a Figma token in the extension's settings
- **THEN** `pull_open_design_figma_frame` SHALL use it without the token file

#### Scenario: Token left empty
- **WHEN** the token field is empty and Desktop passes either an empty string or the literal placeholder
- **THEN** the server SHALL fall back to `~/.config/open-design/figma-token`, as Figma Token Sources on the MCP Server describes

#### Scenario: Folder left empty
- **WHEN** the workspace field is empty
- **THEN** the server SHALL choose its workspace as if `OPEN_DESIGN_DEFAULT_WORKSPACE` were unset

### Requirement: Suggested Default Workspace
The MCP server SHALL use `OPEN_DESIGN_DEFAULT_WORKSPACE`, when set to an existing directory, as its workspace root only when no agent-set folder, no `OPEN_DESIGN_WORKSPACE_ROOT` and no client MCP root applies. Until the agent calls `set_open_design_workspace`, the home-folder guard SHALL also refuse tools while the root came from this default, and its message SHALL name the default as the folder to pass when no folder is connected.

#### Scenario: Connected folder wins over the default
- **WHEN** the extension has a default folder `/Users/a/Designs` and the agent calls `set_open_design_workspace` with the chat's connected folder
- **THEN** later tools SHALL write under the connected folder, not under `/Users/a/Designs`

#### Scenario: Guard names the default
- **WHEN** the agent calls `prepare_open_design_brief` before setting a folder and the root came from the default
- **THEN** the call SHALL fail, nothing SHALL be written, and the message SHALL name `/Users/a/Designs` and `set_open_design_workspace`

### Requirement: Extension Lock File
While it runs, the extension's server SHALL hold a lock file `$XDG_CONFIG_HOME/open-design/desktop-extension.lock` (default `~/.config/open-design/`) recording its process id, and SHALL remove it on exit. A lock whose process is not alive SHALL count as absent.

#### Scenario: Lock follows the extension's lifetime
- **WHEN** Desktop starts and later stops the extension
- **THEN** the lock SHALL exist with the server's process id while it runs and SHALL be gone after it exits

### Requirement: One Set of Tools With Plugin and Extension Installed
A server started by the Claude plugin's launcher (`OPEN_DESIGN_LAUNCHER=claude-plugin`) whose client is not Claude Code SHALL list no tools while a live extension lock exists, SHALL refuse tool calls in that state with an error naming the Open Design desktop extension, and SHALL send `notifications/tools/list_changed` when the lock appears or goes away.

#### Scenario: Both installed in a Chat with a folder
- **WHEN** the extension is running and a Chat with a folder starts the plugin's server
- **THEN** the plugin's server SHALL list no tools, and Claude SHALL see one set of Open Design tools, the extension's

#### Scenario: Claude Code keeps the plugin's tools
- **WHEN** the extension is running and the Desktop Code tab or the Claude Code CLI starts the plugin's server
- **THEN** the plugin's server SHALL list all its tools

#### Scenario: Stale lock after a crash
- **WHEN** the lock names a process that no longer exists
- **THEN** the plugin's server SHALL list all its tools

#### Scenario: Extension starts after the plugin's server
- **WHEN** the plugin's server has listed its tools and the extension then starts
- **THEN** the plugin's server SHALL send `notifications/tools/list_changed` and list no tools from then on

#### Scenario: Skills work with either server
- **WHEN** the skills are generated or checked for drift
- **THEN** no skill SHALL name a tool by its `mcp__plugin_` prefixed name, and the check SHALL fail if one does

### Requirement: Desktop Extension Documentation
The Claude Desktop guide SHALL explain how to install the extension from the GitHub release, fill in its settings, and update it by installing the newer `.mcpb`. It SHALL describe using the plugin (for skills) together with the extension (for tools), and SHALL say that the extension does not update automatically. Troubleshooting SHALL cover duplicate tools, an outdated extension, and a failed plugin server on a machine without Node while the extension runs.

#### Scenario: Desktop user without Node
- **WHEN** a Desktop user without Node.js follows the guide
- **THEN** the guide SHALL lead them to the extension and SHALL NOT require installing Node
