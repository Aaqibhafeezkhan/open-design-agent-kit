## 1. Builder

- [x] 1.1 Colour mixing helper: `color-mix(in oklab|oklch, a, b N%)` to sRGB, with normalised percentages, premultiplied alpha and `transparent`, `black` and `white`; unit tests against browser-computed values for five real bundled tokens
- [x] 1.2 `toClaudeDesignSystem()`: resolve `color-mix()` values; keep colour `var()` as aliases and check that every alias target exists; check names against the grammar and for uniqueness across families
- [x] 1.3 README: drop the `#` heading and provenance lines, keep the prose, add one "Not synced" section; title from the manifest name, keeping "-inspired"
- [x] 1.4 Index: strict v3 keys; deterministic dates and `via` from `MANIFEST.json` for bundled systems, the current time for custom ones
- [x] 1.5 Cover: pattern row chosen from tokens, the name sized by the 440px rule, top-band fallback, derivation comment; reviewed 6 varied systems by eye (kami, lingo, linear-app, pinterest, stripe, vercel) in their first theme

## 2. Validator

- [x] 2.1 `validateClaudeDesignSystem(files)`: index shape, token grammar and caps, dropped values, README title, cover marker, file caps, generated paths; rules in one module, with a comment naming contract 0.2.47
- [x] 2.2 Contrast warnings per theme, from usage notes; the builder writes the flag into the failing token's usage note
- [x] 2.3 Unit tests: each error kind, and a failing brand pair that only warns

## 3. Build and check

- [x] 3.1 `scripts/build-claude-design-systems.ts`: build all bundled systems through the content index into `claude-design-systems/<id>/project/`, plus `claude-design-systems/README.md`
- [x] 3.2 `--check` mode (ignores the two dates); wire it into root `npm run lint`, and the build into `npm run sync-content`
- [x] 3.3 Mark `claude-design-systems/` as `linguist-generated` in `.gitattributes`; confirm that no package's `files` includes it
- [x] 3.4 `scripts/claude-design-system.ts export` uses the strict builder; regression test on a custom system

## 4. Prove it in Claude Design

- [x] 4.1 Publish three built systems (`lingo`, `kami`, `linear-app`) with the Artifact tool; all three were accepted as is, and covers were checked by rendering them headless (opening each page in Claude is left to a maintainer)
- [ ] 4.2 Import one through "Add design system → GitHub repo" with the `claude-design-systems/<id>` path, and confirm the importer copied `tokens.json` as is (left for a maintainer: it needs the claude.ai UI)

## 5. Docs

- [x] 5.1 `docs/guides/design-systems.md`: "Use one in Claude Design", covering the GitHub, upload and several-at-once routes, and why the connector route doesn't apply
- [x] 5.2 `packages/content/local/prompts/design-system-from-url.md`: point the Claude Design step at the strict export; `npm run sync-content`
- [x] 5.3 `npm run lint`, `npm run test:unit`
