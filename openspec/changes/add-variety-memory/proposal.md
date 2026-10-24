## Why

Ask for five designs in a week and they come out as siblings: the same dark hero, the same accent, the same display font, the same three-up below the fold. Each brief starts fresh, so the agent can't know it did this yesterday. OpenPencil (MIT) keeps a generation history (`op-ai-skills/src/memory/generation_history.rs`) and feeds recent choices back so new work avoids repeating them. The kit already records every design in an `<entry>.artifact.json` manifest, so it has the place to write a short history and the brief to read it from. This is opportunity 6 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **A history file** at `.open-design/history.json` in the workspace (beside `config.json`), appended by `register_open_design_artifact` on first registration of an entry and updated on re-registration: entry path, title, skill id, design system id, collection id, date, and a small **look signature** read from the HTML: accent colour, display and body font families, theme (light or dark from `--bg` luminance), and hero layout (centred, split, full-bleed image, or none). At most 50 entries, oldest dropped.
- **A "recent designs" line in the brief.** `prepare_open_design_brief` adds a short section listing the last five designs' signatures that aren't in the same collection or exploration, with one rule: "unless the user asked for the same look, or the design system fixes it, make this one recognisably different in at least two of: theme, hero layout, display font, accent." Designs in the same collection are listed as "keep consistent with" instead.
- **Off switch.** `"variety": false` in `.open-design/config.json` stops the section (history is still written); a brief with an explicit design system keeps its tokens, and the rule only covers what the system leaves open.
- **No content leaves the workspace.** The history holds signatures, not HTML or brief text, and is listed in the kit's `.gitignore` suggestion like the rest of `.open-design/`.

## Capabilities

### New Capabilities
- `variety-memory`: the history file and its limits, the look signature, the recent-designs section in the brief, collection consistency, and the off switch.

### Modified Capabilities
None.

## Impact

- New `packages/core/src/workspace/designHistory.ts` (read, append, cap, signature from HTML with cheerio and the colour helpers), tests with fixture pages.
- `packages/mcp-server/src/tools.ts` `registerArtifact` (append) and `prepareBrief` (section), same in the VS Code tools; `composeInstructions.ts` gets a `recentDesigns` input.
- `.open-design/config.json` reader: `variety` flag.
- Docs: `docs/guides/generate-a-design.md` ("Why designs vary"), `docs/reference/tools.md`.
