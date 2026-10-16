## Why

Briefs pick craft rules in a way that diverges from Open Design. With no design system active, every brief carries all 11 craft docs (about 104 KB): rules for forms, right-to-left text and editorial typography, even for a 3D scene. The 2026-10-15 3D baseline measured a 114 KB brief, about 104 KB of it irrelevant. Long, mostly irrelevant briefs push the skill's own workflow out of focus, and in the 2026-10-16 Copilot run a smaller model skipped the skill's critique step. With a design system active, briefs instead get that system's `craft.suggested` list, which upstream treats as metadata and never injects.

Upstream resolves craft per run: the skill's `od.craft.requires`, plus the design system's `craft.applies`, plus `typography` for decks, minus the design system's `craft.exemptions`. A skill that declares nothing gets no craft docs.

## What Changes

- **BREAKING (brief content):** `prepare_open_design_brief`, `prepare_open_design_exploration` and direction briefs resolve craft docs exactly as upstream's `resolveCraftRequirements` does: the skill's `od.craft.requires`, the design system's `craft.applies`, and `typography` when the skill's mode is `deck`, minus the design system's `craft.exemptions`, in that order, deduplicated. Unknown slugs are skipped. A skill declaring nothing, with no design-system `applies`, gets no craft section.
- The design system's `craft.suggested` no longer selects craft docs. It's still read as metadata.
- The brief heading changes from "Universal craft rules … regardless of skill" to "Craft rules", since the docs are now chosen per skill.
- Our 15 local skills declare `od.craft.requires` lists that fit them; for example, `3d-object` declares `color` and `anti-ai-slop`. Upstream skills keep their own declarations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `open-design-tools`: "Craft Rules Follow the Active Design System's Own Suggestions" is replaced by per-skill craft resolution matching upstream; "Brief Preparation Without File Writes" no longer says "universal craft rules".

## Impact

- `packages/core`: `ContentIndex` parses `od.craft.requires` (skills and examples) and `craft.applies` and `craft.exemptions` (design systems). `selectCraftSections` is replaced by `resolveCraftSections`. `composeInstructions` gets the new heading.
- Callers: VS Code `prepareBriefTool.ts`, MCP `tools.ts`, core `explorationTools.ts`.
- Content: the frontmatter of the 15 skills under `packages/content/local/skills/`, re-synced to every host.
- Briefs get much shorter for most skills, by up to about 104 KB with no design system active. Skills that relied on the implicit catalog lose it, as they do upstream.
