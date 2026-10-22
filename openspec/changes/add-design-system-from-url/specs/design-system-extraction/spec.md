## ADDED Requirements

### Requirement: Rendered Site Extraction Tool
The system SHALL provide an `extract_open_design_design_system` tool that takes `url`, optional `extraUrls` (at most 3, same registrable domain) and optional `theme` (`light` | `dark` | `both`, default `light`). It SHALL render each page at a desktop and a mobile viewport in an installed browser found by the existing browser discovery, and SHALL NOT download a browser. It SHALL return an evidence summary and a draft token set, and SHALL NOT write a `DESIGN.md` or `tokens.css`.

#### Scenario: Draft returned
- **WHEN** the tool is called with `url: "https://example.com"` and a browser is installed
- **THEN** the result SHALL include draft values for `--bg`, `--fg`, `--accent`, `--font-body` and `--text-base`, and no `DESIGN.md` or `tokens.css` SHALL be written

#### Scenario: Extra page on another domain refused
- **WHEN** `extraUrls` contains a URL on a different registrable domain from `url`
- **THEN** the tool SHALL return an invalid-args error naming that URL and render nothing

### Requirement: Evidence Bundle
The tool SHALL write an evidence bundle under `.open-design/.extract/<slug>/` holding `evidence.json`, a screenshot per page and viewport, and one crop per sampled role.

#### Scenario: Bundle written
- **WHEN** the tool extracts `https://example.com`
- **THEN** `.open-design/.extract/example-com/evidence.json` and at least one screenshot SHALL exist

### Requirement: Colour Roles From Elements
For each contract colour role (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-on`, `--accent-hover`, `--accent-active`), the evidence SHALL record the measured computed value, the selector of the element it came from, how many sampled elements share it, and its crop file. Hover and active values SHALL be measured by forcing the pseudo-state on the sampled primary control.

#### Scenario: Accent from the primary button
- **WHEN** a page's most prominent button has computed `background-color: rgb(88, 204, 2)` and links are blue
- **THEN** the draft `--accent` SHALL be `#58cc02` and its evidence SHALL name the button's selector

#### Scenario: Hover state measured
- **WHEN** that button's `:hover` rule changes its background to `rgb(70, 163, 2)`
- **THEN** the draft `--accent-hover` SHALL be `#46a302`

### Requirement: Type, Shape and Variable Evidence
The evidence SHALL record the declared `:root` and theme-scoped custom properties; the fonts `document.fonts` reports as loaded, with family, weight and source; the computed size, line-height, weight and letter-spacing of each sampled text role; border radii; common spacing values snapped to a 2px grid; the container max width; and transition durations and easing.

#### Scenario: Loaded font wins over declared stack
- **WHEN** the body's `font-family` is `"Nunito", Arial, sans-serif` and `document.fonts` reports Nunito loaded
- **THEN** the draft `--font-body` SHALL start with `"Nunito"` and the evidence SHALL record Nunito's source

### Requirement: Dark Theme Only When Present
With `theme` `dark` or `both`, the tool SHALL measure dark values only when the site changes under `prefers-color-scheme: dark` emulation or under a detected theme toggle on the root element. It SHALL return them as a `[data-theme="dark"]` override set. Otherwise it SHALL say that no dark theme was found and return no dark values.

#### Scenario: Light-only site
- **WHEN** the tool is called with `theme: "both"` on a site that doesn't change under dark emulation and has no theme toggle
- **THEN** the result SHALL contain no dark values and SHALL note that no dark theme was found

### Requirement: Draft Tokens Follow the Contract
The draft SHALL use only token-contract names plus the brand extensions the contract allows. It SHALL map the sampled text roles onto `--text-xs` … `--text-4xl` by size order, with the body role as `--text-base`. Every value SHALL be measured, never invented. A contract token with no measurement SHALL be omitted, so its contract fallback applies, and SHALL be listed as unmeasured.

#### Scenario: Unmeasured token omitted
- **WHEN** a page has no element with a transition
- **THEN** the draft SHALL contain no `--motion-fast` and the result SHALL list it as unmeasured

#### Scenario: Body anchors the scale
- **WHEN** the sampled body text is 15px and headings are 22px, 32px and 48px
- **THEN** the draft `--text-base` SHALL be `15px` and `--text-4xl` SHALL be `48px`

### Requirement: Fallback and Blocked Pages
With no browser found, the tool SHALL fall back to the existing fetch-based brand extraction and mark the result `partial`. When a page shows an anti-bot challenge, redirects to a login, or renders an empty body, the tool SHALL return `blocked` with its screenshot and SHALL NOT retry with other user agents, cookies or challenge solving.

#### Scenario: No browser
- **WHEN** the tool is called and browser discovery finds nothing
- **THEN** the result SHALL be marked `partial`, SHALL include the fetch-based candidates, and SHALL NOT be an error

#### Scenario: Challenge page
- **WHEN** the rendered page is a bot-check interstitial
- **THEN** the result SHALL be `blocked` with a screenshot path, and no evidence for that page SHALL be recorded

### Requirement: URL Safety
The tool SHALL accept only `http:` and `https:` URLs whose host does not resolve to a loopback, private, link-local or unique-local address. It SHALL render at most 4 pages, at most 20 seconds each. It SHALL NOT submit forms, accept cookie banners, or follow links beyond the requested pages.

#### Scenario: Private address refused
- **WHEN** the tool is called with `url: "http://192.168.1.10/"`
- **THEN** it SHALL return an invalid-args error and render nothing

### Requirement: Guided Extraction Skill
The kit SHALL ship an `open-design-design-system-from-url` skill. It SHALL ask at most three questions, and only those the request leaves open: the URL or URLs, light/dark/both, and own brand or reference. It SHALL then call the extraction tool and write `DESIGN.md` and `tokens.css` together from the same draft, keeping every measured value as measured.

#### Scenario: Consistent files
- **WHEN** the skill finishes for a site whose draft `--accent` is `#58cc02` and `--font-body` starts with `"Nunito"`
- **THEN** the written `DESIGN.md` SHALL name `#58cc02` as the primary colour and Nunito as the body font, and `tokens.css` SHALL declare the same values

#### Scenario: Questions skipped when answered
- **WHEN** the request is "make a dark design system from https://example.com, it's our brand"
- **THEN** the skill SHALL ask no questions before extracting

### Requirement: Review Before Saving
Before saving, the skill SHALL build a review artifact that shows the site screenshot beside a sample page in the new tokens. It SHALL check it with `check_open_design_artifact` and ask the person whether it matches, applying at most two rounds of fixes. It SHALL then save the result as a `user:` design system and offer to set it active and to export it to Claude Design.

#### Scenario: Fix applied before saving
- **WHEN** the person answers the review with "the buttons are rounder on the site"
- **THEN** the skill SHALL update the radius tokens, rebuild the review, and save only after the person accepts or the second round ends

### Requirement: Reference Sites Are Not Copied
For a reference site, the skill SHALL name the system "<Name>-inspired", SHALL NOT copy logos or images, and SHALL say in `DESIGN.md` that it is inspired by the site. For the person's own brand, it SHALL copy the extracted marks into the design system's `assets/` folder.

#### Scenario: Reference site
- **WHEN** the person says the site is a reference, not their brand
- **THEN** the design system's name SHALL end in "-inspired", no logo file SHALL be written, and `DESIGN.md` SHALL state that it is inspired by the site
