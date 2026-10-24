## Why

Generated app screens show the happy path with placeholder words. Buttons say "Submit" and "Learn more", errors say "Something went wrong", empty lists are blank, the loading button is greyed out and unreachable by keyboard, and "Delete account" looks like "Save". The kit has the state rules already (`craft/state-coverage.md` and `craft/form-validation.md`, synced from upstream) but they reach only two skills (`faq-page` and `redesign-skill` require `state-coverage`), none of the prototype, dashboard or mobile templates require them, and no craft doc covers the words in an interface. XIAS's `ux-writing` skill (MIT) shows a short, rule-based microcopy guide is enough to change output. This is opportunity 11 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **Local craft docs.** The content overlay (`packages/content/scripts/apply-local-overlay.mjs`) learns `local/craft/<id>.md`: new craft docs the kit owns, copied into `assets/open-design/craft/` like local skills are copied into `skills/`, never shadowing an upstream doc (an id collision fails the overlay).
- **A new craft doc, `ux-writing`** (`local/craft/ux-writing.md`), about one page:
  - buttons say the action and the object ("Save changes", "Delete project"), never "Submit", "OK" or "Click here";
  - errors say what happened and how to fix it, in the user's words, next to the field;
  - empty states say what will be here, why it's empty, and offer the first action;
  - loading says what is loading when it takes more than a second; skeletons match the layout;
  - destructive actions name what is lost, use the danger colour, and confirm with the object's name on the confirm button ("Delete 3 files"), with undo preferred over confirm where possible;
  - no filler, no invented numbers; sentence case; one term per concept.
- **A kit addendum for action states,** `local/craft/action-states.md`: loading is not disabled. A busy button keeps focus and its label (with a spinner and `aria-busy` on its region or a live status), uses `aria-disabled="true"` plus a guard instead of `disabled` so keyboard and screen-reader users don't lose their place, and returns to its label on failure with the error shown. This tightens a line in the upstream `form-validation.md` that recommends `disabled` while submitting; the addendum says which one wins in this kit.
- **Wider reach through local requirements.** A new `local/craft-requires.json` maps skill and template ids to extra craft docs, merged into `od.craft.requires` when content loads, so upstream `SKILL.md` files stay unedited. First mapping: `state-coverage`, `ux-writing` and `action-states` for the prototype surface (`web-prototype`, `saas-landing`, `pricing-page`, `waitlist-page`, `dashboard` and the taste variants), the mobile surface (`mobile-app`, `mobile-onboarding`, `gamified-app`), and the kit's shop and card-set recipes where they have forms.
- **Checks point here.** The `intent` code from `add-taste-checks` and the critic's copy and states areas (`add-design-critic`) cite these docs in their fixes.

## Capabilities

### New Capabilities
- `states-and-microcopy-craft`: local craft docs in the overlay, the `ux-writing` and `action-states` docs, the local craft requirements map, and the first mapping.

### Modified Capabilities
None. `open-design-tools`' Per-Skill Craft Rules requirement still holds: the map adds to a skill's `od.craft.requires`, and the docs are resolved the same way.

## Impact

- `packages/content/scripts/apply-local-overlay.mjs` (craft docs, collision check), `check-content-sync.mjs` (provenance header on ported text), `packages/content/local/craft/{ux-writing,action-states}.md`, `packages/content/local/craft-requires.json`.
- `packages/core/src/content/contentIndex.ts` (merge the map into skills' craft requirements; unknown ids are a content-check error).
- `docs/contributing/content-sync.md` (local craft docs), `docs/contributing/upstream-ports.md` (XIAS `ux-writing` as a source), `docs/guides/generate-a-design.md` (a line on states and words).
