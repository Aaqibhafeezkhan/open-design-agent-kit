## Context

`register_open_design_artifact` writes `<entry>.artifact.json` with kind, title, skill, design system, collection and exploration fields. `prepare_open_design_brief` resolves the skill, design system and craft sections and calls `composeInstructions`. Workspace state lives in `.open-design/` (`config.json`, `.checks/`). Core already depends on cheerio and has colour helpers (`colorMix.ts`).

## Goals / Non-Goals

**Goals:** consecutive unrelated designs look different by default; designs meant to belong together stay together; a tiny, local, inspectable record; no extra tool call.

**Non-Goals:** taste learning or user preference modelling; cross-workspace history; storing briefs or HTML; analytics; forcing variety when a design system defines the look.

## Decisions

### Signature from the HTML, statically

Rendering on every registration would need the export browser. A static read is enough for four signals: `:root` custom properties (`--accent`, `--bg`, `--font-display`, `--font-body`) when the page uses the token contract, else the first `h1`'s inline or `<style>` font family and the most used button background; theme from `--bg` (or `body` background) luminance; hero layout from the first section's structure (one centred column, two columns, a full-width image or video, none). Unknown signals are left out, not guessed.

### A separate history file, not a scan of manifests

Scanning every manifest at brief time costs a directory walk and doesn't keep order or deleted designs. A capped `history.json` is one small read. Manifests stay the source of truth for each design; the history is a cache that can be deleted safely.

### What the rule asks

"Recognisably different in at least two of theme, hero layout, display font, accent" is concrete enough to follow and check, loose enough not to fight the brief. The section is three to six lines so it doesn't crowd the instructions.

### Collections and explorations

Screens in one collection must match; explorations must differ from each other already (their own rule). So the brief lists same-collection designs as "keep consistent with", and leaves exploration siblings out.

## Risks / Trade-offs

- **Variety for its own sake** when the user wanted "another one like the last". Mitigation: "unless the user asked for the same look" in the rule; the off switch.
- **Wrong signature** from an unusual page. It only nudges; a wrong font name costs nothing.
- **Concurrent writes** from two agents. The file is rewritten atomically (write temp, rename), last write wins; losing an entry is harmless.

## Open Questions

- Should the eval runs (`add-output-quality-evals`) measure variety across a series of briefs? Proposed: yes, as one score: distinct signatures over five unrelated briefs.
