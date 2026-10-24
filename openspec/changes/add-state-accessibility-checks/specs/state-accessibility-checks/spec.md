## ADDED Requirements

### Requirement: Interactive States Pass

`check_open_design_artifact` SHALL, unless called with `states: false`, force `:hover` and `:focus-visible` on up to 60 interactive elements at the desktop viewport and report `state-contrast` when text contrast in a forced state is below 4.5:1 (3:1 for large text), and `focus-visible` as an error when an element shows no visible change in its `:focus-visible` state.

#### Scenario: Hover colour too light
- **WHEN** a button's text contrast is 6:1 by default and 2.8:1 on hover
- **THEN** the check reports a `state-contrast` finding naming the button and the hover state

#### Scenario: Focus ring removed
- **WHEN** links have `outline: none` on focus and nothing else changes
- **THEN** the check reports a `focus-visible` error

#### Scenario: Fast run
- **WHEN** the check is called with `states: false`
- **THEN** no states pass, reflow or reduced-motion render runs

### Requirement: Tap Target Size

At the mobile viewport the check SHALL report `tap-target` for an interactive element smaller than 24×24 CSS px that fails the spacing exception of WCAG 2.2 SC 2.5.8, as a warning, and as an error below 16 px; inline links in running text SHALL be exempt.

#### Scenario: Small close icon
- **WHEN** a 20×20 px close button sits 4 px from another button on the phone viewport
- **THEN** the check reports a `tap-target` warning

#### Scenario: Link inside a paragraph
- **WHEN** a link is inline in body text
- **THEN** no `tap-target` finding is reported for it

### Requirement: Reflow at 320 Pixels

For pages with a fluid canvas the check SHALL render the page at 320 CSS px wide and report `reflow` as an error when it scrolls horizontally or clips text; fixed-format designs SHALL skip this render.

#### Scenario: Fixed-width layout
- **WHEN** a landing page has a 360 px minimum width
- **THEN** the check reports a `reflow` error

#### Scenario: Poster
- **WHEN** the artifact is a fixed-format poster
- **THEN** no reflow render runs

### Requirement: Reduced Motion

The check SHALL render pages that contain animation with `prefers-reduced-motion: reduce` emulated, and report `reduced-motion` as a warning when an animation or transition longer than 200 ms is still running or elements keep moving; three.js canvases SHALL be exempt.

#### Scenario: Infinite marquee
- **WHEN** a marquee animates forever with no reduced-motion rule
- **THEN** the check reports a `reduced-motion` warning

### Requirement: Bounded Cost of State Checks

The extra passes SHALL add no screenshots unless they find an error, then at most one cropped screenshot per pass within the existing image cap, and SHALL group findings by code listing at most five selectors each.

#### Scenario: Many failing links
- **WHEN** 30 links fail `focus-visible`
- **THEN** the result has one grouped finding listing five selectors and the count
