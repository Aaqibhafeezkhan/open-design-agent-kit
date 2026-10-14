## 1. Extraction tooling

- [x] 1.1 `scripts/iosExtraction.mjs`: pure extraction (mode, roles, accent, semantic, type scale, radii, margin, §9 agreement), scaffold builder, candidate classification, catalog summary
- [x] 1.2 `scripts/extract-ios-design-system.mjs` CLI (`--report`, `--list-candidates`, `<app>...`, `--source`/`IOS_DESIGN_MD_SRC`, `--force`); `extract-ios` npm script; gitignore `scripts/.ios-scaffold/`
- [x] 1.3 Unit tests (`scripts/test/iosExtraction.test.mjs`): mode headings, inline pairs, brand-named canvas, surface/muted corrections, accent fallbacks, type/radii parsing, §9 agreement, scaffold shape and flags
- [x] 1.4 `local/README.md`: porting workflow section

## 2. Guards and licence

- [x] 2.1 `check-content-sync.mjs`: fail on `TODO` / `SCAFFOLD, NOT FINAL` in any `local/design-systems/*/tokens.css`; test
- [x] 2.2 `local/notices/LICENSE-awesome-ios-design-md.txt` (source LICENSE verbatim); overlay copies `local/notices/*` to `assets/open-design/notices/`; overlay test; VS Code mirror and the content npm package include it; recorded in `docs/contributing/upstream-ports.md`

## 3. First batch (30 apps)

- [x] 3.1 Scaffold the batch listed in design.md §7
- [x] 3.2 Review each against its NOTES.md and the source DESIGN.md (resolve every item, remove TODOs); record any recurring miss as an extractor fix + test
- [x] 3.3 Move into `local/design-systems/`, `npm run sync-content`, check-sync and content mirror pass
- [x] 3.4 Spot-check: all 30 resolve through core's ContentIndex with no missing tokens and no approximation; Visualize tab rendered for spotify-ios, monzo-ios, goodreads-ios and nike-run-club-ios
- [x] 3.5 `mobile-app` generations via headless Claude Code (`claude -p`, local MCP build) with monzo-ios, spotify-ios, strava-ios and netflix-ios: all rendered correctly in a phone frame with the system's tokens. Upstream's `mobile-app` design template names a seed `assets/template.html` it doesn't ship, so agents draw the frame themselves (follow-up, not this change)

## 4. Discovery

- [x] 4.1 Instructions: VS Code instructions file and the overview skill (Claude Code, Codex, `init` copies regenerated), plus the `list_open_design_design_systems` description in the MCP server and the VS Code tool contribution: Mobile Apps category first for mobile/app-like briefs, prefer `<app>-ios` for phone screens
- [x] 4.2 Mobile surface: second question "Should it look like a particular app (Spotify, Monzo, Strava…)?" in `local/surfaces.json`; host content regenerated
- [x] 4.3 Docs: "Mobile app design systems" section in `docs/guides/design-systems.md` (and the Showcase caveat), tool reference count; docs check

## 5. Verification

- [ ] 5.1 Manual: "a budgeting app home screen that feels like Monzo" picks `monzo-ios` in VS Code and Claude Code. Claude Code: passed (headless run, 2026-10-14). VS Code: pending
- [ ] 5.2 Manual: "Spotify now-playing screen" picks `spotify-ios`, and "Spotify-style landing page" still picks `spotify`. Claude Code: passed (headless runs, 2026-10-14). VS Code: pending
