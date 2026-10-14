## Why

The Mobile app surface (`mobile-app`, `mobile-onboarding`, `gamified-app`) has no mobile design systems behind it. Every one of the 168 catalog systems describes a website: nav bars, heroes, pricing grids, desktop section rhythm. A user who asks for "a fintech app that feels like Monzo" gets web tokens squeezed into an iPhone frame.

[awesome-ios-design-md](https://github.com/Meliwat/awesome-ios-design-md) (MIT) has 200 reverse-engineered specs of real iOS apps. Each is a DESIGN.md in one fixed nine-section format with exact hex values, a full type ramp, tab bar, sheet and list-row specs, safe areas, Dynamic Type and haptics. That is the mobile vocabulary our catalog lacks. They are not tokens.css packages, though, and their accuracy is unverified: the repo is generated, has two commits and no tags.

A dry-run on 2026-10-13 showed tokens can be extracted from them mechanically. The extractor found accent, background, foreground, muted and border in 96–100% of files, and surface in 85%. The file's own §9 colour summary agreed with the extracted accent in 186 of 192 files. A hand check found about 86% of values right, and the misses fall into a few known patterns. So these systems can be ported with an extract-then-review workflow rather than by hand-authoring each one, as typeui was.

## What Changes

- **A new `Mobile Apps` design-system category** of local overlay packages, ids `<app>-ios` (for example `spotify-ios`). The `-ios` suffix avoids the 21 apps that share a brand with an upstream web system (`spotify`, `airbnb`, `notion`…) and makes clear which one is the app.
- **Each package** is the usual three files:
  - `DESIGN.md`: the source text verbatim, with a standard header (category line and one-line summary) and an attribution footer;
  - `tokens.css`: extracted, then reviewed;
  - `manifest.json`: `source.type: "inspired"` with the source URL, licence and copyright.
- **Extraction tooling** (`npm run extract-ios`) for `packages/content`:
  - `--report` prints coverage and §9 agreement across all apps;
  - `--list-candidates` shows unported apps and same-brand collisions;
  - `<app>...` writes review scaffolds (`tokens.css` with inline TODOs, plus a `NOTES.md` checklist) into a gitignored staging directory.
  - It never writes into `local/`.
- **A first curated batch of 30 apps**, 2–3 per source category, mixing light-first and dark-first. Each one is reviewed against its NOTES.md before it moves into `local/design-systems/`.
- **A shipped-content guard:** the content sync check fails when a local design system's `tokens.css` still contains scaffold markers (`TODO`, `SCAFFOLD, NOT FINAL`). This covers typeui ports too.
- **A licence notice:** the source's MIT notice ships once with the content assets, so every host that mirrors them carries it.
- **Discovery:** the agent instructions on every host say:
  - for a Mobile surface request that names an app or brand, or has no active design system, check the `Mobile Apps` category first;
  - an "app like X" brief maps to `x-ios` when it exists.
  - The Mobile surface's questions gain "Should it look like a particular app (Spotify, Monzo, Strava…)?".

## Capabilities

### New Capabilities
- `mobile-design-systems`: the Mobile Apps category and its packages, the extraction and review workflow, the scaffold-marker guard, the licence notice, and mobile discovery guidance.

### Modified Capabilities
<!-- None. Token resolution, the overlay's three-file package shape, category filtering and the preview panel already handle these packages unchanged. -->

## Non-goals

- **A mobile Showcase.** The preview panel's Showcase tab still renders a web product page, which misrepresents a phone app. A phone-framed Showcase mode is a separate follow-up change. The Visualize tab works for these systems as is.
- **The SwiftUI, Expo and Compose flavors** (about 13 MB). They suit a later "hand this mockup to code" feature, not HTML mockups.
- **Porting all 200 apps.** More batches can follow with the same tooling.
- **A second colour mode in `tokens.css`.** The token contract has one mode. The other mode stays described in the DESIGN.md.

## Impact

- `packages/content/scripts/`: `iosExtraction.mjs` (pure), `extract-ios-design-system.mjs` (CLI), `test/iosExtraction.test.mjs`; `extract-ios` npm script; `.gitignore` entry for `scripts/.ios-scaffold/`.
- `packages/content/scripts/check-content-sync.mjs`: the scaffold-marker guard.
- `packages/content/scripts/apply-local-overlay.mjs` and `local/notices/`: copying the licence notice into `assets/open-design/notices/`.
- `packages/content/local/design-systems/<app>-ios/` × 30; `local/README.md`; `local/surfaces.json` (Mobile surface question).
- Instructions: `packages/vscode/instructions/open-design.instructions.md`, the MCP server instructions, and the generated Claude Code and Codex skills.
- No core or extension code changes. No new dependencies.
