## ADDED Requirements

### Requirement: Local Craft Docs

The content overlay SHALL copy craft docs from `packages/content/local/craft/` into the bundled craft folder and SHALL fail when a local craft doc has the same id as an upstream one.

#### Scenario: New local doc
- **WHEN** `local/craft/ux-writing.md` exists and upstream has no `ux-writing`
- **THEN** the overlay adds it to the bundled craft docs

#### Scenario: Collision
- **WHEN** a local craft doc is named `state-coverage.md`
- **THEN** the overlay fails with a message naming the collision

### Requirement: Microcopy and Action-State Rules

The kit SHALL ship a `ux-writing` craft doc covering action-and-object button labels, errors that state cause and fix, empty states with a first action, loading text, destructive actions that name what is lost and use the danger colour, and no filler; and an `action-states` craft doc stating that a busy action keeps focus and label using `aria-disabled` and a live status rather than `disabled`, naming the upstream line it supersedes.

#### Scenario: Prototype brief
- **WHEN** the agent prepares a brief for `saas-landing`
- **THEN** the instructions include the `ux-writing` and `action-states` sections

#### Scenario: Upstream text changes
- **WHEN** a content sync changes the upstream line that `action-states` supersedes
- **THEN** the content check fails until the addendum is updated

### Requirement: Local Craft Requirements Map

Content loading SHALL merge `local/craft-requires.json` into each listed skill's or template's craft requirements, and the content check SHALL fail on an unknown skill id or craft id in the map; the first mapping SHALL give the prototype and mobile surfaces' entries `state-coverage`, `ux-writing` and `action-states`.

#### Scenario: Dashboard template
- **WHEN** the agent prepares a brief for `dashboard`
- **THEN** the instructions include the `state-coverage` section

#### Scenario: Typo in the map
- **WHEN** the map lists `ux-writng`
- **THEN** the content check fails naming the unknown craft id
