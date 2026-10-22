## Context

How a design system is chosen today (`docs/guides/design-systems.md`, overview skill step 2): the request names one, or the active one is used, or none. The agent calls `list_open_design_design_systems` only when the person "names a brand or visual direction", and that tool is a single-substring filter over id, name, summary and category. Visual pickers exist where a host renders them: `show_open_design_design_systems` (MCP Apps hosts, add-mcp-app-pickers) and VS Code's `OpenDesign: Browse Design Systems` QuickPick. Upstream Open Design had a `<question-form>` for picking among its five visual directions; we dropped it when vendoring `designDirections.ts` because upstream marks it dormant and it needs the upstream web app.

What the catalog gives us (measured on the 198 bundled systems):

| Source | Coverage | Useful for |
|---|---|---|
| `manifest.json` name, category, description | 198 | display, coarse grouping (23 categories, uneven) |
| `DESIGN.md` blockquote summary | 198 | free-text fit, but prose sometimes contradicts tokens |
| `tokens.css` normalized contract | 198 have `--bg`, `--fg`, `--accent`, `--font-display`, `--radius-md`; 152 have `--space-*` | theme, accent hue, type family, corner shape, density |
| brand vs genre | 124 product-named, 74 genre | the opt-in rule below |

Computed from tokens: 138 light / 59 dark; display type 166 sans, 23 serif, 9 mono; accents mostly blue (58), red (35), orange (27), green (20), neutral (19). That spread is wide enough for theme, type and accent to be real filters, and lopsided enough (few serif, few mono) that a "serif, editorial" request has a short, good list.

Prose versus tokens: these summaries call the look dark while `--bg` is light, and need a human look (some are fair, e.g. "dark mode support"): `contemporary`, `cursor`, `dashboard`, `elevenlabs`, `expo`, `meta`, `minimax`, `posthog`, `revolut`, `strava-ios`, `superhuman`. Facets come from tokens because tokens are what renders.

## Goals / Non-Goals

**Goals:** the same recommendation for the same profile on every host; at most one round of questions, skippable; a shortlist of 3 to 5 with reasons; small in the model's context; works offline and with no extra model call from the server.

**Non-Goals:** embedding search or a vector store; the server calling a model; learning from past picks; generating a new design system (that stays `create_open_design_design_system` and style tiles).

## Decisions

### Split the work: the agent builds the profile, core ranks

Options considered:

1. **Agent-only.** The skill tells the agent to read all summaries and choose. About 8k tokens per pick, different answers per model (Copilot users switch between small and large models), reads the prose that contradicts tokens, and nothing to test.
2. **Server-only.** The tool takes the raw brief and keyword-matches it. Cheap and deterministic, but brittle on language ("calm", "zen", "spa-like" are one mood) and blind to the conversation before the request.
3. **Split (chosen).** The agent turns the request and conversation into a typed profile (closed vocabularies for `moods`, `theme`, `surface`, `industry`, plus free `brief` and `likeBrands`). Core scores against the index. The language step is what agents do well and every host can do; the ranking is a pure function with unit tests and a fixed eval set.

Cost: the profile vocabulary has to be good. Mitigation: the tool's input schema lists the allowed values, unknown values are ignored with a note in the result, and `brief` is still keyword-scored as a fallback.

### Infer first, ask only when it's thin

Asking every time is friction people complain about; never asking guesses wrong silently. Rule in the skill:

- Named a system or a brand look ("like Notion") → no questions, look it up.
- Profile has 2+ fields the agent can fill with confidence (a yoga studio site → `industry: wellness`, `moods: [calm, warm]`) → recommend, show the shortlist, proceed with #1 unless the person picks another. One line says which was used and how to switch.
- Thinner than that → ask the tool's question set in one message, accept "you pick", then recommend.

Questions (fixed, so every host asks the same thing; the agent drops any it can already answer):

1. **What is it for?** product / SaaS · developer tool · finance · consumer app · editorial or content · brand or event · internal tool or dashboard
2. **How should it feel?** calm and minimal · warm and friendly · bold and loud · premium and elegant · technical and dense · playful · editorial · retro
3. **Light or dark?** light · dark · either

And always an optional free line: "Any product or site you'd like it to feel like?"

### Scoring

Weighted sum, each part 0 to 1, simple enough to explain in the result's `reason`:

- hard filters first: `theme` (if not "either"), `surface: mobile` prefers `*-ios` systems, `avoid[]` removes matches;
- moods against curated mood tags (0.35), industry/purpose against curated industry tags (0.25), type/accent/shape facets implied by the moods (calm → low-chroma accent, roomy spacing; technical → mono or tight sans, sharp corners) (0.2), `brief` words against name/summary/descriptors (0.1), `likeBrands` exact or near id (overrides to the top);
- brand systems get a penalty unless `likeBrands` or the brief names a product, so genres lead by default;
- ties broken toward systems with `--space-*` tokens and more preview pages (more complete), then by name for stability.

`confidence` is the top score's margin over #4, bucketed `high`/`medium`/`low`; low confidence plus a thin profile is what returns the questions.

### Curated descriptors, generated once and reviewed

Tokens can't say "wellness" or "playful". A one-off script drafts `moods[]`, `industries[]`, `surfaces[]` and `kind: brand|genre` for each system from its DESIGN.md, then a person reviews the diff (198 rows, one line each). The content drift check fails if a bundled system has no row, so upstream syncs that add systems surface the gap. Custom systems have token facets only; the agent's own judgment covers them, and `create_open_design_design_system` can ask for the descriptors later.

### Shortlist presentation per host

| Host | Questions | Shortlist |
|---|---|---|
| Claude Desktop Chat / Cowork (MCP Apps) | chat message | `show_open_design_design_systems` with `ids` |
| Claude Code | its structured question tool when present, else chat | numbered text with hex swatches |
| Copilot Chat (VS Code) | chat | numbered text; the reply can point to `OpenDesign: Browse Design Systems` |
| Codex | chat | numbered text |

MCP elicitation would give a form on hosts that support it, but support differs by host and version, so it's not the baseline; it can be added behind a capability check later.

### Alternative kept for later: pick by eye with style tiles

For people who'd rather look than answer, a 4-tile style-tile exploration of the top recommendations is already possible (`od:design-system:style-tile`). It costs four generations, so the skill offers it, it doesn't default to it.

## Risks / Trade-offs

- **Descriptor quality decides the result.** A bad mood tag sends people to the wrong look. Mitigation: human review of the generated file, and an eval set of ~30 briefs with acceptable answers that runs in unit tests.
- **One more step before the first design.** Only when nothing is active and nothing was named, at most one message, skippable. Measure by trying the eval briefs end to end on each host.
- **Overriding someone's taste.** The tool recommends; the agent says what it picked and how to switch. Nothing is set active until a brief is prepared or the person picks.
- **Brand look-alikes.** The default penalty keeps product-named systems out of unprompted shortlists; the person can still ask for one.
- **Server release.** Plugin users get the tool only after a server release past the plugin's 0.1.8 pin (see the parked Desktop release); the skill text must read fine when the tool is missing, falling back to today's `list_open_design_design_systems` flow.

## Open Questions

- Should `prepare_open_design_brief` with no design system resolved return a one-line hint pointing at the recommend tool, so agents that skip the skill still learn about it? Leaning yes, as a hint field, not an error.
- Do we want `default` (Starter) to be the explicit fallback when the person says "you pick" and the profile is empty, instead of no design system?
