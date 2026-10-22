## MODIFIED Requirements

### Requirement: Token Content Vendoring and Overrides
The content sync SHALL vendor each design system's `tokens.css` when present upstream, in addition to `DESIGN.md` and `manifest.json`. It SHALL NOT vendor pre-rendered kit HTML or other design-system package files. The content overlay SHALL support two per-design-system override files, separately or together:
- an additive token override (`tokens.override.css`), applied on top of the vendored `tokens.css` during resolution without modifying or replacing it;
- a `DESIGN.md` sections override (`DESIGN.sections.md`), applied to the loaded `DESIGN.md` body without modifying or replacing the vendored file.

The overlay SHALL fail if an override targets a design system that does not exist upstream, or if an override folder holds any other file. The content drift check SHALL cover vendored `tokens.css` files. It SHALL report any override token whose value equals the upstream value, and any sections override whose sections equal the vendored ones.

#### Scenario: tokens.css vendored
- **WHEN** the content sync runs against an upstream checkout whose design system folder contains `tokens.css`
- **THEN** that file SHALL be present at the same relative path in the vendored design-systems tree, and `system/kit.html`, `components.html` and `design-tokens.json` SHALL NOT be

#### Scenario: Override for an unknown design system fails
- **WHEN** the overlay contains a token override or a sections override for a design system id that does not exist in the vendored tree
- **THEN** applying the overlay SHALL fail with an error naming that id

#### Scenario: Placeholder accents corrected
- **WHEN** the preview renders the built-in Application design system, whose upstream `tokens.css` accent is the placeholder `#2563eb` and whose `DESIGN.md` states primary `#9333EA`
- **THEN** the resolved `--accent` SHALL be `#9333EA` via its local override

#### Scenario: Both overrides in one folder
- **WHEN** a design system's override folder holds both `tokens.override.css` and `DESIGN.sections.md`
- **THEN** applying the overlay SHALL succeed and both SHALL take effect

#### Scenario: Stale override reported
- **WHEN** upstream's `tokens.css` for a design system now declares the same value as the local override for that token
- **THEN** the drift check SHALL report the override as removable
