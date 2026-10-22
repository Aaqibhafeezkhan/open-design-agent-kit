## ADDED Requirements

### Requirement: Design System Consistency Audit
The content package SHALL provide an audit that compares each bundled design system's `DESIGN.md` values with its resolved tokens (vendored `tokens.css` plus local override). It SHALL classify each system as `consistent`, `tokens-placeholder`, `design-placeholder` or `conflict`, and print both values for every field that differs.

#### Scenario: Conflict reported
- **WHEN** a system's `DESIGN.md` says `**Primary:** \`#58CC02\`` and its resolved `--accent` is `#6d4aff`
- **THEN** the audit SHALL classify it as `conflict` and print both values

#### Scenario: Placeholder side named
- **WHEN** a system's `DESIGN.md` primary is `#3b82f6` and its resolved `--accent` is `#9b5b32`
- **THEN** the audit SHALL classify it as `design-placeholder`

### Requirement: Audited Fields
The audit SHALL compare the template Color bullets (Primary, Secondary, Success, Warning, Danger, Surface, Text), the Typography `**Families:**` and `**Scale:**` lines, and the Spacing scale. Colours SHALL be compared ignoring case and hex shorthand, and fonts by the first family of each stack, ignoring quotes.

#### Scenario: Shorthand is not a conflict
- **WHEN** `DESIGN.md` says `**Surface:** \`#FFF\`` and the resolved `--surface` is `#ffffff`
- **THEN** the audit SHALL treat Surface as consistent

### Requirement: Recorded Source Decision
`packages/content/local/design-system-sources.json` SHALL record, for each bundled system that is not consistent after overlays, which side is the truth for colour and for type (`"tokens"` or `"design"`) and a one-line reason. The audit SHALL suggest a decision: the placeholder side loses, and otherwise `tokens`. A suggested row SHALL carry `"suggested": true` until a person confirms it.

#### Scenario: Suggestion written
- **WHEN** the audit runs with `--suggest` and finds a `design-placeholder` system with no entry
- **THEN** it SHALL add an entry with `color: "tokens"` and `suggested: true`

### Requirement: Generated Overlays From Decisions
The audit SHALL generate each system's overlays from its decision, and overlays SHALL NOT be hand-edited. For `design` truth it SHALL write a `tokens.override.css` setting the contract tokens the template names: the accent and its derived B slots, the named surface and text colours, the font stacks, and the type scale when the template has eight steps. For `tokens` truth it SHALL write a `DESIGN.sections.md` with replacement Color, Typography and Spacing sections in the template's bullet format.

#### Scenario: Tokens truth rewrites the sections
- **WHEN** `agentic` is decided `color: "tokens"`
- **THEN** its generated `DESIGN.sections.md` Color section SHALL state `**Primary:** \`#60a5fa\``, and no `tokens.override.css` SHALL be generated for colour

#### Scenario: Design truth overrides tokens
- **WHEN** `lingo` is decided `color: "design", type: "design"`
- **THEN** its generated `tokens.override.css` SHALL set `--accent: #58cc02` and a `--font-body` stack starting with `Nunito`

### Requirement: Generated Accent Keeps Contrast
When a generated `--accent` falls below 4.5:1 contrast against `--accent-on`, the generated override SHALL also set `--accent-on` to whichever of white or near-black passes.

#### Scenario: Light accent gets dark text
- **WHEN** a `design` decision sets `--accent` to `#ffc800` and the vendored `--accent-on` is `#ffffff`
- **THEN** the generated override SHALL set `--accent-on` to a near-black value with at least 4.5:1 contrast

### Requirement: Sections Overlay Applied on Load
When the content index loads a bundled design system that has a `DESIGN.sections.md` overlay, the loaded body SHALL have each section the overlay names, matched by heading text without its leading number, replaced by the overlay's section. All other sections SHALL be left verbatim and the vendored `DESIGN.md` left unmodified. An overlay section whose heading the vendored file doesn't have SHALL fail the overlay step with an error naming the system and heading.

#### Scenario: Only named sections replaced
- **WHEN** `agentic` has an overlay with a `## Color` section
- **THEN** the loaded body's `## 2. Color` section SHALL be the overlay's, and its `## 1. Visual Theme & Atmosphere` section SHALL be identical to the vendored file's

### Requirement: Consistency Drift Check
The content drift check SHALL fail when:
- a bundled system is not consistent after its overlays and has no confirmed decision;
- a decision is still `suggested`;
- a generated overlay differs from what the audit would generate now.

It SHALL report an overlay as removable when the vendored files agree without it.

#### Scenario: New upstream conflict caught
- **WHEN** an upstream update changes a system's `tokens.css` accent so that it no longer matches its `DESIGN.md`, and that system has no decision
- **THEN** `npm run lint` SHALL fail naming the system and the command that suggests a decision

### Requirement: Consumers Read Reconciled Design Systems
Briefs, design system tools, previews and the Claude Design export SHALL read a bundled design system's `DESIGN.md` through the content index, with its sections overlay applied, and its tokens through token resolution, with its token override applied.

#### Scenario: Export carries one brand
- **WHEN** `lingo` is exported with `scripts/claude-design-system.ts export` after its decision is applied
- **THEN** the exported `README.md` and `tokens.json` SHALL name the same primary colour and body font
