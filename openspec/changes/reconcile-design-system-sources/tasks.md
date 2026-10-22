## 1. Audit

- [ ] 1.1 `packages/content/scripts/audit-design-system-consistency.mjs`: parse template Color, Typography and Spacing bullets; resolve tokens (vendored plus override) with core's resolver; classify; print a side-by-side table
- [ ] 1.2 Placeholder list (`#2563eb`, `#3b82f6`, lone `Inter` against a named family) with a comment on where each came from
- [ ] 1.3 `--suggest`: write suggested rows to `local/design-system-sources.json`
- [ ] 1.4 Unit tests (`scripts/test/`): conflict, both placeholder kinds, hand-written `DESIGN.md` with no template bullets, hex shorthand and case

## 2. Decisions

- [ ] 2.1 Run the audit; confirm all rows in one review pass; record a reason for every `conflict` (`lingo` and `agentic` first)
- [ ] 2.2 Fold the 8 existing overrides into decisions and regenerate them

## 3. Overlays

- [ ] 3.1 Generator for `tokens.override.css` (accent and derived B slots, surface and text, font stacks, eight-step type scale; contrast fix for `--accent-on`)
- [ ] 3.2 Generator for `DESIGN.sections.md` in the template bullet format, with a do-not-edit header
- [ ] 3.3 `apply-local-overlay.mjs`: allow either or both files; reject unknown headings and other files
- [ ] 3.4 `contentIndex.ts`: apply sections when loading a bundled `DESIGN.md`; unit test (only named sections replaced)

## 4. Checks and consumers

- [ ] 4.1 `check-content-sync.mjs`: undecided, suggested and stale-overlay failures; removable-overlay report
- [ ] 4.2 `scripts/claude-design-system.ts`: read bundled systems through the content index; regression test that the exported `README.md` and `tokens.json` agree for `lingo`
- [ ] 4.3 Release notes list every system whose resolved tokens changed

## 5. Docs and upstream

- [ ] 5.1 `docs/contributing/content-sync.md` and `packages/content/local/README.md`: new overlay shape, decision file, audit command
- [ ] 5.2 Open an upstream issue with the audit table
- [ ] 5.3 `npm run lint`, `npm run test:unit`
