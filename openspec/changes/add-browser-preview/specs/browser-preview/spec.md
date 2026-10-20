## ADDED Requirements

### Requirement: Preview Tool and Command
The MCP server SHALL provide `open_open_design_preview`, taking an optional `entryPath` and an optional `open` (default true). It SHALL start the preview server for the MCP process if it isn't running, open or focus a preview window when `open` is true, and return the preview URL together with how it was opened (`app-window`, `default-browser` or `not-opened`) and why, when not opened. The CLI SHALL provide `preview [entryPath]` with `--no-open`, `--port`, `--browser` and `--workspace`, which runs the same server in the foreground until interrupted and prints the URL. Without an `entryPath`, the preview SHALL list the workspace's registered artifacts to choose from.

#### Scenario: Open from Claude Code
- **WHEN** the agent calls `open_open_design_preview` with the entry path of a registered landing page and a Chromium-family browser is installed
- **THEN** a browser window SHALL show the landing page in the preview, and the tool result SHALL contain the preview URL and `app-window`

#### Scenario: Second call reuses the window
- **WHEN** the preview is already open and the agent calls the tool again for a different entry
- **THEN** the existing window SHALL navigate to that entry and no second server or window SHALL be started

#### Scenario: CLI preview
- **WHEN** a user runs `open-design-agent-kit preview .open-design/landing/index.html`
- **THEN** the command SHALL print the preview URL, open the preview, and keep running until interrupted, after which the server SHALL be closed

#### Scenario: Preview turned off
- **WHEN** `OPEN_DESIGN_PREVIEW` is `off`
- **THEN** the tool SHALL start no server and SHALL return that the preview is turned off

### Requirement: Browser Launch and Fallbacks
The preview SHALL open in this order:
1. an app window of a Chromium-family browser found by the same discovery as export (explicit path, `OPEN_DESIGN_BROWSER_PATH`, system installs, Playwright/Puppeteer caches), driven headed through `puppeteer-core` with a dedicated persistent profile that is never the user's own;
2. the system default browser (`open`, `xdg-open`, `start`; on WSL, `wslview` or `cmd.exe /c start`);
3. not opened, with the URL returned.

It SHALL skip step 1 when `OPEN_DESIGN_PREVIEW_BROWSER` is `default`. It SHALL fall back to the next step when a step fails or the window doesn't appear within 5 seconds. It SHALL NOT download a browser.

#### Scenario: No Chromium installed
- **WHEN** no Chromium-family browser is found and a default browser is available
- **THEN** the preview SHALL open in the default browser, and the result SHALL say that comment screenshots need Chrome, Edge or Chromium

#### Scenario: Remote session without a display
- **WHEN** neither a browser window nor the default browser can be opened
- **THEN** the result SHALL be `not-opened` with the URL and a short reason, and the server SHALL keep running so the user can open the URL themselves

#### Scenario: WSL
- **WHEN** the MCP server runs under WSL and headed launch of a Linux browser fails
- **THEN** the preview SHALL open in the Windows default browser at the loopback URL

### Requirement: Separate Shell and Design Origins
The preview server SHALL bind to `127.0.0.1` only and serve the preview shell and its API on one origin and the design on another (a different port). Each origin SHALL require its own random path token of at least 128 bits; requests without it SHALL get 404. The design origin SHALL serve only files inside the workspace, with the preview bridge injected into the entry and never written to disk. The API SHALL accept writes only with the shell token and an `Origin` equal to the shell origin, SHALL cap request bodies, and SHALL write only an artifact entry's `<entry>.comments.json` and `<entry>.comments/` inside the workspace.

#### Scenario: Design script tries to write comments
- **WHEN** a script in the previewed design sends a request to the comments API
- **THEN** the server SHALL reject it and the sidecar SHALL NOT change

#### Scenario: Path outside the workspace
- **WHEN** a request asks the design origin for `../` outside the workspace root
- **THEN** the server SHALL respond 403 and serve no file

### Requirement: Live Reload
While a preview is open, the server SHALL watch the entry's folder and the workspace files the entry references. When one changes, it SHALL tell the shell, which SHALL reload the design within one second of the last write, keeping the mode and scroll position. It SHALL also watch the comments sidecar and update pins and the comment list when another writer changes it.

#### Scenario: Agent edits the design
- **WHEN** the agent rewrites the entry file while the preview is open in Comment mode
- **THEN** the preview SHALL show the new content, stay in Comment mode, and keep its scroll position

#### Scenario: Agent resolves a comment
- **WHEN** a comment in the sidecar is marked resolved by another process
- **THEN** its pin SHALL disappear from the open preview without a manual reload

### Requirement: View and Comment Modes
The browser preview SHALL offer View and Comment modes with the same hover highlight, selection highlight, comment input, pins and comment list as the VS Code preview's Comment mode, through the same bridge. Edit and Tweaks SHALL NOT be offered in the browser preview.

#### Scenario: Click to comment
- **WHEN** the user switches to Comment mode, clicks a heading and saves a note
- **THEN** a pin SHALL appear on the heading and the comment SHALL be saved to `<entry>.comments.json`

#### Scenario: Bridge blocked
- **WHEN** the design prevents the bridge from reporting ready
- **THEN** Comment SHALL be shown as unavailable for that design with a short explanation

### Requirement: Send Comments to the Agent
The browser preview SHALL offer **Send to agent** for selected open comments. It SHALL mark them `sent`, copy a short instruction naming the entry and telling the agent to call `get_open_design_artifact`, and tell the user to paste it into their agent. It SHALL NOT change the design file.

#### Scenario: Hand off two comments
- **WHEN** the user selects two open comments and chooses Send to agent
- **THEN** both SHALL have status `sent` in the sidecar, the clipboard SHALL hold the instruction, and the design file SHALL be unchanged

### Requirement: Shared Preview Implementation
The preview bridge, its message protocol, the element-targeting, comment-anchor and source-patch helpers, and the comment controller SHALL live in `packages/core/src/preview` as browser-target modules with no `node:` imports, and both the VS Code Artifact Preview and the browser preview SHALL use them. The two hosts SHALL differ only in the transport between the shell and its host.

#### Scenario: No node imports in browser modules
- **WHEN** the unit tests run
- **THEN** a test SHALL fail if any browser-target module under `packages/core/src/preview` imports a `node:` module

#### Scenario: VS Code behaviour unchanged
- **WHEN** a user comments on an element in the VS Code preview after this change
- **THEN** the pin, comment list and Send to chat SHALL behave as before

### Requirement: Opening Guidance for MCP Hosts
The skills and instructions for MCP hosts SHALL tell the agent to call `open_open_design_preview` once per session after the first successful `register_open_design_artifact`, unless the user declined or the preview is off, and to read and address comments through `get_open_design_artifact` when the user says they left comments. When `OPEN_DESIGN_PREVIEW` is `auto`, `register_open_design_artifact` SHALL open the preview itself the first time in a session.

#### Scenario: Instruction sources stay in sync
- **WHEN** the instruction files are generated or checked for drift
- **THEN** the Claude Code and Codex `open-design` skills SHALL name `open_open_design_preview`
