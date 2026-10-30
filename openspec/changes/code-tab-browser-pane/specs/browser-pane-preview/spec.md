## ADDED Requirements

### Requirement: Browser Pane Setup Tool
The server SHALL provide `set_up_open_design_browser_pane`, which merges the `open-design-preview` configuration into `<workspace>/.claude/launch.json`: it SHALL create the file when absent, replace only a configuration with that name, keep every other configuration and field, leave the file unchanged when nothing would change, and refuse a malformed file without overwriting it. It SHALL return the configuration name, the port, and whether the file was created, updated or unchanged. `init --tools claude` SHALL use the same merge.

#### Scenario: Plugin user without a launch file
- **WHEN** the agent calls `set_up_open_design_browser_pane` in a project with no `.claude/launch.json`
- **THEN** the file SHALL be created with one `open-design-preview` configuration and the result SHALL say `created`

#### Scenario: Existing configurations
- **WHEN** `.claude/launch.json` already lists a `web` configuration
- **THEN** after the call it SHALL list `web` unchanged and `open-design-preview`

#### Scenario: Malformed file
- **WHEN** `.claude/launch.json` isn't valid JSON
- **THEN** the tool SHALL return an error naming the file and SHALL NOT change it

### Requirement: Launch Entry Starts Without PATH Fixes
The configuration's `runtimeExecutable` SHALL be the absolute path of `npx` (`npx.cmd` on Windows) in the directory of the Node executable running the server or CLI, when that file exists, and `npx` otherwise. Its `runtimeArgs` SHALL pin the package to the running server's or CLI's version.

#### Scenario: Node from nvm
- **WHEN** the server runs under `~/.nvm/versions/node/v22.11.0/bin/node`
- **THEN** `runtimeExecutable` SHALL be `~/.nvm/versions/node/v22.11.0/bin/npx`, expanded to an absolute path

### Requirement: Port Per Project
The configuration's port SHALL be `5317 + (FNV-1a hash of the workspace's real path) mod 100`, passed as both `port` and `--port`, so the same workspace always gets the same port.

#### Scenario: Two projects
- **WHEN** setup runs in two different workspaces
- **THEN** each SHALL get the port computed from its own path, and re-running setup in either SHALL keep its port

### Requirement: Pane Opens on the Newest Design
The preview SHALL accept `--root-latest`, which redirects a GET or HEAD of `/` to the shell URL of the registered artifact with the newest manifest, or to the artifact list when there is none. The launch configuration SHALL use `--root-latest`. `--root-redirect` SHALL keep its current behaviour.

#### Scenario: After a new design
- **WHEN** the pane loads `/` after the agent registered `.open-design/poster/poster.html` most recently
- **THEN** it SHALL be redirected to that artifact's preview

### Requirement: Skill Uses the Pane in the Code Tab
Where the Code tab's preview tool is in the agent's tools, the overview skill SHALL tell the agent, when it first shows a design in the session, to call `set_up_open_design_browser_pane`, tell the user once in one sentence that it added a preview entry to `.claude/launch.json`, and start `open-design-preview` with the preview tool instead of calling `open_open_design_preview`. Elsewhere the skill SHALL keep `open_open_design_preview`.

#### Scenario: Code tab
- **WHEN** the agent registers its first design in a Code tab session with the preview tool available
- **THEN** it SHALL set up the pane and start `open-design-preview` there, and SHALL NOT call `open_open_design_preview`

#### Scenario: Claude Code terminal
- **WHEN** the agent registers its first design in the terminal, where no preview tool is listed
- **THEN** it SHALL call `open_open_design_preview` as today
