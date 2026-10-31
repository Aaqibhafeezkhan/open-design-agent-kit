## ADDED Requirements

### Requirement: Host Probe Before Changes
The repository SHALL include a probe server that, run as a local ChatGPT plugin, records the client capabilities, `clientInfo`, which tools the model is offered, the largest tool result that reaches an MCP App view, and whether a `srcdoc` iframe with inline scripts runs. The results SHALL be recorded in this change's design before any other task in it is done.

#### Scenario: Probe run
- **WHEN** the probe plugin is installed in ChatGPT desktop and its UI tool is called
- **THEN** the probe's log SHALL hold the capabilities and `clientInfo` from `initialize` and the messages the view received

### Requirement: MCP Apps Detection in ChatGPT
The server SHALL treat a client as an MCP Apps host when it lists the `io.modelcontextprotocol/ui` extension, as today. Only if the probe shows ChatGPT renders views without listing it, the server SHALL also treat the client as one when `OPEN_DESIGN_LAUNCHER` is `chatgpt-plugin`.

#### Scenario: Claude unchanged
- **WHEN** Claude Desktop connects and lists the extension
- **THEN** the app tools SHALL be listed as today

#### Scenario: ChatGPT without the capability
- **WHEN** ChatGPT connects under `chatgpt-plugin` without the extension, and the probe showed views render
- **THEN** the app tools SHALL be listed

### Requirement: Feature-Detected Host Extras
The MCP App views SHALL use a host extra (display mode, widget state) only after detecting it, preferring the MCP Apps spec method over a `window.openai` alias. They SHALL work without any extra, and SHALL NOT branch on the host's name.

#### Scenario: No extras
- **WHEN** the preview runs in a host with neither `ui/request-display-mode` nor `window.openai`
- **THEN** no Fullscreen button SHALL be shown, and the preview SHALL otherwise behave as today

#### Scenario: Display mode available
- **WHEN** the host supports a fullscreen display mode
- **THEN** the preview SHALL show a Fullscreen button that requests it

### Requirement: Tool Status Text
Render tools SHALL set `openai/toolInvocation/invoking` and `openai/toolInvocation/invoked` in their `_meta` with short plain-language text.

#### Scenario: Preview tool
- **WHEN** `tools/list` is read
- **THEN** `show_open_design_artifact`'s `_meta` SHALL carry both keys
