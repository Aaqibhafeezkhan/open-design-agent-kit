## ADDED Requirements

### Requirement: Strict Claude Design System Builder
Core SHALL provide a builder that turns an Open Design design system (its loaded `DESIGN.md` body, resolved tokens and name) into a Claude Design System file tree under `project/`. The tree SHALL hold `design-system.json`, `tokens.json`, `README.md` and `components/Cover/preview.html`, and SHALL NOT hold `tokens.css`, `manifest.json` or anything under `api/`. The index SHALL carry `"v": 3`, `"layout": "files"`, a `createdOnFiles` object, `title`, `namespace`, `libraries: []`, `sections: {}`, `groups: []`, `assetGroups: {}`, `blobs: {}`, `docs: {"sections": []}` and a `lastChange`.

#### Scenario: Generated files are not written
- **WHEN** the builder runs for the bundled `lingo` system
- **THEN** its output SHALL contain the four files above, and no path ending in `tokens.css` or `manifest.json` and none under `project/api/`

### Requirement: List-Shaped Tokens The Page Reads
The builder's `tokens.json` SHALL use the list shape for every family except `type`. Every token name SHALL match `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$` and SHALL be unique across all families except `type`. Colour values SHALL be literal colours or aliases to colour tokens that exist. The first theme SHALL be the light theme when the system has one. Motion tokens SHALL be omitted and listed in the README's "Not synced" note.

#### Scenario: Colour reference becomes an alias
- **WHEN** a system's tokens declare `--focus-ring: var(--accent)`
- **THEN** `tokens.json` SHALL hold a `focus-ring` colour token whose value is `"{accent}"`

### Requirement: color-mix Values Are Resolved
The builder SHALL resolve every `color-mix()` token value to a literal colour, mixing in the colour space the value names (oklab or oklch) per CSS Color 5, with `var()` arguments resolved within the same theme. A result with alpha below 1 SHALL be written as `rgba()`, and any other result as lowercase `#rrggbb`. Each channel SHALL be within 1/255 of a browser's computed value for the same expression.

#### Scenario: Hover shade resolved
- **WHEN** a system declares `--accent: #58cc02` and `--accent-hover: color-mix(in oklab, var(--accent), black 10%)`
- **THEN** `tokens.json` SHALL hold an `accent-hover` token with a literal `#rrggbb` value, and no value containing `color-mix(`

#### Scenario: Mix with transparent
- **WHEN** a value is `color-mix(in oklab, var(--accent), transparent 85%)`
- **THEN** the token's value SHALL be an `rgba()` colour with alpha 0.15

### Requirement: Brand-Book README
The builder's `README.md` SHALL NOT start with a `#` heading and SHALL NOT carry upstream provenance lines (such as `> Category:`). It SHALL keep the `DESIGN.md` prose sections, and SHALL end with at most one "Not synced" section listing what was not carried over.

#### Scenario: Title removed
- **WHEN** the `DESIGN.md` body starts with `# Design System Inspired by Dating.com`
- **THEN** the README's first line SHALL NOT start with `#`, and the index `title` SHALL be the system's name

### Requirement: Cover Per The Type's Rules
The builder SHALL write `components/Cover/preview.html` with line 1 `<!-- @dsCard height=N -->` (N from 240 to 360), and nothing else in `components/Cover/`. The cover SHALL be one inline SVG plus the name and one tagline line. Every fill, stroke and `rx` SHALL be bound to a token class, and there SHALL be no images. Its pattern SHALL be chosen from the system's tokens: discs and pills for a `--radius-lg` of 16px or more, a dot grid for a mono body font, hairline rules for a serif display font, and otherwise tiles. It SHALL keep a derivation comment that names the tokens used.

#### Scenario: Pill-shaped brand
- **WHEN** a system's `--radius-lg` is `28px`
- **THEN** its cover's pattern SHALL be discs or pills, with `rx` set to half the short side

### Requirement: Claude Design System Validator
Core SHALL provide `validateClaudeDesignSystem(files)`, returning `errors` and `warnings`. Errors SHALL cover each of the following:
- a missing or misshapen index;
- a token name outside the grammar, or used twice;
- a token value the page would drop (`var()`, `color-mix()`, `url()`, a named colour, or an alias of a missing token or of itself);
- a README `#` title;
- a missing cover marker;
- a file over its cap;
- a generated path being present.

Warnings SHALL cover a text colour below 4.5:1 contrast on a ground its usage note names, in any theme.

#### Scenario: Dropped value caught
- **WHEN** a tree's `tokens.json` holds a colour token whose value is `color-mix(in oklab, #000, #fff 50%)`
- **THEN** the validator SHALL report an error naming that token

#### Scenario: Failing brand pair is a warning
- **WHEN** a system's `muted` text colour reads 3.9:1 on its `bg`
- **THEN** the validator SHALL report a warning, not an error, and the builder SHALL say so in that token's usage note

### Requirement: Built Claude Design Systems In The Repository
`scripts/build-claude-design-systems.ts` SHALL build every bundled design system, through the content index so local overlays apply, into `claude-design-systems/<id>/project/`. It SHALL write `claude-design-systems/README.md`, listing each system's name, summary and folder path. `npm run sync-content` SHALL run it. The output SHALL be deterministic: `createdOnFiles.at` and `lastChange.at` come from the vendored content's `syncedAt`, and `lastChange.via` names the upstream `sourceRef`. The folder SHALL NOT be included in any npm package.

#### Scenario: Overlay reaches the build
- **WHEN** `lingo`'s colour decision is `design` and its `tokens.override.css` sets `--accent: #58cc02`
- **THEN** `claude-design-systems/lingo/project/tokens.json` SHALL hold `accent` as `#58cc02`, and its README SHALL name the same colour

### Requirement: Built Systems Drift Check
`scripts/build-claude-design-systems.ts --check` SHALL build every bundled system in memory and fail, naming the ids, when any of the following holds:
- a folder under `claude-design-systems/` differs from its build, ignoring the two dates;
- a folder is missing;
- a folder has no bundled system;
- any build has validator errors.

`npm run lint` SHALL run it.

#### Scenario: Stale build fails lint
- **WHEN** a bundled system's `tokens.override.css` changes and `claude-design-systems/` is not rebuilt
- **THEN** `npm run lint` SHALL fail and name that system's id

### Requirement: One Builder For Every Export
`scripts/claude-design-system.ts export` and the `design-system-from-url` skill's Claude Design step SHALL use the strict builder, so a custom `user:` system is exported in the same shape. For a custom system, the dates SHALL be the current time.

#### Scenario: Custom system exported strictly
- **WHEN** `export` runs on `.open-design/design-systems/dating-com-inspired`
- **THEN** its output SHALL pass `validateClaudeDesignSystem()` with no errors, and its index `title` SHALL be `Dating.com-inspired`

### Requirement: Claude Design Guide
`docs/guides/design-systems.md` SHALL explain how to bring a design system into Claude Design by each route:
- **GitHub:** the repository and the `claude-design-systems/<id>` path to give.
- **Upload:** the files to drop.
- **Several systems from Claude Code:** the prompt that has an agent publish them.

It SHALL say that the connector route is for design tools and does not read Open Design systems.

#### Scenario: GitHub route documented
- **WHEN** a reader looks up how to import `kami` from GitHub
- **THEN** the guide SHALL name `feimacode/open-design-agent-kit` and the path `claude-design-systems/kami`
