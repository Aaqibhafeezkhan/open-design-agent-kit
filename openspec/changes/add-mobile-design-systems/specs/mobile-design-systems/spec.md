## ADDED Requirements

### Requirement: Mobile Apps Design Systems
The catalog SHALL include local design-system packages adapted from awesome-ios-design-md, each with id `<app>-ios`, category `Mobile Apps`, and name `<App> (iOS)`. Each package SHALL contain exactly `DESIGN.md`, `manifest.json` and `tokens.css`. Its `DESIGN.md` SHALL contain the source file's numbered sections verbatim, preceded by a heading, a `> Category: Mobile Apps` line and a one-line summary, and followed by an attribution naming the source URL, copyright holder and MIT licence. Its `manifest.json` SHALL have `source.type: "inspired"` and a `source.url` pointing at the app's folder in the source repository.

#### Scenario: Listed by category
- **WHEN** the agent calls `list_open_design_design_systems` with `category: "Mobile Apps"`
- **THEN** every `*-ios` package SHALL be returned, and no web system SHALL be

#### Scenario: Same brand as a web system
- **WHEN** the catalog has both the upstream `spotify` system and `spotify-ios`
- **THEN** both SHALL be listed, under their own categories, and `spotify-ios`'s name SHALL be "Spotify (iOS)"

#### Scenario: Attribution travels with the content
- **WHEN** a `*-ios` design system is read through any host
- **THEN** its DESIGN.md SHALL end with the source attribution and its manifest SHALL name the MIT licence

### Requirement: iOS Extraction Tooling
`packages/content` SHALL provide an `extract-ios` script that reads awesome-ios-design-md from a local checkout (`--source` or `IOS_DESIGN_MD_SRC`) or from GitHub, and that:
- with `--report`, prints per-role coverage (accent, bg, surface, fg, muted, border) and agreement with each file's §9 Quick Color Reference across all apps;
- with `--list-candidates`, lists apps not yet ported and apps sharing a brand with an upstream system;
- given app slugs, writes for each a scaffold (`manifest.json`, `tokens.css`, `DESIGN.md`, `NOTES.md`) into the gitignored `scripts/.ios-scaffold/<id>/` and never into `local/design-systems/`.

The script SHALL refuse to scaffold an app whose `<app>-ios` id already exists, unless `--force` is passed.

#### Scenario: Scaffold one app
- **WHEN** a maintainer runs `npm run extract-ios -- spotify`
- **THEN** `scripts/.ios-scaffold/spotify-ios/` SHALL contain the four files, and `local/design-systems/` SHALL be unchanged

#### Scenario: Already ported
- **WHEN** `local/design-systems/spotify-ios/` exists and a maintainer runs `npm run extract-ios -- spotify`
- **THEN** the script SHALL exit with an error naming `spotify-ios`, without writing a scaffold

### Requirement: Extracted Tokens Carry Their Provenance
The scaffold's `tokens.css` SHALL declare every A1 identity and structure token of the design-token contract. Each extracted colour role that the source's §9 Quick Color Reference does not confirm SHALL carry an inline `/* TODO: … */` comment naming the source entry. `NOTES.md` SHALL list as review items:
- every such role;
- every role not found;
- an accent chosen by a fallback rule, or a neutral accent;
- a light-mode surface taken from a grey grouped-background entry;
- gradient or rgba palettes;
- a likely-proprietary primary font;
- the detected primary mode and how it was detected.

#### Scenario: Confirmed values are clean
- **WHEN** every colour role extracted from a file matches its §9 Quick Color Reference
- **THEN** the scaffold's colour declarations SHALL carry no TODO comments

#### Scenario: Missing role
- **WHEN** a file's §2 has no entry the extractor can read as the canvas
- **THEN** `--bg` SHALL carry a TODO comment and `NOTES.md` SHALL say it must be chosen by hand

### Requirement: Scaffold Markers Never Ship
The content sync check SHALL fail when any `local/design-systems/*/tokens.css` contains `TODO` or `SCAFFOLD, NOT FINAL`, naming the design system.

#### Scenario: Unreviewed scaffold moved into local
- **WHEN** a maintainer moves an unreviewed scaffold into `local/design-systems/monzo-ios/`
- **THEN** the content sync check SHALL fail naming `monzo-ios`

### Requirement: Source Licence Notice
The content assets SHALL include the awesome-ios-design-md MIT copyright and permission notice under `notices/`, copied there from `packages/content/local/notices/` by the overlay, so that every host mirroring the content assets carries it.

#### Scenario: Notice published
- **WHEN** the overlay has been applied
- **THEN** `assets/open-design/notices/LICENSE-awesome-ios-design-md.txt` SHALL exist and contain the source's copyright line and the MIT permission notice

### Requirement: Mobile Design System Discovery
The agent instructions on every host SHALL direct the agent, for Mobile surface work or a brief that asks for an app like a named app, to look in the `Mobile Apps` category first (with the app name as `query` when one is named), and to prefer `<app>-ios` over a same-brand web system for phone screens. The Mobile surface's questions SHALL include which app's look to follow.

#### Scenario: App-like brief
- **WHEN** the user asks for "a budgeting app screen that feels like Monzo" and `monzo-ios` exists
- **THEN** the agent SHALL use `monzo-ios` as the design system for the screen

#### Scenario: Phone screen for a dual-listed brand
- **WHEN** the user asks for a Spotify-style now-playing phone screen
- **THEN** the agent SHALL choose `spotify-ios`, not the web `spotify` system
