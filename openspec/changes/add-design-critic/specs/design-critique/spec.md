## ADDED Requirements

### Requirement: Critique Skill and Rubric

The kit SHALL ship an `open-design-critique` skill, on every host that gets the kit's skills, that reviews one registered artifact from its latest check run, its recorded brief (or title and skill id) and the active design system against a fixed rubric: purpose and hierarchy, typography, colour and contrast, layout and rhythm, copy, states, and fit.

#### Scenario: Rubric applied
- **WHEN** the agent runs the critique on a registered page
- **THEN** every finding names one of the rubric's areas

### Requirement: Critique Verdict and Findings

A critique SHALL return one verdict of `ship`, `polish` or `rework` and at most five findings, each naming where, what is wrong and the change to make.

#### Scenario: Critique of a landing page
- **WHEN** the agent runs the critique on a registered landing page with a saved check run
- **THEN** it returns one verdict and no more than five findings, each with a location and a fix

#### Scenario: No check run
- **WHEN** the artifact has no saved check run
- **THEN** the skill runs `check_open_design_artifact` first and critiques that run

### Requirement: Fresh-Context Critic

Where the host supports plugin agents, the critique SHALL run in a `design-critic` agent with read-only tools that does not see the builder's conversation; elsewhere it SHALL run inline and the reply SHALL describe it as a self-review.

#### Scenario: Claude Code
- **WHEN** the critique runs in Claude Code with the plugin installed
- **THEN** it runs in the `design-critic` agent and edits no files

### Requirement: Critic Round Before Done

The open-design skill's check step SHALL, for every artifact kind other than 3D, get one critique after the checks are clean or the fix rounds are spent; on `polish` the agent SHALL apply the findings once and re-check; on `rework` it SHALL tell the user what is wrong and ask before rebuilding; on `ship` it SHALL report the design as done. A brief or design system that asks for a look SHALL override a finding against it.

#### Scenario: Polish verdict
- **WHEN** the critic returns `polish` with three findings
- **THEN** the agent fixes them, re-checks, and reports done without a second critique

#### Scenario: Rework verdict
- **WHEN** the critic returns `rework`
- **THEN** the agent explains the problem to the user and waits for an answer before rebuilding

### Requirement: Plain-Words Second Opinion

In hosts for non-technical users (Claude Desktop Chat and Cowork), the agent SHALL report the critique as a short second opinion in everyday words with at most two findings, without rubric names, verdict codes or file paths.

#### Scenario: Desktop reply
- **WHEN** a Desktop Chat user's poster gets a `polish` verdict
- **THEN** the reply says what was improved in a sentence or two, with no rubric terms

### Requirement: Critique Record

`register_open_design_artifact` SHALL accept a `critique` input and store it as `metadata.critique` (`verdict`, `findings` with `area` and `fix`, `checkRunId`, `at`), keeping only the latest, validated and at most 4 KB.

#### Scenario: Oversized critique
- **WHEN** a critique record over 4 KB is passed
- **THEN** registration rejects it with a message naming the limit and the manifest is unchanged
