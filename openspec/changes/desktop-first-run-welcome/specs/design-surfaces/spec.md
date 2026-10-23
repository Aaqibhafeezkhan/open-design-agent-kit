## ADDED Requirements

### Requirement: Goal Catalog
The surface catalog (`packages/content/local/surfaces.json`) SHALL include a `goals` list. Each goal SHALL have an `id`, a plain-language `label`, a one-line `description`, an `icon`, and an ordered, non-empty list of surface ids it leads to. Only `ready` surfaces SHALL be returned for a goal.

#### Scenario: Goal leads to surfaces in order
- **WHEN** the catalog defines `promote-event` with surfaces `poster`, `social`, `campaign`
- **THEN** the goal SHALL resolve to those three surfaces in that order

### Requirement: Goal Build Guard
The content sync check SHALL fail when a goal names a surface that doesn't exist or isn't `ready`, has an empty surface list, or repeats another goal's id, and SHALL name the goal and the offending value.

#### Scenario: Goal names a planned surface
- **WHEN** a goal lists a surface whose `status` is `planned`
- **THEN** the check SHALL fail naming the goal and that surface

## MODIFIED Requirements

### Requirement: Surface Filter on Skill Listing
`list_open_design_skills` SHALL accept an optional `surface`. With a surface id it SHALL return only that surface's entries, in catalog order, excluding stubs, plus the surface's `prompt` and `questions`. With `"list"` it SHALL return the ready surfaces (id, label, description, entry count) and the goals (id, label, description, surface ids). An unknown surface SHALL return an error listing the valid ids. It SHALL also accept an optional `goal`; with a goal id it SHALL return that goal's ready surfaces in order, the first marked `default: true`, and an unknown goal SHALL return an error listing the valid goal ids.

#### Scenario: Email surface
- **WHEN** the agent calls `list_open_design_skills` with `surface: "email"`
- **THEN** the result SHALL list the email entries in catalog order, and no entry SHALL be a stub

#### Scenario: List includes goals
- **WHEN** the agent calls `list_open_design_skills` with `surface: "list"`
- **THEN** the result SHALL include a `goals` array next to `surfaces`

#### Scenario: Goal lookup
- **WHEN** the agent calls `list_open_design_skills` with `goal: "get-hired"`
- **THEN** the result SHALL list `resume`, `document` and `social` in that order, with `resume` marked as the default

### Requirement: New Design Entry Points
VS Code SHALL show a "New design" grid of ready surfaces at the top of the Gallery; clicking a surface SHALL open chat with `/open-design-new <surface-id>`. Every host SHALL provide an `open-design-new` command or skill that, with an argument naming a surface, asks that surface's questions (when the brief doesn't answer them) and continues with its prompt or its first fitting entry. Without an argument, or with a request that names no surface, it SHALL list the goals (label and description) and ask what the design is for; after the user picks a goal it SHALL continue with that goal's default surface, asking which surface only when the goal leads to several and the request doesn't settle it.

#### Scenario: Click a surface in the Gallery
- **WHEN** the user clicks "Wireframe" in the New design grid
- **THEN** chat SHALL open with `/open-design-new wireframe` ready to send

#### Scenario: Claude Code without an argument
- **WHEN** the user runs `/open-design:open-design-new` (Claude Code plugin) with no argument
- **THEN** the agent SHALL list the goals and ask what the design is for

#### Scenario: Vague request
- **WHEN** the user asks for "something to help me get a UX job"
- **THEN** the agent SHALL take the `get-hired` goal and continue with the résumé surface without listing surfaces

#### Scenario: Named surface skips goals
- **WHEN** the request is "a poster for our seed swap"
- **THEN** the agent SHALL go straight to the poster surface without asking about goals
