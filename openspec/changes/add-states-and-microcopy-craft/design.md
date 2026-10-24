## Context

`packages/content/assets/` is synced from upstream open-design at a tagged release and never hand-edited; the kit's own skills, examples, prompts and design-system overrides are layered on from `packages/content/local/` by `apply-local-overlay.mjs`, which refuses id collisions for skills. Craft docs are resolved per brief from the skill's `od.craft.requires` and the design system's `craft.applies`/`craft.exemptions` (`craftRequirementsFor` and `resolveCraftSections` in `composeInstructions.ts`); a required id with no doc is skipped.

## Goals / Non-Goals

**Goals:** every app-like design gets the state and microcopy rules; the kit can add and tighten craft rules without editing synced files; one source of truth per rule.

**Non-Goals:** localising microcopy rules (English first; the rules are mostly language-neutral); a copywriting tool; brand voice (that's `voice.md` and design systems); rewriting upstream craft docs.

## Decisions

### Overlay for craft, same as skills

Craft docs are content like skills, so they get the same overlay path and the same collision rule. A local doc that wants to change an upstream rule doesn't shadow it; it is a separate doc that says which rule it overrides, which keeps the upstream doc diffable at the next sync.

### A requirements map instead of editing frontmatter

Upstream templates such as `design-templates/web-prototype/SKILL.md` have no craft requirements, and editing them would be overwritten at the next sync. `local/craft-requires.json` (`{ "<skill-or-template-id>": ["state-coverage", "ux-writing"] }`) is merged at load. The content check fails on unknown skill ids and unknown craft ids, so the map can't rot silently.

### Loading is not disabled

`disabled` removes a button from the tab order and from the accessibility tree's actionable set; when a request takes a while, focus jumps to the document and screen readers announce nothing. `aria-disabled="true"` with a click guard keeps focus and lets a live region say "Saving…". This is the kit's rule; the addendum quotes the upstream line it supersedes so a reader of both sees the decision.

### Size

Each local doc is kept under about 120 lines: craft sections are pasted into every brief that requires them, and three more long docs would crowd the instructions. Examples are one line each.

## Risks / Trade-offs

- **Brief length** grows for prototypes by three sections. Mitigation: the size cap; measure instruction length before and after on `web-prototype` and record it.
- **Two docs disagreeing** (upstream `form-validation` vs `action-states`). Mitigation: the addendum names the line it overrides; a content-check test asserts the addendum still quotes text that exists upstream, so a sync that changes it is noticed.

## Open Questions

- Should design systems be able to exempt `ux-writing` (a brutalist system that wants terse labels)? Proposed: yes, through the existing `craft.exemptions`.
