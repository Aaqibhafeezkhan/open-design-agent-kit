## Context

Upstream `apps/daemon/src/craft.ts` (open-design main `7abd6fc2b1`; the logic is unchanged in our pinned `open-design-v0.24.1` content):

- `resolveCraftRequirements` returns the skill's `requires`, plus the design system's `applies`, plus `typography` for deck runs, minus the design system's `exemptions`. Slugs are normalized to lowercase, must match `^[a-z0-9][a-z0-9-]*$`, and are deduplicated in order.
- `loadCraftSections` reads `craft/<slug>.md` in request order, skipping missing files silently. Skills already forward-reference `typographic-rhythm` and `pixel-discipline`, which don't exist yet.
- The design system's `suggested` list is only written by upstream's importer; runs never read it.

Ours (`selectCraftSections`): the active design system's `suggested` list if non-empty (197 of 198 systems list `color` and `accessibility-baseline`), otherwise all 11 docs.

## Goals / Non-Goals

**Goals:** brief craft content identical to upstream for the same skill and design system; short, relevant 3D briefs; sensible declarations for our own skills.

**Non-Goals:** porting upstream's web-clone exemption or freeform-deck detection (we always have a skill); writing new craft docs; changing the craft docs themselves.

## Decisions

### D1. Port the resolution rule, not the file loader

`resolveCraftSections(all, { skillRequires, skillMode, designSystemApplies, designSystemExemptions })` lives in `composeInstructions.ts` and picks from the already-loaded `CraftSection[]` in request order. Our `ContentIndex` already loads the craft docs. A comment names the upstream function and commit.

### D2. Decks always get typography

Same as upstream's `isDeckProject`: mode `deck` adds `typography` (the CJK leading rules).

### D3. Keep `craftSuggested` as metadata

`DesignSystemDetail.craftSuggested` stays (a published shape, and potentially useful for display) but no longer selects anything. `craftApplies` and `craftExemptions` are added. Custom (user) design systems have empty lists.

### D4. Declarations for our own skills

| Skills | `od.craft.requires` |
|---|---|
| `3d-object` | color, anti-ai-slop |
| `adr`, `rfc`, `postmortem`, `pr-explainer`, `changelog-page` | typography, typography-hierarchy, color, accessibility-baseline |
| `exec-briefing-memo`, `experiment-readout`, `competitive-teardown`, `info-funnel` | typography, typography-hierarchy, color, anti-ai-slop |
| `article-sketchnote-editorial` | typography, typography-hierarchy-editorial, color, anti-ai-slop |
| `diagram` | color, accessibility-baseline |
| `email-campaign` | typography, color, accessibility-baseline |
| `social-youtube-thumbnail` | typography, color, anti-ai-slop |
| `style-tile` | color, typography |

These come to roughly 13–30 KB per brief, against 104 KB.

### D5. Heading

`## Craft rules` followed by "This skill applies these craft rules." The old "regardless of skill" wording would now be false.

## Risks / Trade-offs

- [Skills that declare nothing (about 250 upstream) lose generic rules such as accessibility for web pages] → That's upstream's behavior, and it was chosen deliberately: parity, plus shorter briefs that keep the skill's workflow in focus. Our own skills declare their lists.
- [With a design system active, briefs used to get its suggested color and accessibility docs] → They now get the skill's declaration, as upstream does. Most skills that care about color declare it.
- [Hidden callers of `selectCraftSections`] → It's an internal export; all four call sites are updated in this change.

## Migration Plan

Additive except for brief content. Rollback is a revert.

## Open Questions

- Should `list_open_design_skills` show each skill's craft list? Not needed now.
