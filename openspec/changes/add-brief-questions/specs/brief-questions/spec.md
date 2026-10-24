## ADDED Requirements

### Requirement: Structured Surface Questions

Each surface's `questions` in the bundled content SHALL be objects with `id`, `text`, two to four `options`, a `default` option and a one-line `changes`, and the surface listing SHALL return them; a plain-string question SHALL still load, as a question with no options.

#### Scenario: Poster surface
- **WHEN** the agent lists the `poster` surface
- **THEN** each question has options, a default and what it changes

#### Scenario: Older content
- **WHEN** a surface's questions are plain strings
- **THEN** the listing returns them as questions without options and doesn't fail

### Requirement: Ask Few Questions Once

The agent instructions SHALL tell the agent to ask at most three questions in total, in one message, as multiple choice accepting "you pick", only those the request, conversation and workspace don't answer, merged with any design-system recommender questions, and none when the request already says enough.

#### Scenario: Detailed request
- **WHEN** the user asks for "a printed A3 poster for our jazz night on 4 May, dark and moody"
- **THEN** the agent asks no questions and builds

#### Scenario: Vague request
- **WHEN** the user asks for "a poster for our event"
- **THEN** the agent asks at most three questions in one message, with options

### Requirement: Answers and Assumptions on the Brief

`prepare_open_design_brief` SHALL accept optional `answers` (question id to answer) and `assumptions` (at most six strings of at most 160 characters) and include them in the instructions as decisions to build to; `register_open_design_artifact` SHALL accept a `brief` input (`text` of at most 500 characters, `answers`, `assumptions`) and store it as `metadata.brief`, keeping only the latest.

#### Scenario: Assumption carried to the manifest
- **WHEN** the brief is prepared with the assumption "dark theme" and the artifact is registered with that `brief`
- **THEN** the manifest's `metadata.brief.assumptions` contains "dark theme"

#### Scenario: Too many assumptions
- **WHEN** seven assumptions are passed
- **THEN** the tool returns an error naming the limit and prepares no brief

### Requirement: Assumptions Stated in the Reply

When the agent decided anything without asking, its reply presenting the design SHALL list those assumptions in one sentence and invite a change.

#### Scenario: Guessed theme
- **WHEN** the agent chose a dark theme without asking
- **THEN** the reply says it assumed a dark theme and that the user can ask for another
