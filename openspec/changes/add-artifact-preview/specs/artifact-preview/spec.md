## ADDED Requirements

### Requirement: Artifact Preview Guidance
The Claude-facing skills SHALL tell the agent that, when it has an Artifact tool, it keeps one private artifact per design as the person's preview: it publishes with `publish_open_design_artifact` and `provider: "claude-artifact"` after the first successful registration, after each round of feedback it has applied, and for an exploration's comparison page, and not after every small edit. Each later publish SHALL go to the recorded URL. The agent SHALL give the link the first time and afterwards say only that it was updated. The guidance SHALL be conditional on the Artifact tool being available, and skills generated for Codex and the VS Code instructions SHALL NOT contain it.

#### Scenario: First draft
- **WHEN** the agent registers a new poster in Claude Code with an Artifact tool available
- **THEN** it SHALL publish the preview and give the person the link

#### Scenario: Feedback round
- **WHEN** the agent has applied the person's feedback to that poster
- **THEN** it SHALL republish to the same artifact URL, not create a new one

#### Scenario: No Artifact tool
- **WHEN** the same skill runs in Cursor or Codex
- **THEN** the agent SHALL NOT attempt an artifact preview

### Requirement: Preview Hints in Tool Results
On the MCP server, `register_open_design_artifact` SHALL add a one-line hint about the artifact preview when the client identifies as Claude and the entry has no `claude-artifact` share record. `get_open_design_artifact` SHALL return `previewUrl`, the URL of the newest `claude-artifact` share record, when one exists.

#### Scenario: Hint for Claude only
- **WHEN** a client named `claude-code` registers an artifact with no artifact record
- **THEN** the result SHALL include the hint, and the same call from a client named `codex` SHALL NOT

#### Scenario: Preview URL read back
- **WHEN** the entry has a `claude-artifact` record
- **THEN** `get_open_design_artifact` SHALL include its URL as `previewUrl`
