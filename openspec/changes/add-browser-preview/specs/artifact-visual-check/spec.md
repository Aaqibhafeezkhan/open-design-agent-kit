## MODIFIED Requirements

### Requirement: Visual Check Tool
The system SHALL provide a `check_open_design_artifact` tool, taking `entryPath` (required) and optional `viewports`, `slides`, `maxImages` and `views`, that loads a registered HTML-based artifact (`html`, `deck-html`, `mini-app`, `svg`) in the export browser and returns screenshots as image content together with preflight findings. It SHALL NOT write files under the artifact directory or change the artifact manifest; it SHALL write only its saved run under `<outputDir>/.checks/` (see check-history). It SHALL wait for render readiness the same way export does.

#### Scenario: Check after generating a landing page
- **WHEN** the agent calls `check_open_design_artifact` on a registered landing page
- **THEN** the result SHALL contain the formatted findings as text and at least one screenshot as image content, and no file under the artifact's folder SHALL be created or modified

#### Scenario: Unsupported renderer
- **WHEN** the artifact's renderer is `markdown` or `react-component`
- **THEN** the tool SHALL return an `unsupported-kind` error naming the supported renderers

#### Scenario: No browser
- **WHEN** no Chromium-family browser is configured or installed
- **THEN** the tool SHALL return the same structured `no-browser` error as export and SHALL NOT download a browser

### Requirement: Images Delivered Natively per Host
The VS Code tool SHALL return the findings text as a `LanguageModelTextPart` followed by one `LanguageModelDataPart.image` per screenshot. The MCP server SHALL return a `text` content item followed by one `image` content item (base64 data with its MIME type) per screenshot. The text part SHALL always contain the complete findings and the saved image paths, so a client that ignores or doesn't display images still gets the full check and the user can open the images.

#### Scenario: MCP client
- **WHEN** an MCP client calls `check_open_design_artifact`
- **THEN** the response content SHALL start with a `text` item and contain one `image` item per screenshot, with `mimeType: "image/jpeg"`

#### Scenario: Other MCP tools unchanged
- **WHEN** any MCP tool other than `check_open_design_artifact` and `get_open_design_artifact` is called
- **THEN** its response SHALL be the same single `text` content item as before

### Requirement: Check-Before-Done Guidance
The instructions shipped to every host (VS Code chat instructions, the Claude Code and Codex `open-design` skills) SHALL tell the agent to call `check_open_design_artifact` after creating or substantially editing an artifact and before reporting it as done; to fix every `error`; to review the images for composition problems the checks can't measure; to stop after at most two fix rounds and tell the user about any remaining findings, except that for a 3D design with a review sheet the agent SHALL run the critique the check result asks for, for up to three critique rounds; and, when the result is `no-browser`, to skip the check and tell the user once that visual checking needs Chrome, Edge or Chromium. The Claude Code and Codex skills SHALL also tell the agent that the user sees the before and after screenshots in the preview's Checks panel, or at the saved paths the result lists.

#### Scenario: Instruction sources stay in sync
- **WHEN** the instruction files are generated or checked for drift
- **THEN** each host's instructions SHALL contain the check-before-done guidance naming `check_open_design_artifact`
