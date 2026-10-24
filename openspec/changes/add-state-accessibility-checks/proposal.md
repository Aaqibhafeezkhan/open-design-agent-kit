## Why

Preflight checks contrast only in the default state, at two viewports, with animations running. The accessibility failures that agents ship most often happen elsewhere: a hover or focus colour that drops below 4.5:1, a focus ring that isn't there, icon buttons smaller than a fingertip, a layout that breaks when text reflows on a narrow screen, and motion that ignores `prefers-reduced-motion`. `craft/accessibility-baseline.md` and `craft/animation-discipline.md` already ask for all of these; nothing checks them. XIAS (MIT) ships `verify_states`, `verify_target_size`, `verify_overflow` and `verify_reduced_motion` as separate scripts, which shows each is a cheap browser pass. This is opportunity 2 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **A states pass** in `checkPage` (`packages/core/src/export/checkArtifact.ts`), run once at the desktop viewport after the existing checks: for each focusable element (capped), force `:hover`, then `:focus-visible`, through the Chrome DevTools Protocol (`CSS.forcePseudoState`), and measure:
  - `state-contrast`: text contrast in the forced state, same thresholds as `contrast` (4.5:1, 3:1 for large text);
  - `focus-visible`: no visible change between the default and `:focus-visible` states (no outline, ring, border or background change), as an error, since keyboard users lose their place.
- **`tap-target`**, at the mobile viewport: an interactive element smaller than 24×24 CSS px whose 24px circle overlaps another target (WCAG 2.2 SC 2.5.8 with its spacing exception). Warning, and error below 16px.
- **`reflow`**: one extra render at 320 CSS px wide (WCAG 1.4.10), reusing `collectHorizontalScroll`; horizontal scroll or clipped text there is an error for pages, skipped for fixed-format designs (posters, cards, decks) whose canvas is not fluid.
- **`reduced-motion`**: one extra render with `prefers-reduced-motion: reduce` emulated; any CSS animation or transition longer than 200ms still running, or a `requestAnimationFrame` loop moving elements, is a warning. Pages with no motion skip it.
- **Bounded cost.** The states pass looks at up to 60 elements, picked from buttons, links in nav and main, inputs and `[tabindex]`. The two extra renders add no screenshots unless they find an error, then one cropped screenshot each, inside the existing image cap.
- **Skips.** `checkArtifact` gets `states: false` for callers that need a fast run (the export preflight keeps the fast path; `check_open_design_artifact` runs states by default).

## Capabilities

### New Capabilities
- `state-accessibility-checks`: the states pass, the four new check codes, the reflow and reduced-motion renders, their skips and their bounded cost.

### Modified Capabilities
None. The new codes join the findings `artifact-visual-check` already returns; its requirements are unchanged.

## Impact

- `packages/core/src/export/checkArtifact.ts` (states pass via a CDP session, two extra renders, `states` option), `packages/core/src/poster/pageScripts.ts` (`collectStateTargets`, `compareStateStyles`, `collectTapTargets`, `collectRunningMotion` as page functions).
- `packages/mcp-server/src/tools.ts`, `packages/vscode/src/tools/*` and the CLI `check` command: optional `states` input (default true).
- Tests: fixtures with a low-contrast hover, a missing focus ring, a 20px icon button, a 360px-wide fixed layout, an infinite animation without a reduced-motion rule.
- Docs: `docs/reference/tools.md` (codes and `states`), `docs/guides/generate-a-design.md`; the "Checked in this kit" note from `add-taste-checks` also lists these codes when `accessibility-baseline` is among a brief's craft sections.
- Chromium only (CDP). The export browser is already Chromium on every host.
