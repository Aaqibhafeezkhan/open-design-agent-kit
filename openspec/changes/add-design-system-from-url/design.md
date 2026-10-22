## Context

Design systems in the kit are a `DESIGN.md` (prose and named values) plus a `tokens.css` that follows the vendored token contract (`vendored/designTokenSchema.ts`: A1 identity, A1 structure, A2 with fallbacks, B slots). Custom ones live under `.open-design/design-systems/<id>/` and are listed as `user:<id>` (`content/contentIndex.ts`). The model writes them, guided by `create_open_design_design_system` (`generation/customDesignSystemInstructions.ts`).

The kit already launches an installed Chromium through `puppeteer-core` for checks and exports, and never downloads one (`export/browserDiscovery.ts`). The upstream `brand-extract` skill shows what good measurement looks like (roles, marks, an anti-bot pause), but it relies on Open Design's in-app browser.

## Decisions

### Measure in the page, map in Node, write with the model

| Step | Who | Why |
|---|---|---|
| Measure computed styles, variables, fonts, marks | an injected script in the headless page | Only the rendered page knows what's actually applied: CSS-in-JS, variables and loaded fonts. |
| Turn evidence into candidate contract tokens | deterministic core code (`evidenceToTokens.ts`) | Testable and repeatable. The same page gives the same draft, and the model doesn't re-guess roles each time. |
| Write `DESIGN.md` + `tokens.css` | the model, from the draft and the screenshots | Prose (voice, imagery, do and don't) and judgement calls such as which of two blues is the brand need a model. Everything measurable comes from the draft. |

The tool returns the draft tokens with the evidence. The skill tells the model to keep every measured value unless the person asks to change it.

### Roles come from elements, not from colour frequency

Today's regex ranking counts how often a hex appears in the source, which rewards whatever the CSS framework repeats. The measurement script instead samples known roles:
- `body` / `main` background → `--bg`
- the most common card or section background that differs from `--bg` → `--surface`
- body text → `--fg`
- secondary or caption text → `--muted`
- most common border → `--border`
- the primary button's background, else the link colour → `--accent`
- the primary button's text colour → `--accent-on`
- its `:hover` and `:active` values, by forcing the states with CDP's `CSS.forcePseudoState` → `--accent-hover` and `--accent-active`

Elements are found with a ranked selector list (ARIA roles, common class patterns, `button`, `a[href]`, `input`) and by visual weight: big, high-contrast buttons above the fold rank first. Each role records the selector and screenshot crop it came from, so the person can see why a colour was picked.

### Type scale from roles, snapped to the contract

The text roles (`h1`–`h4`, body, small, caption, button and nav) give real sizes. These map onto `--text-xs … --text-4xl` by size order, anchored on body = `--text-base`. This is the same rule the claude-design-system-sync importer uses. `--leading-body` and `--leading-tight` come from body and `h1` line-height ratios, and `--tracking-display` from `h1`. Font stacks use the loaded family first, then the site's own fallbacks.

### Two themes only when the site has them

Dark values are measured only when the site reacts to `prefers-color-scheme: dark` emulation, or has a theme toggle the script can flip (`[data-theme]`, `.dark` on `html`). They go into a `[data-theme="dark"]` block, the same shape the bundled `cloudflare-kumo` system uses. With `theme: "dark"` on a light-only site, the tool says it found no dark theme and does not invent one.

### The review loop is the point

The skill always ends with the side-by-side view, built as a regular Open Design artifact so the preview and check tools work on it. One side is the site screenshot, cropped to the hero and one content block. The other is a sample page (hero, buttons, a card, a form row) rendered in the new tokens. The model runs `check_open_design_artifact` on it, compares, and asks the person. At most two fix rounds happen before saving. This step is what the community extractors skip, and it's where an extraction becomes trustworthy.

### Safety and politeness

- Only `http:` and `https:` URLs are accepted. The tool refuses `localhost`, private IP ranges and `file:`, the same rules as the share and publish guards.
- Pages load with a normal desktop user agent and are not logged in. The tool doesn't accept cookies or a login, and doesn't solve challenges. On a detected wall (Cloudflare and similar markers, an empty body, or a redirect to a login), it returns `blocked` with a screenshot, and the skill asks the person to provide the CSS or a screenshot instead.
- There are at most 4 pages, a 20-second timeout per page, and nothing is followed beyond what the page itself loads.
- For a reference site, logos and images are not copied, and the system's name and README say "inspired by". This is in line with how the bundled brand look-alikes are presented.

### Why not wrap an existing extractor

| Option | Why not (or why) |
|---|---|
| Depend on `extract-design-system` or `skillui` | They need a Playwright browser download, which the kit avoids. They write their own token shapes, have no review step, and would add a second browser stack beside `puppeteer-core`. |
| `designlang` | Broadest output, but its licence isn't stated, and it's a large CLI to depend on. |
| Own measurement on our existing browser session (chosen) | No new dependency. It writes our contract directly, works in every host that can run checks, and reuses the check and preview tools for the review. We can still borrow ideas such as role sampling and forced hover states, credited in the code. |

### Where the pieces landed

- The skill is a local prompt (`local/prompts/design-system-from-url.md`), like `open-design-explore`, so the Claude plugin, Codex, VS Code and the MCP prompt list all get it from one file. Its review page layout is spelled out in the prompt rather than shipped as a template file.
- VS Code gets the same tool (`#od-extract-design-system`) and a command, **Design System from Website**, that asks the three questions and prefills chat with the prompt.
- Subresource requests are checked too: a page can't make the browser fetch a private or loopback address (literal hosts and local names). DNS is resolved once, for the requested pages.
- Chrome won't start its sandbox as root, so the sandbox is turned off only when the process runs as root (containers and CI).

## Risks / Trade-offs

- **Sites differ wildly.** Role detection will be wrong sometimes. Mitigation: every role carries its source selector and crop, and the review loop exists to catch this.
- **No browser installed.** Falls back to the fetch route with a clear "partial" note, the same `no-browser` handling as checks.
- **Legal and brand concerns with look-alikes.** Default to "inspired by" naming and no marks for reference sites. Copy marks only when the person says it's their brand.

## Open Questions

- Should the tool also emit the Claude Design `project/` tree directly, or keep that in the separate export script? The proposal keeps it separate.
- Is one extra page enough for most sites, or should the skill suggest a product page automatically from the nav?
