## ADDED Requirements

### Requirement: Ask Schema

Core SHALL define and validate an ask schema of an optional title and at most four questions, each with an `id`, `text`, a `kind` of `single`, `multi` or `text`, at most eight options with a label of at most 120 characters and an optional `imageRef`, and an optional default, at most 2 KB in total; `imageRef` SHALL only name a design system, an example, a registered artifact or a check run.

#### Scenario: Valid questions
- **WHEN** the agent passes three single-choice questions with four options each
- **THEN** the schema validates

#### Scenario: Raw image URL
- **WHEN** an option's `imageRef` is an https URL
- **THEN** validation fails with a message listing the allowed reference kinds

### Requirement: Ask View and Show Tool

The server SHALL provide `show_open_design_questions`, listed only to hosts that render MCP Apps, which renders the questions in the preview MCP App as tappable options with a "You pick" choice and one Send button; when called on any other host it SHALL return the questions as a numbered text list for the agent to ask in one message.

#### Scenario: Desktop Chat
- **WHEN** the agent calls `show_open_design_questions` in a host that renders MCP Apps
- **THEN** the user sees the questions as tappable choices inline

#### Scenario: Host without MCP Apps
- **WHEN** the tool is called from a host that doesn't render MCP Apps
- **THEN** it returns a numbered text list of the questions and options

### Requirement: Tap Becomes the Answer

On Send, the page SHALL post one user chat message with a readable line of `id = label` pairs and a machine-readable answers line, and SHALL NOT call any model-visible tool that changes state; the skills SHALL tell the agent to read that message as the answers.

#### Scenario: User taps answers
- **WHEN** the user picks "Printed" and "Dark" and taps Send
- **THEN** a chat message with both answers is sent and the agent continues with them

#### Scenario: Message cannot be sent
- **WHEN** the host refuses the message
- **THEN** the view offers to copy the answers line

### Requirement: Flows Use the Ask View

Where `show_open_design_questions` is available, the skills SHALL ask surface and design-system questions, exploration direction picks and the critic's rework question through it, and SHALL otherwise ask in one chat message.

#### Scenario: Vague poster request on Desktop
- **WHEN** a Desktop Chat user asks for a poster without details
- **THEN** the agent asks its questions with `show_open_design_questions` instead of a text list

### Requirement: Feedback Chips

The artifact view SHALL show three quick replies under the design ("Looks good", "Change something", "Try another direction") that send a chat message when tapped, hidden in fullscreen.

#### Scenario: Unsure user
- **WHEN** the user taps "Change something"
- **THEN** a chat message is sent and the agent asks what to change
