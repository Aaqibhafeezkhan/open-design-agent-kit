## 1. Measurement (core)

- [ ] 1.1 `generation/siteExtraction.ts`: open pages through `browserDiscovery` and the `artifactPage` session helpers; desktop 1440×900 and mobile 390×844; 20 s per page; URL and host safety checks
- [ ] 1.2 In-page measurement script: role sampling (ranked selectors and visual weight), computed colours, borders and shadows; `:root` and theme-scoped custom properties; `document.fonts`; text-role metrics; radii, spacing (snapped to 2px), container width, transitions
- [ ] 1.3 Forced `:hover` and `:active` on the primary control via CDP `CSS.forcePseudoState`
- [ ] 1.4 Dark theme detection: `prefers-color-scheme` emulation, root `data-theme` / `.dark` toggle
- [ ] 1.5 Marks: header logo (inline SVG serialized, or image fetched from the page's own response cache) and favicon
- [ ] 1.6 Blocked-page detection (challenge markers, login redirect, empty body) → `blocked` with a screenshot
- [ ] 1.7 Evidence bundle writer: `.open-design/.extract/<slug>/evidence.json`, screenshots, role crops

## 2. Draft tokens (core)

- [ ] 2.1 `generation/evidenceToTokens.ts`: roles → contract colours, text roles → `--text-*` (anchored on body), leading and tracking, radii and spacing → contract steps, fonts → stacks; unmeasured list
- [ ] 2.2 No-browser fallback through `brandExtraction.ts`, marked `partial`
- [ ] 2.3 Unit tests on recorded evidence fixtures (a light marketing site, a site with dark mode, a CSS-in-JS app, a blocked page)

## 3. Tool and command

- [ ] 3.1 `extract_open_design_design_system` in `packages/mcp-server/src/index.ts`
- [ ] 3.2 VS Code command `OpenDesign: Design System from Website`
- [ ] 3.3 Point `create_open_design_design_system`'s `sourceUrl` description at the new tool

## 4. Skill

- [ ] 4.1 `packages/content/local/skills/open-design-design-system-from-url/SKILL.md`: questions, extract, write both files from one draft, review artifact, fixes, save, offer export to Claude Design
- [ ] 4.2 Review artifact template (site screenshot beside a sample page with hero, buttons, card and form row)
- [ ] 4.3 Regenerate Claude plugin, CLI and Codex skills (`npm run sync-content`)

## 5. Docs and checks

- [ ] 5.1 `docs/guides/design-systems.md`: "From a website" section; `docs/reference/tools.md` entry
- [ ] 5.2 `npm run lint`, core unit tests, and one manual run against three public sites recorded in the PR
