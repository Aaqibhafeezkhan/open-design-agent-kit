## ADDED Requirements

### Requirement: Taste Check Codes

The page preflight run by `check_open_design_artifact` and by page exports SHALL include the check codes `slop-glow`, `card-row`, `uniform-surface`, `type-scale` and `intent`, measured on the rendered page at each checked viewport, with thresholds defined as named constants.

#### Scenario: Purple-blue hero glow
- **WHEN** a page's first viewport has a gradient background with stops in hue 235–300° and saturation at least 0.45 covering at least a quarter of the viewport
- **THEN** the check reports a `slop-glow` finding with the element's selector and a fix that names the design system's accent

#### Scenario: Three identical feature cards
- **WHEN** a section has three sibling cards of equal width, each an icon followed by a heading and text
- **THEN** the check reports one `card-row` finding for the row, not one per card

#### Scenario: Destructive button styled as neutral
- **WHEN** a button reads "Delete project" and its colour is neither the `--danger` token nor a red hue
- **THEN** the check reports an `intent` finding naming the button

#### Scenario: Heading off the display scale
- **WHEN** the page defines `--text-*` tokens and an `h1` uses a size that matches none of them
- **THEN** the check reports a `type-scale` finding with the size found and the nearest token

#### Scenario: Clean page
- **WHEN** a bundled example chosen as good is checked
- **THEN** it reports at most one taste finding

### Requirement: Taste Findings Are Warnings

Taste findings SHALL have severity `warning`, SHALL never fail an export or a registration, and SHALL be suppressed for an element and its descendants when it or an ancestor lists the code in a `data-od-allow` attribute.

#### Scenario: Brand that is purple
- **WHEN** the `<html>` element has `data-od-allow="slop-glow"`
- **THEN** no `slop-glow` finding is reported and the other checks run as before

#### Scenario: Export with taste warnings
- **WHEN** a page with taste warnings is exported
- **THEN** the export completes and the warnings appear in the preflight report

### Requirement: Taste Guidance

The open-design skill's check step SHALL tell the agent to fix taste warnings unless the brief or design system asks for that look, and not to add `data-od-allow` only to silence a warning; when a brief includes the `anti-ai-slop` craft section, the instructions SHALL add a note naming the check code for each rule the kit checks and saying the upstream daemon linter does not run in this kit.

#### Scenario: Brief with the anti-slop craft section
- **WHEN** the agent prepares a brief for a skill that requires `anti-ai-slop`
- **THEN** the instructions include the "Checked in this kit" note with the check codes
