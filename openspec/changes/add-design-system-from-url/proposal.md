## Why

People often want their own brand's design system, or one in the style of a site they admire. Today the kit has two partial routes, and neither gives a design system you'd trust:

- **`create_open_design_design_system` with `sourceUrl`** runs `generation/brandExtraction.ts`. That is a plain `fetch` of the page and up to three same-origin stylesheets, regex-harvested for at most 8 hex colours and 6 font names. It never renders the page. So it misses CSS-in-JS, colours written as `rgb()`/`oklch()`/variables, fonts that are actually loaded, and which colour does which job. It hands the model an unranked palette and leaves the model to guess roles.
- **The upstream `brand-extract` skill** (vendored in `packages/content/assets/open-design/skills/brand-extract/`) measures the live page properly, but it drives Open Design's own in-app browser with the `agent-browser` tool. Claude Code, Codex, Claude Desktop and VS Code have neither.

Several community skills do this well enough to be popular: [extract-design-system](https://github.com/arvindrk/extract-design-system) (MIT), [skillui](https://www.npmjs.com/package/skillui) (MIT) and [designlang](https://www.npmjs.com/package/designlang). They render the page in Playwright and read computed styles. But none of them asks the person anything, none writes our token contract, and none checks the result against the site. The person who tested the bundled `lingo` system in Claude Design found the output unconvincing, and a system that looks like the reference site is the part users judge.

The kit already drives an installed Chromium headlessly for `check_open_design_artifact` and exports (`export/browserDiscovery.ts`, `puppeteer-core`). So rendered extraction needs no new dependency.

## What Changes

- **New tool `extract_open_design_design_system`.** It takes `url` (plus up to 3 `extraUrls` on the same site), optional `theme` (`light` | `dark` | `both`), and `outputDir`. It renders each page at desktop and mobile widths in the installed browser and measures them. Then it writes an **evidence bundle** to `.open-design/.extract/<slug>/`: `evidence.json`, screenshots, and one crop per component sample. It writes no design system itself. The bundle holds:
  - **Roles, not just colours:** computed `background-color`, `color`, `border-color` and `box-shadow` of the page, body text, headings, links, primary and secondary buttons, inputs, cards and nav. Each comes with how many elements use it and the selector it came from.
  - **Declared variables:** the `:root` and theme-scoped custom properties, and their values in dark mode when the site has one (from `prefers-color-scheme` emulation or a `data-theme`/`.dark` toggle).
  - **Type:** the fonts that actually loaded (`document.fonts`), their families, weights and sources (Google Fonts or self-hosted), plus the size, line-height, weight and letter-spacing of each text role.
  - **Shape and rhythm:** border radii, the most common gaps and paddings (snapped to a 2px or 4px grid), max container width, and transition durations and easing.
  - **Brand marks:** the header logo (inline SVG or image) and favicon, saved as files.
- **Graceful fallback.** With no browser installed, the tool falls back to today's `brandExtraction.ts` fetch and says the result is partial. On an anti-bot wall, a login page or an empty render, it stops and reports what it saw. It never tries to get round the block.
- **New skill `open-design-design-system-from-url`.** It runs a short guided loop, and every step is visible to the person:
  1. **Ask** (at most 3 questions, skipped when the request already answers them): which URL or URLs, light/dark/both, and whether this is the person's own brand (copy exact) or a reference (in the style of, renamed).
  2. **Extract** with the tool.
  3. **Write** `DESIGN.md` and `tokens.css` together from the same evidence, so the two cannot disagree. `tokens.css` uses the contract roles. `DESIGN.md` names the same values, and only adds prose for what evidence can't measure: voice, imagery, do and don't.
  4. **Show** a side-by-side preview of the site screenshot next to a generated sample page in the new system, and ask "does this look like the site?". Accept fixes in plain words ("the buttons are rounder", "headings are bolder").
  5. **Save** it as a `user:` design system, set it active if asked, and offer to export it to Claude Design with `scripts/claude-design-system.ts` (from the claude-design-system-sync prototype).
- **Reference vs own brand.** For a reference site, the system is named "<Name>-inspired". Logos are not copied, and the README says it is inspired by the site. For the person's own brand, marks are copied into `assets/`.
- **Docs.** A new section in `docs/guides/design-systems.md` and a tool entry in `docs/reference/tools.md`.

Not in this change: crawling a whole site, extracting React component code, extraction from Figma (already `pull_open_design_figma_frame`), and keeping an extracted system in step with the site later.

## Capabilities

### New Capabilities
- `design-system-extraction`: rendered measurement of a website into an evidence bundle, the guided skill that turns evidence into a consistent `DESIGN.md` + `tokens.css`, the review loop, and the fallback and safety rules.

### Modified Capabilities
None. `create_open_design_design_system` keeps its `sourceUrl` behaviour; only its tool description changes, to point at the new tool for anything more than a starting palette.

## Impact

- `packages/core`:
  - new `generation/siteExtraction.ts` (the browser session, measurement script and evidence writer), reusing `export/browserDiscovery.ts` and the page-session helpers in `export/artifactPage.ts`
  - new `generation/evidenceToTokens.ts` (the deterministic role → contract-token mapping the skill starts from), with unit tests on recorded evidence fixtures
  - `generation/brandExtraction.ts` stays as the no-browser fallback
- `packages/mcp-server/src/index.ts`: the new tool. In VS Code the same core is offered through the command `OpenDesign: Design System from Website`.
- Content: the new skill under `packages/content/local/skills/`, generated into the Claude plugin, CLI and Codex skills.
- Docs: `docs/guides/design-systems.md`, `docs/reference/tools.md`.
- No new dependencies. Network access is only to the URL the person gave, plus what that page itself loads.
