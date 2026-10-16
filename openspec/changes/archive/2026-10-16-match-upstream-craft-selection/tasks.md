## 1. Core

- [x] 1.1 `ContentIndex`: parse `od.craft.requires` into `SkillDetail.craftRequires` (skills, design templates, examples) and `craft.applies` and `craft.exemptions` into `DesignSystemDetail.craftApplies` and `craftExemptions` (empty for custom systems)
- [x] 1.2 Replace `selectCraftSections` with `resolveCraftSections` in `composeInstructions.ts` (upstream `resolveCraftRequirements` order, normalization, deck typography, exemptions, unknown slugs skipped), and change the section heading to "Craft rules"
- [x] 1.3 Update the callers: VS Code `prepareBriefTool.ts`, MCP `tools.ts`, and both calls in `explorationTools.ts`
- [x] 1.4 Unit tests for the five spec scenarios, and update existing tests that expected the universal heading or the suggested-list filter

## 2. Content

- [x] 2.1 Add `od.craft.requires` to the 15 local skills per design D4
- [x] 2.2 Re-run the overlay and host generation; drift checks pass

## 3. Docs and verify

- [x] 3.1 Update docs that describe craft rules in briefs
- [x] 3.2 Typecheck, lint and unit tests across packages; `openspec validate --strict`
- [x] 3.3 Measure the 3d-object brief size before and after, with and without an active design system. Before: 117,654 characters (all 11 docs, no design system) and 33,500 (`colorful`: its suggested color + accessibility-baseline). After: about 21,000 without a design system and 24,491 with `colorful` (color + anti-ai-slop either way). Decks get typography; an undeclared skill (`card-twitter`) gets no craft section (5,568). The one failing unit test (deck-stage export timeout) fails on main too.
