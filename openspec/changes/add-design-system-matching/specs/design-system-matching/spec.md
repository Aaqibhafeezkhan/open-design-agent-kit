## ADDED Requirements

### Requirement: Design System Profile Index
The system SHALL compute facets for every design system from its resolved tokens (`tokens.css` plus any overlay override, else DESIGN.md heuristics): theme `light`/`dark` from `--bg` luminance, accent hue family from `--accent`, display type `serif`/`sans`/`mono` from the first `--font-display` family, and corner shape from `--radius-md`. Bundled design systems SHALL also have curated descriptors (`moods`, `industries`, `surfaces`, `kind` of `brand` or `genre`) in an extension-owned `design-system-descriptors.json` that carries its own vocabulary. Custom design systems SHALL get the computed facets and no curated descriptors. The content drift check SHALL fail when a bundled design system has no curated descriptors.

#### Scenario: Theme comes from tokens, not prose
- **WHEN** a design system's summary says "dark" and its `--bg` is `#f4f7fb`
- **THEN** its profile SHALL have theme `light`

#### Scenario: New upstream system without descriptors
- **WHEN** a content sync adds a bundled design system with no row in the descriptors file
- **THEN** the drift check SHALL fail and name that design system

#### Scenario: Descriptor outside the vocabulary
- **WHEN** a descriptor row lists a mood that isn't in the file's vocabulary
- **THEN** the drift check SHALL fail and name the row and the value

### Requirement: Design System Recommendation Tool
The server SHALL provide `recommend_open_design_design_systems` on every host, taking an optional design profile (`industries`, `moods`, `theme`, `surface`, `likeBrands`, `avoid`, `brief`) with closed vocabularies for `industries`, `moods`, `theme` and `surface`. It SHALL return 3 to 5 design systems ranked by a deterministic score, each with id, name, a one-line reason naming what it matched, and its theme and accent and display-type facets, plus a `confidence` of `high`, `medium` or `low`. It SHALL ignore values outside the vocabularies and say which it ignored. It SHALL NOT change the active design system and SHALL NOT call a model.

#### Scenario: Same profile, same answer
- **WHEN** the tool is called twice with the same profile and catalog
- **THEN** both results SHALL list the same ids in the same order

#### Scenario: Profile drives the shortlist
- **WHEN** the profile is `{ industry: "wellness", moods: ["calm", "warm"], theme: "light" }`
- **THEN** every returned design system SHALL have theme `light`, and each reason SHALL name the mood or industry it matched

#### Scenario: Recommending does not activate
- **WHEN** the tool returns a shortlist
- **THEN** the active design system SHALL be unchanged

### Requirement: Questions When the Profile Is Thin
When fewer than two profile fields are given and `confidence` is `low`, the recommendation result SHALL include a question set of at most three questions (what it is for, how it should feel, light or dark), each with 3 to 9 short options, and an optional free-text question asking for a product or site to feel like. The same profile SHALL always produce the same question set. With an empty profile, the first recommendation SHALL be `default`.

#### Scenario: Empty profile asks
- **WHEN** the tool is called with no profile
- **THEN** the result SHALL include the three questions and the free-text question, and its first recommendation SHALL be `default`

#### Scenario: Known fields are not asked again
- **WHEN** the profile gives `theme: "dark"` and nothing else, and confidence is low
- **THEN** the question set SHALL NOT include the light-or-dark question

### Requirement: Brand Look-Alikes Are Opt-In
A design system whose descriptor `kind` is `brand` SHALL rank below every matching `genre` system unless the profile's `likeBrands` names it or its product, or the `brief` names the product.

#### Scenario: No brand named
- **WHEN** the profile is `{ industry: "finance", moods: ["premium"] }`
- **THEN** genre systems SHALL rank above product-named fintech systems such as `stripe`

#### Scenario: Brand asked for
- **WHEN** the profile has `likeBrands: ["Stripe"]`
- **THEN** `stripe` SHALL be the first result

### Requirement: Multi-Word Design System Search
`list_open_design_design_systems` `query` SHALL match a design system when every whitespace-separated word of the query appears in at least one of its id, name, summary, category or curated descriptors, case-insensitively.

#### Scenario: Two words in different fields
- **WHEN** the query is "warm editorial"
- **THEN** a system whose summary says "warm" and whose category is "Editorial & Print" SHALL be returned

### Requirement: Hint on Briefs Without a Design System
`prepare_open_design_brief` SHALL include a `designSystemHint` naming `recommend_open_design_design_systems` when no design system was used for the brief, and SHALL omit it when one was.

#### Scenario: No design system resolved
- **WHEN** a brief is prepared with no `designSystemId` and none active
- **THEN** the result SHALL include `designSystemHint`, and the brief SHALL still be prepared

### Requirement: When the Agent Recommends
The overview skill SHALL tell the agent to call `recommend_open_design_design_systems` before `prepare_open_design_brief` only when the person has not named a design system or a brand look, no design system is active, and the request is for a new design (not an edit, remix or export). The agent SHALL fill the profile from the request, the conversation and the workspace; SHALL ask the returned questions in one message only when the result includes them, accepting "you pick"; SHALL show the shortlist with `show_open_design_design_systems` and the recommended `ids` where that tool is listed, and as a numbered text list elsewhere; and SHALL say which design system it used and how to switch. When the recommend tool is not available the skill SHALL fall back to `list_open_design_design_systems`.

#### Scenario: Enough context, no questions
- **WHEN** the person asks for "a landing page for my yoga studio" with nothing active
- **THEN** the agent SHALL recommend without asking, use the first result, and say which one it used

#### Scenario: Active system wins
- **WHEN** a design system is already active and the person names no direction
- **THEN** the agent SHALL NOT call the recommend tool
