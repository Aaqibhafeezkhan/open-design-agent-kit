## ADDED Requirements

### Requirement: Design History

Registering an artifact SHALL add or update an entry in `.open-design/history.json` with its entry path, title, skill id, design system id, collection id, date and a look signature (accent, display and body fonts, light or dark theme, hero layout) read statically from its HTML, keeping at most 50 entries and storing no HTML or brief text.

#### Scenario: First registration
- **WHEN** a new landing page is registered
- **THEN** the history gains one entry with its signature

#### Scenario: Re-registration
- **WHEN** the same entry is registered again after an edit
- **THEN** its history entry is updated, not duplicated

#### Scenario: Cap
- **WHEN** the 51st design is registered
- **THEN** the oldest entry is dropped

#### Scenario: Unknown signal
- **WHEN** the page uses no token contract and has no `h1`
- **THEN** the signature leaves out the display font instead of guessing

### Requirement: Recent Designs in the Brief

`prepare_open_design_brief` SHALL include a recent-designs section listing up to five of the latest unrelated designs' signatures, with the rule to differ in at least two of theme, hero layout, display font and accent unless the user asked for the same look or the design system fixes it; designs in the same collection SHALL be listed as ones to keep consistent with; explorations' sibling directions SHALL be left out.

#### Scenario: Fifth landing page this week
- **WHEN** the agent prepares a brief and four unrelated designs are in the history
- **THEN** the instructions list them and ask for a recognisably different look

#### Scenario: Next screen of a collection
- **WHEN** the brief is for a collection that already has two screens
- **THEN** those screens are listed as ones to keep consistent with

#### Scenario: Empty history
- **WHEN** the workspace has no history
- **THEN** the brief has no recent-designs section

### Requirement: Variety Off Switch

When `.open-design/config.json` has `"variety": false`, the brief SHALL omit the recent-designs section while registration keeps writing the history.

#### Scenario: Variety off
- **WHEN** `variety` is false and the agent prepares a brief
- **THEN** no recent-designs section appears
