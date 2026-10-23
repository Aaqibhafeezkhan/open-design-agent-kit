## ADDED Requirements

### Requirement: Shared Voice Block in Prompts and the Overview Skill
The extension SHALL keep one voice block (`packages/content/local/voice.md`) with rules and a glossary for anything the agent says to the user. Every local prompt and the overview skill SHALL include it through a `{{voice}}` placeholder that the generators replace with the block's text, identically on every host. The content sync check SHALL fail, naming the file, when a local prompt or the overview skill's source lacks the placeholder.

#### Scenario: New prompt without the block
- **WHEN** a contributor adds `packages/content/local/prompts/menu.md` without `{{voice}}`
- **THEN** the content sync check SHALL fail naming `menu.md`

#### Scenario: Same text on every host
- **WHEN** the prompts are generated for Claude Code, Codex and VS Code
- **THEN** the voice block SHALL read the same in each generated copy

### Requirement: Plain Words in Replies
The voice block SHALL tell the agent to use the user's own terms when they use technical ones and plain terms otherwise, and never to put tool names, kit ids, internal file names, or the words "register", "manifest", "sidecar", "entry" or "surface" in a reply unless the user used them. It SHALL include a glossary mapping kit terms (artifact, design system, surface, workspace, bleed, trim size, preflight findings, export, inline preview) to plain ones.

#### Scenario: Non-technical user in Desktop Chat
- **WHEN** a user who has used no technical terms asks for a flyer and the agent saves, checks and exports it
- **THEN** the agent's replies SHALL say "your design" and "your style" rather than "artifact" and "design system", and SHALL contain no tool name or `.open-design` path

#### Scenario: Developer in Claude Code
- **WHEN** the user writes "register the artifact and export a PNG"
- **THEN** the agent MAY use "artifact" and "register" in its reply and SHALL give the PNG's path

### Requirement: Explain Once and Point to the Next Step
The voice block SHALL tell the agent to explain a print term such as bleed in one short clause the first time it comes up, to describe where a file is the way the user would find it (a raw path only where the host makes paths clickable or the user asks), and to end each reply that completes a step with one line on what the user can do next, offering at most two options.

#### Scenario: First print export
- **WHEN** the agent exports a flyer as a print PDF for a non-technical user
- **THEN** its reply SHALL explain the print edge once, say where the PDF is in the user's folder, and end with one next step

#### Scenario: Second print export
- **WHEN** the agent exports another print PDF in the same conversation
- **THEN** it SHALL NOT explain the print edge again
