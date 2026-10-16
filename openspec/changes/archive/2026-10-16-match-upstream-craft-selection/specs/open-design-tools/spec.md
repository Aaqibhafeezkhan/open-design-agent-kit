## MODIFIED Requirements

### Requirement: Brief Preparation Without File Writes
The system SHALL expose `prepare_open_design_brief`, which composes generation instructions from a chosen skill, an optional design system, the craft rules resolved for that skill and design system, the caller's brief, an optional canvas `format`, and a best-effort signal of whether the workspace already contains a real application. It returns those instructions plus a suggested workspace-relative entry path. This tool SHALL NOT write any files.

#### Scenario: Valid skill, no design system
- **WHEN** `prepare_open_design_brief` is invoked with a valid `skillId` and a `brief`, and no `designSystemId`
- **THEN** the returned instructions SHALL include the skill's workflow body and the brief, and SHALL NOT reference a design system section

#### Scenario: Valid skill and design system
- **WHEN** `prepare_open_design_brief` is invoked with a valid `skillId` and a valid `designSystemId`
- **THEN** the returned instructions SHALL include both the skill's workflow body and the design system's token content, with the design system marked authoritative for visual tokens

#### Scenario: Canvas format given
- **WHEN** `prepare_open_design_brief` is invoked with a valid `skillId`, a `brief` and `format: "a3"`
- **THEN** the returned instructions SHALL include the Canvas section for A3 defined by the poster-formats capability, the result SHALL echo the format id, and no file SHALL be written

#### Scenario: Unknown format
- **WHEN** `prepare_open_design_brief` is invoked with an unknown `format`
- **THEN** the tool SHALL return an error listing the valid format ids

#### Scenario: Unknown skillId
- **WHEN** `prepare_open_design_brief` is invoked with a `skillId` that does not exist in the vendored catalog
- **THEN** the tool SHALL return an error message naming the problem and pointing the caller back to `list_open_design_skills`, rather than silently proceeding

#### Scenario: Existing-app detection nudges without changing where the artifact is written
- **WHEN** the open workspace's `package.json` lists a recognized application framework
- **THEN** the returned instructions SHALL include a note naming the detected framework(s) and encouraging the model to check the app's real existing conventions, while still directing the artifact to be written as a standalone file at the usual suggested entry path

#### Scenario: No workspace or no recognizable framework degrades silently
- **WHEN** no workspace folder is open, or the workspace's `package.json` is absent, unparseable, or lists no recognized framework
- **THEN** `prepare_open_design_brief` SHALL behave exactly as it did before this detection existed, with no error and no existing-app section in the returned instructions

## REMOVED Requirements

### Requirement: Craft Rules Follow the Active Design System's Own Suggestions
**Reason**: Upstream Open Design never injects a design system's `craft.suggested` list; it resolves craft per skill. Matching upstream also drops the all-docs fallback that made briefs carry about 104 KB of unrelated rules.
**Migration**: Craft docs now come from the skill's `od.craft.requires` and the design system's `craft.applies` and `craft.exemptions` (see "Per-Skill Craft Rules"). Skills that need a doc declare it.

## ADDED Requirements

### Requirement: Per-Skill Craft Rules
When composing a generation brief (`prepare_open_design_brief`, exploration and direction briefs), the system SHALL resolve craft docs as upstream Open Design does: the skill's `od.craft.requires`, then the active design system's `craft.applies`, then `typography` when the skill's mode is `deck`, minus the design system's `craft.exemptions`. Slugs are lowercased, deduplicated in order, and skipped when no craft doc of that name exists. The design system's `craft.suggested` list SHALL NOT select craft docs. When the resolved list is empty, the brief SHALL contain no craft section; otherwise it SHALL contain a "Craft rules" section with the resolved docs in that order. Every skill under the extension's own content overlay SHALL declare `od.craft.requires`.

#### Scenario: Skill declares its craft
- **WHEN** a brief is prepared for `od:prototype:3d-object`, which declares `color` and `anti-ai-slop`, with a design system whose `craft.suggested` is `color` and `accessibility-baseline` and whose `applies` is empty
- **THEN** the brief SHALL contain exactly the `color` and `anti-ai-slop` craft docs, in that order

#### Scenario: Skill declares nothing
- **WHEN** a brief is prepared for a skill without `od.craft.requires`, with no design system or one with empty `applies`
- **THEN** the brief SHALL contain no craft section

#### Scenario: Deck typography
- **WHEN** a brief is prepared for a skill whose mode is `deck` and that declares no craft
- **THEN** the brief SHALL contain the `typography` craft doc

#### Scenario: Design system applies and exempts
- **WHEN** the active design system's `craft.applies` lists `accessibility-baseline` and its `craft.exemptions` lists `anti-ai-slop`, and the skill declares `color` and `anti-ai-slop`
- **THEN** the brief SHALL contain `color` and `accessibility-baseline`, and not `anti-ai-slop`

#### Scenario: Forward-referenced craft
- **WHEN** a skill declares `typographic-rhythm`, for which no craft doc exists
- **THEN** that slug SHALL be skipped without an error
