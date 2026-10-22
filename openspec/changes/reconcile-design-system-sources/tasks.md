## 1. Audit

- [x] 1.1 `packages/content/scripts/audit-design-system-consistency.mjs`: parse template Color, Typography and Spacing bullets; resolve tokens (vendored plus override) with core's resolver; classify; print a side-by-side table
- [x] 1.2 Placeholder list (`#2563eb`, `#3b82f6`, lone `Inter` against a named family) with a comment on where each came from
- [x] 1.3 `--suggest`: write suggested rows to `local/design-system-sources.json`
- [x] 1.4 Unit tests (`scripts/test/`): conflict, both placeholder kinds, hand-written `DESIGN.md` with no template bullets, hex shorthand and case

## 2. Decisions

- [ ] 2.1 Run the audit; confirm all rows in one review pass; record a reason for every `conflict` (`lingo` and `agentic` first). Rows are written as suggestions, awaiting review
- [x] 2.2 Fold the 8 existing overrides into decisions and regenerate them

## 3. Overlays

- [x] 3.1 Generator for `tokens.override.css` (accent and derived B slots, surface and text, font stacks, eight-step type scale; contrast fix for `--accent-on`)
- [x] 3.2 Generator for `DESIGN.sections.md` in the template bullet format, with a do-not-edit header
- [x] 3.3 `apply-local-overlay.mjs`: allow either or both files; reject unknown headings and other files
- [x] 3.4 `contentIndex.ts`: apply sections when loading a bundled `DESIGN.md`; unit test (only named sections replaced)

## 4. Checks and consumers

- [x] 4.1 `check-content-sync.mjs`: undecided, suggested and stale-overlay failures; removable-overlay report
- [x] 4.2 `scripts/claude-design-system.ts`: read bundled systems through the content index; regression test that the exported `README.md` and `tokens.json` agree for `lingo`
- [x] 4.3 Release notes list every system whose resolved tokens changed

## 5. Docs and upstream

- [x] 5.1 `docs/contributing/content-sync.md` and `packages/content/local/README.md`: new overlay shape, decision file, audit command
- [ ] 5.2 Open an upstream issue with the audit table (left for a maintainer: it's posted outside this repository)
- [x] 5.3 `npm run lint`, `npm run test:unit`
