## ADDED Requirements

### Requirement: Managed Workspace for Chats Without a Folder
The MCP server SHALL provide `use_open_design_managed_workspace` (MCP only) with a required `name`. It SHALL create, or reopen, a folder named by the slug of `name` under `OPEN_DESIGN_MANAGED_ROOT`, defaulting to `Open Design` in the user's home folder. It SHALL make that folder the session's workspace root as `set_open_design_workspace` does, mark the workspace as managed, and return the folder's absolute path.

#### Scenario: First design in a chat with no folder
- **WHEN** the agent calls `use_open_design_managed_workspace` with `name: "Coffee poster"`
- **THEN** the server SHALL create `~/Open Design/coffee-poster/`, later tools SHALL work there, and the result SHALL give that absolute path

#### Scenario: Continuing in a later chat
- **WHEN** a later session calls the tool with the same name
- **THEN** the server SHALL reopen the existing folder without removing anything in it

### Requirement: Home-Folder Guard Names the Managed Workspace
When the home-folder guard refuses a tool, its message SHALL also say that if the user has no folder, the agent can call `use_open_design_managed_workspace`.

#### Scenario: Agent in a chat with no folder skips the step
- **WHEN** the server runs in the home folder with nothing set and the agent calls `prepare_open_design_brief`
- **THEN** the refusal SHALL name both `set_open_design_workspace` and `use_open_design_managed_workspace`

### Requirement: Scoped File Write in a Managed Workspace
The MCP server SHALL provide `write_open_design_file` (MCP only) with a required workspace-relative `path`, a required `content`, and an optional `encoding` of `"base64"`. It SHALL write `content` unchanged, never generating or altering design content, and SHALL return the path, byte count and SHA-256 of what it wrote. When the session's workspace is not managed it SHALL refuse, write nothing, and tell the agent to write the file with its own file tools.

#### Scenario: Agent writes a poster in a managed workspace
- **WHEN** the agent calls `write_open_design_file` with `.open-design/coffee-poster/coffee-poster.html` and its HTML
- **THEN** the file SHALL contain exactly those bytes, and a following `register_open_design_artifact` for that path SHALL succeed

#### Scenario: Refused in a user's folder
- **WHEN** the workspace was set with `set_open_design_workspace` or comes from the working directory or MCP roots
- **THEN** the tool SHALL refuse and say to use the agent's own file tools

### Requirement: Write Tool Limits
`write_open_design_file` SHALL refuse, writing nothing, when the path resolves outside the workspace's output directory (including through `..` or a symlink), when the file is server-owned (`*.artifact.json`, `*.comments.json`, `config.json`, export output, check screenshots), when its extension is not a design text, image or font type (`.html .htm .css .js .mjs .json .svg .md .txt .csv .png .jpg .jpeg .webp .gif .woff .woff2`), or when the decoded content exceeds 5 MiB.

#### Scenario: Escape refused
- **WHEN** the path is `../../.bashrc`
- **THEN** the tool SHALL refuse and SHALL NOT write anything

#### Scenario: Sidecar refused
- **WHEN** the path is `.open-design/coffee-poster/coffee-poster.html.artifact.json`
- **THEN** the tool SHALL refuse and point to `register_open_design_artifact`

#### Scenario: Oversize refused
- **WHEN** the decoded content is 6 MiB
- **THEN** the tool SHALL refuse and name the 5 MiB limit

### Requirement: Folderless Tool Listing
The MCP server SHALL list `use_open_design_managed_workspace` and `write_open_design_file` only when it has no folder of its own: its working directory is the user's home folder, `OPEN_DESIGN_WORKSPACE_ROOT` is unset, and the client reported no usable MCP root after the first roots lookup.

#### Scenario: Claude Code project
- **WHEN** Claude Code starts the server in a project folder
- **THEN** neither tool SHALL appear in `tools/list`

#### Scenario: Desktop Chat with the server installed directly
- **WHEN** Claude Desktop starts the server in the home folder with no roots
- **THEN** both tools SHALL appear in `tools/list`

### Requirement: Artifact Publishing From a Managed Workspace
When `publish_open_design_artifact` runs with `provider: "claude-artifact"` in a managed workspace, the instructions SHALL carry the standalone page's content as text for the agent to publish with its Artifact tool, instead of a file path, when the page is at most 2 MiB; above that they SHALL say the page is too large to publish from this chat and give the file's absolute path. In any other workspace the provider SHALL behave as before.

#### Scenario: Small poster
- **WHEN** a 300 KB poster is published as a Claude artifact from a managed workspace
- **THEN** the result SHALL carry the page's content and SHALL NOT ask the agent to publish a file path

#### Scenario: Normal project unchanged
- **WHEN** the same call runs in a Claude Code project
- **THEN** the instructions SHALL still ask the agent to publish the file by its path

### Requirement: Managed Workspace Guidance
The `open-design` overview skill for the Claude plugin and its generated copies SHALL tell the agent that in Claude Desktop Chat with no folder, when `use_open_design_managed_workspace` is available, it calls that tool first, tells the user the folder's absolute path, writes design files with `write_open_design_file`, and shows designs with `show_open_design_artifact` instead of a per-round Claude artifact preview.

#### Scenario: Copies stay in sync
- **WHEN** the skills are generated or checked for drift
- **THEN** every copy of the overview skill SHALL name `use_open_design_managed_workspace` and `write_open_design_file`

### Requirement: No-Server Fallback Guidance
The `open-design` overview skill and its generated copies SHALL tell the agent that when it has no Open Design tools at all, it says what's missing (connect a folder, or install the Open Design desktop extension) and, only if the user wants to go ahead, makes one self-contained page and publishes it with its own Artifact tool.

#### Scenario: Web chat with only the plugin's skills
- **WHEN** a claude.ai web chat loads the skill and no Open Design tools are present
- **THEN** the skill SHALL direct the agent to explain what's missing before making anything
