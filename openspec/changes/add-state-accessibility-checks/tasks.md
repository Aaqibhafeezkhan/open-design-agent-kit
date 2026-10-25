## 1. Core

- [x] 1.1 Page functions in `pageScripts.ts`: `collectStateTargets` (cap 60), `compareStateStyles`, `collectTapTargets` (with the SC 2.5.8 spacing test), `collectRunningMotion`
- [x] 1.2 States pass in `checkArtifact.ts` with a CDP session (`CSS.forcePseudoState`), transitions disabled, contrast via the existing helpers
- [x] 1.3 Reflow render at 320 px for fluid pages; reduced-motion render with emulated media
- [x] 1.4 Grouping (five selectors per code), screenshot-on-error within `maxImages`, `states` option
- [x] 1.5 Fixtures and tests: hover contrast, missing focus ring, small icon button, 360 px layout, marquee, poster skip

## 2. Tools

- [x] 2.1 `states` input on `check_open_design_artifact` (MCP, VS Code) and the CLI `check` command

## 3. Docs

- [x] 3.1 `docs/reference/tools.md`, `docs/guides/generate-a-design.md`; codes added to the "Checked in this kit" note for `accessibility-baseline`
- [x] 3.2 Measure check time on three bundled examples before and after; record in the PR
