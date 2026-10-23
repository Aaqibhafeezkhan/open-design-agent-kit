## ADDED Requirements

### Requirement: First-Run Welcome Without Tools
When the overview skill runs in Claude Desktop Chat or claude.ai and none of the Open Design tools are available, it SHALL tell the agent to reply, before making anything, with one plain sentence on what's missing, two numbered setup options, and the question "What's it for?". If the user wants to go ahead without setting up, the agent SHALL keep the single self-contained Claude artifact fallback.

#### Scenario: Plain Chat with only the plugin
- **WHEN** a user in Desktop Chat with no folder and no extension asks "help me make something for my café"
- **THEN** the agent's reply SHALL say Open Design can't save or check designs in this chat yet, give both options as numbered steps, and ask what the design is for

#### Scenario: User goes ahead anyway
- **WHEN** the user answers "just make it here"
- **THEN** the agent SHALL make one self-contained page and publish it as a Claude artifact

### Requirement: Setup Options Name the Clicks
The two setup options in the welcome SHALL name the actual steps: connect a folder through the chat's **+** menu, or download the desktop extension from the releases page, double-click it and start a new chat. They SHALL NOT name file extensions, package names, commands or tool names.

#### Scenario: No technical names
- **WHEN** the agent gives the setup options
- **THEN** the reply SHALL NOT contain `.mcpb`, `npx`, `npm` or any `*_open_design_*` tool name

### Requirement: Say Where Designs Are Saved
In Claude Desktop, after the agent first sets the workspace in a session (`set_open_design_workspace` or `use_open_design_managed_workspace`), the overview skill SHALL tell it to say once, in one sentence, where the user's designs will be saved and that they can open that folder at any time. It SHALL NOT repeat this for later designs in the same session.

#### Scenario: Managed workspace
- **WHEN** the agent calls `use_open_design_managed_workspace` for "Seed swap flyer"
- **THEN** its next reply SHALL name the folder's absolute path once

#### Scenario: Second design in the same chat
- **WHEN** the user asks for another design later in the same session
- **THEN** the agent SHALL NOT repeat where designs are saved

### Requirement: Relayable Home-Folder Guard
When a tool refuses because the server would work in the user's home folder, its message SHALL begin with a sentence the agent can pass to the user unchanged ("I need a folder to save your designs in."), followed by the agent-facing instructions naming `set_open_design_workspace` and, when listed, `use_open_design_managed_workspace`.

#### Scenario: Guard text
- **WHEN** the server runs in the home folder with nothing set and the agent calls `prepare_open_design_brief`
- **THEN** the refusal SHALL begin with "I need a folder to save your designs in." and SHALL still name the workspace tools
