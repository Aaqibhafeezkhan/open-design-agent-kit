## Why

`check_open_design_artifact` catches layout breakage (overflow, safe area, overlap, small type, low contrast in the default state, image resolution) but nothing about taste. A design can pass every check and still read as "default AI output": a purple-to-blue hero glow, a row of three identical feature cards, one radius and one shadow on every box, headings that ignore the design system's display scale, a red "Delete" that looks like every other button.

The kit already writes these rules down in `packages/content/assets/open-design/craft/anti-ai-slop.md`, but nothing checks them, and that doc (synced unedited from upstream Open Design) says several rules are "auto-enforced by the daemon's `lint-artifact` linter", which this kit doesn't run, so an agent reading it may believe something checks its work when nothing does. OpenPencil (`crates/op-design-lint/src/detectors/slop.rs`) and XIAS (`slop_tells.mjs`, `lint_intent.mjs`, `taste_audit.mjs`), both MIT, show these tells can be detected cheaply in the rendered page. This is opportunity 1 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **Five new preflight check codes** in `collectPreflight` (`packages/core/src/poster/pageScripts.ts`), measured on the rendered page so they work on any HTML the agent writes:
  - `slop-glow`: a large background gradient or glow in the purple-blue band (hue 235–300°, saturation ≥ 0.45) covering at least a quarter of the first viewport, or one of the default Tailwind indigo/violet values used as the accent.
  - `card-row`: three or four sibling cards with the same size, structure and an icon-heading-text pattern, directly under a section heading.
  - `uniform-surface`: every card-like box on the page shares one border radius and one box shadow, and there are at least six of them.
  - `type-scale`: an `h1`/`h2` whose computed size or family is not on the active design system's display tokens (`--text-*`, `--font-display`) when the page uses the token contract.
  - `intent`: a button whose text or `data-intent` says it destroys something ("Delete", "Remove", "Cancel subscription") and whose colour is not the danger token or a red hue; and a "primary" action styled identically to secondary ones.
- **Warnings, never errors.** Every taste finding is severity `warning`, carries the selector and a one-line fix ("use `--accent` from the design system", "vary the cards or use a list"), and does not count toward the "fix the errors" rule in the skill. Taste is a judgement; the check points, the agent decides.
- **Opt-out per page.** An element (or `<html>`) with `data-od-allow="slop-glow card-row …"` suppresses those codes beneath it, for a brand that really is purple or a deliberate three-up.
- **Say what this kit checks.** `assets/` is synced from upstream and never hand-edited, so the doc itself stays as it is. Instead, when a brief includes the `anti-ai-slop` craft section, `composeInstructions` appends a short "Checked in this kit" note: which rules `check_open_design_artifact` reports and under which code, and that the daemon linter it mentions doesn't run here.
- **Fixtures.** Good and bad HTML fixtures per code, adapted from XIAS `tests/fixtures/bad` and OpenPencil's slop detector tests, with a `NOTICE.md` in the fixture folder and an entry in `docs/contributing/upstream-ports.md`.

## Capabilities

### New Capabilities
- `taste-checks`: the five taste check codes, their thresholds, warning severity, the opt-out attribute and the "Checked in this kit" note.

### Modified Capabilities
None. The new codes are added to the preflight run that `export-preflight` and `artifact-visual-check` already describe; their requirements don't change.

## Impact

- `packages/core/src/poster/pageScripts.ts` (`collectPreflight` gains the five detectors as self-contained nested helpers, like `parseColor` and `luminance` today), `packages/core/src/test/unit/pageScripts.test.ts` and new fixtures under `packages/core/src/test/fixtures/taste/`.
- `packages/core/src/export/checkArtifact.ts`: no change to flow; the active design system's display tokens are passed into `collectPreflight` options for `type-scale`.
- `packages/core/src/generation/composeInstructions.ts` (the "Checked in this kit" note when `anti-ai-slop` is among the craft sections); `docs/contributing/upstream-ports.md`. No change under `packages/content/assets/`.
- Skill step 6 in `packages/claude-plugin/skills/open-design/SKILL.md` (and generated copies): "taste warnings are worth a look; fix them unless the brief asks for that look".
- Docs: `docs/reference/tools.md` (check codes), `docs/guides/generate-a-design.md` (what the check reports).
- No new tool, no new dependency.
