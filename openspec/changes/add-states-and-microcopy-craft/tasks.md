## 1. Overlay and loading

- [x] 1.1 `apply-local-overlay.mjs`: copy `local/craft/*.md`, fail on collisions; test
- [x] 1.2 `local/craft-requires.json` merged in `contentIndex.ts`; content check for unknown skill and craft ids
- [x] 1.3 Content check: `action-states` still quotes existing upstream text

## 2. Docs

- [x] 2.1 `local/craft/ux-writing.md` (provenance header for ideas from XIAS `ux-writing`)
- [x] 2.2 `local/craft/action-states.md`
- [x] 2.3 First mapping for prototype and mobile entries and the kit's shop and card-set recipes; measure `web-prototype` instruction length before and after

## 3. Contributor docs

- [x] 3.1 `docs/contributing/content-sync.md`, `docs/contributing/upstream-ports.md`, `docs/guides/generate-a-design.md`

## Notes

- 2.3: the shop (`shop-pack`) and card-set (`card-set`) recipes make product images, banners, parcel cards and print files, with no forms or app states, so they are left out of the map. The mapping covers `web-prototype` and its three taste variants, `saas-landing`, `pricing-page`, `waitlist-page`, `dashboard`, `mobile-app`, `mobile-onboarding` and `gamified-app`.
- 2.3: composed instructions (recipe plus craft, no design system, one-line brief), before → after: `web-prototype` 6,960 → 22,065 characters (about 1,700 → 5,500 tokens); `saas-landing` 34,513 → 49,563; `dashboard` 41,399 → 49,386 (already had `state-coverage`); `mobile-app` 21,346 → 29,333. Most of the `web-prototype` growth is upstream `state-coverage` (about 8,700 characters); `ux-writing` and `action-states` add about 8,000 together.
- `craft-requires.json` keys go by catalogue folder id, so a template's same-named remixable example gets the same docs.
