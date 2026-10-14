## Context

The catalog's design systems are upstream open-design packages (vendored) plus local overlay packages (`packages/content/local/design-systems/<id>/`, exactly `DESIGN.md` + `manifest.json` + `tokens.css`). 16 local packages were ported by hand from typeui, because typeui's structured colour fields were unreliable. `tokens.css` is the token source of truth. Heuristics over DESIGN.md prose matched curated tokens only about a third of the time on upstream's free-form files.

awesome-ios-design-md is different. Every one of its 200 neutral DESIGN.md files has the same nine numbered sections:

- §2 lists colours as `- **Role Name** (`#hex`): description`;
- §3 has a hierarchy table (role, size, weight, line height);
- §4 gives component radii;
- §9 restates the key colours in a "Quick Color Reference" list.

The role *names* still vary: brand-named canvases ("Hinge Cream"), inline `#A light / #B dark` pairs, a hex inside the bold name, and the canonical mode stated only in a subsection heading ("Canvas & Surfaces (Dark — default)", "Light Mode (Limited Use)", "(Light only)", "Dark Mode (Not Used)").

## Goals / Non-Goals

**Goals:**
- Ship a reviewed first batch of mobile design systems through the existing overlay, with no core changes.
- Make porting more apps cheap and repeatable without letting unreviewed values ship.
- Comply with the source's MIT licence wherever the content is mirrored.

**Non-Goals:** a phone-framed Showcase (follow-up change), the framework flavors, two-mode tokens, porting all 200.

## Decisions

### 1. Extract, then review, never ship raw

The extractor (`iosExtraction.mjs`, pure and fs-free like `typeuiExtraction.mjs`) builds each role from rules measured against all 200 files:

- **Primary mode**, in order: mode-qualified subsection headings; an unqualified canvas's luminance; §1/§2 prose ("dark-first", "dark-only"…); otherwise light, the iOS default.
- **Roles** (`--bg`, `--surface`, `--fg`, `--muted`, `--border`) are scored by:
  - name match (strong) or the description's first clause (weak);
  - fit with the primary mode (an inline pair or mode-qualified entry beats an unqualified one);
  - two measured corrections:
    - a card-described surface beats a grouped "Surface Gray";
    - "Text Muted" beats a "Text Secondary" that is really body text, and tertiary text is never muted.
- **Accent**: the first entry of a `Primary…` subsection. If that entry is neutral, a chromatic primary-button colour wins. A dedicated "chrome accent" beats data colours (activity rings).
- **Accent text**: `--accent-on` is the text or icon colour §4 gives the accent-filled button (as a hex, or "white"/"black"). That's available in 171 of 200 files, and a contrast-based guess would have been wrong in 113 of those, because most brands put white text on mid-tone accents. Contrast is only the fallback.
- **Fonts**: the display/primary face, a separate Body face when §3 names one, and the free substitute (usually Google Fonts) that 47 files recommend for proprietary faces. The stack is `"Brand Face", "Free Substitute", system stack`, so a browser-rendered mockup gets the closest loadable face.
- **Type, radii, margin**: §3 table sizes are mapped onto the contract's `--text-*` tiers around the Body row. 1pt is treated as 1 CSS px. Radii come from §4, excluding pills and sub-4pt hairline bars. The screen margin comes from §5 lines about margins, gutters or side insets (8–28pt), never from paddings inside components.
- **Confidence**: each colour role is checked against §9. Any role §9 doesn't confirm gets an inline `TODO` in `tokens.css` and a `NOTES.md` item. Weak-rule accents, neutral accents, light-mode grey surfaces, gradient or rgba palettes, likely-proprietary fonts and the chosen mode are always listed.

Alternative considered: hand-authoring like typeui. That was rejected because the regular format makes extraction about 86% right, so review becomes the bottleneck, not authoring.

Alternative considered: extracting at runtime from DESIGN.md (no `tokens.css`). That was rejected because `tokens.css` is the single source of truth (see the design-system-preview spec), and unreviewed values would ship.

### 2. Guard against shipping scaffolds

The scaffold marks unresolved values with `/* TODO: … */` and its header with `SCAFFOLD, NOT FINAL`. `check-content-sync.mjs` fails when any `local/design-systems/*/tokens.css` contains either marker. This also protects typeui ports, whose scaffolds use the same markers. Scaffolds live in a gitignored staging directory and are never written into `local/`, as with typeui.

### 3. Ids, category, names

- **Id:** `<app>-ios`. A bare `<app>` would collide with 21 upstream web systems, and the overlay rejects new packages whose id exists upstream. The suffix also tells agents and users which one is the app.
- **Category:** one `Mobile Apps`. ContentIndex already filters by exact category, and the tree view and Browse picker already group by it, so nothing changes in code. Sub-categories (music, finance…) would add 11 tree groups for 30 entries. The source category stays in `manifest.source.url`.
- **Name:** `"<App> (iOS)"`, from the README heading.

### 4. DESIGN.md is the source text, attributed

The package DESIGN.md is the source file from §1 onwards, verbatim. Before it go our header (`# Design System Inspired by <App> (iOS)`, `> Category: Mobile Apps`, the README's one-line summary) and a short paragraph saying it's a phone-sized, iOS-point, HIG-component system. After it comes an attribution line (source URL, copyright, MIT). Because the prose is kept, the agent still sees the material that no token carries: the other colour mode, tab bars and sheets, haptics, Dynamic Type, safe areas.

### 5. Licence notice

MIT requires the copyright and permission notice in copies. The full notice goes in `local/notices/LICENSE-awesome-ios-design-md.txt`. The overlay copies `local/notices/*` to `assets/open-design/notices/`, so it is published with the content package and mirrored into the VS Code, Claude Code and Codex hosts with the rest of `assets/open-design/`. Every manifest's `source.origin` and DESIGN.md footer also name the licence.

### 6. Discovery without new tool surface

There is no new field or tool. Instructions on every host say:
- for Mobile surface work, or an "app like X" brief, call `list_open_design_design_systems` with `category: "Mobile Apps"` (and `query` for a named app) before falling back to the general catalog;
- prefer `x-ios` over the web `x` for phone screens.

The Mobile surface gains a second question asking which app's look to follow. This follows the existing preference for the catalog's own primitives over bespoke machinery.

### 7. First batch: 30 apps

Picked from the `--report` data and reviewed on 2026-10-13: 2–3 per source category, a mix of light-first and dark-first, lowest review-item counts. It includes one same-brand case (Spotify) to exercise web and iOS systems listed side by side.

- **Dating:** bumble, feeld
- **Finance:** monzo, cash-app, nubank
- **Fitness:** strava, oura, headspace, nike-run-club
- **Food:** uber-eats, doordash, resy
- **Messaging:** telegram, whatsapp, signal
- **Misc:** goodreads
- **Music:** spotify, apple-music, pocket-casts
- **Productivity:** linear, things-3, todoist
- **Social:** bluesky, reddit, snapchat
- **Travel:** booking, lyft, flighty
- **Video:** netflix, twitch

Review outcome: the batch started with 110 review items. Seven recurring misses were fixed in the extractor, with tests:
- a brand "card" entry beating `Surface 1`;
- a coloured "Text Muted …" entry taken as muted;
- `--accent-on` from contrast instead of §4;
- chat wallpaper beating the app canvas;
- §4 text colours written as words, or listing the accent's own hex first;
- component paddings read as the screen margin;
- the brand-surface colour beating the entry named as the primary action.

That brought the batch to 77 items. Only 6 values were then set by hand:
- Strava and DoorDash `--surface`, which neither file names as a card colour;
- Oura `--accent-on`;
- Goodreads `--accent` and `--accent-on` (its brand brown is the text colour; the CTA is Shelf Green);
- Apple Music `--muted`, flattened from `#3C3C43` at 60% on white.

## Risks / Trade-offs

- **Source accuracy is unverified** (generated, reverse-engineered). Mitigation: review against the source prose and §9; `inspired` source type; the attribution says "adapted". We describe these as inspired-by, never official.
- **Trademarks:** the same stance as the 152 upstream brand-inspired systems. Names are used descriptively; no logos are shipped.
- **One colour mode:** a dark-first app's light variant only exists in prose. Acceptable, since the token contract is single-mode everywhere.
- **Web Showcase misrepresents these systems** until the mobile Showcase lands. Acceptable for one release; Visualize is correct.
- **Upstream drift:** the source has no tags. Ports are snapshots; `--report` can be re-run to spot changes, but there is no automatic sync.

## Migration Plan

Additive content only. Rollback means removing the `*-ios` directories and the notice.
