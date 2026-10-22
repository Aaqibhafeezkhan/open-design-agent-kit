## Why

Picking a design system is the hardest choice the kit asks of a person, and it asks it in the same weak way on every host (Claude Code, Copilot Chat, Codex, Claude Desktop):

- **198 bundled systems, one substring search.** `list_open_design_design_systems` matches the whole `query` as one substring of id, name, summary and category (`matchesQuery` in `packages/core/src/content/contentIndex.ts`). "warm" works; "warm fintech dashboard" matches nothing. Categories are uneven (30 "Mobile Apps", 1 "Social & Messaging", three spellings of "Editorial").
- **The agent only looks when the person names a direction.** Every skill says "call `list_open_design_design_systems` first only if the user names a brand or visual direction". Most people don't, so most designs are made with whatever is active, or with none, and the person never learns there was a choice.
- **The person has to know the vocabulary.** 124 of the 198 systems are named after products (Stripe, Linear, Duolingo); 74 are genres (minimal, neumorphism, riso). Someone asking for "a landing page for my yoga studio" can't be expected to say "use `headspace-ios`" or "use `friendly`".
- **The visual picker helps only where MCP Apps render.** `show_open_design_design_systems` (add-mcp-app-pickers) shows tiles in Claude Desktop Chat, and VS Code has a QuickPick, but Claude Code's terminal, Codex and Copilot Chat's chat flow still get text.
- **Prose and tokens disagree.** The summary is the only thing the agent sees, and at least 10 systems describe themselves as dark while their `tokens.css` is light (`dashboard`, `cursor`, `elevenlabs`, `expo`, `minimax`, …). A matcher that reads prose would recommend them for "dark" and render them light.

Every bundled system already ships the same normalized token contract (`--bg`, `--fg`, `--accent`, `--font-display`, `--radius-md`, spacing and type scales, all 198 of them), so the visual facts a person cares about can be computed instead of guessed.

## What Changes

- **A design-system profile index.** Compute facets for every design system from its resolved tokens when the catalog is read (theme light/dark, accent hue family, display type serif/sans/mono, corner shape), cached for bundled systems, and add curated, reviewed descriptors that tokens can't give (moods, fitting industries, best surfaces, `brand` vs `genre`) in one extension-owned `design-system-descriptors.json`. Custom (`user:`) systems get the token facets only.
- **A matching tool, `recommend_open_design_design_systems`.** The agent fills a small *design profile* from what it already knows (the request, the conversation, the workspace) and passes it in: `industries[]`, `moods[]`, `theme`, `surface`, `likeBrands[]`, `avoid[]`, and the free-text `brief`. Core ranks deterministically and returns the top 3 to 5 with a one-line reason each, the facets it matched on, and `confidence`. When confidence is low and fewer than two profile fields are filled, the result also returns a fixed **question set** (at most three questions, each with 4 to 6 short options) for the agent to ask.
- **The agent asks, the tool decides.** Turning chat into a profile is a language task, which every agent does well; ranking 198 entries is a data task, which a deterministic function does the same way every time. The split keeps results identical across Claude Code, Copilot Chat and Codex, testable, and small in context (the agent never loads 198 summaries).
- **When to match.** The overview skill's step 2 changes: when the person hasn't named a direction **and** no design system is active **and** this is a new design (not an edit, remix or export), the agent recommends before calling `prepare_open_design_brief`. It infers silently when the context is enough, asks the returned questions (once, in one message) when it isn't, and always lets the person skip with "you pick". Once a system is chosen it becomes active, so this happens about once per project.
- **Show the shortlist by eye where possible.** Where `show_open_design_design_systems` is in the tool list, the agent passes the recommended `ids` to it. Elsewhere it shows a short numbered list (name, one-line reason, 3 swatches as hex). Claude Code may use its structured question tool for the questions; other hosts use plain chat.
- **Better plain search.** `list_open_design_design_systems` `query` matches every word separately (all words must match somewhere) and also searches the curated descriptors, so "warm fintech" finds something.
- **A hint on unstyled briefs.** `prepare_open_design_brief` returns a one-line `designSystemHint` when no design system was used, pointing at the recommend tool, so agents that skip the overview skill still find it.
- **`default` is the "you pick" answer.** With an empty profile the recommendation starts with `default`, followed by deliberately different starters.
- **Brand look-alikes are opt-in.** A product-named system is recommended only when the person names that product or asks for something "like X"; otherwise genre systems rank first. This avoids quietly dressing someone's startup as Stripe.

## Capabilities

### New Capabilities
- `design-system-matching`: the profile index, the recommend tool, the question set, multi-word search and the skill rule for when to match.

### Modified Capabilities
None. `open-design-tools` keeps its existing requirements; multi-word search is additive and lives in the new capability.

## Impact

- Content: curated descriptors in `packages/content/local/design-system-descriptors.json`, copied to the assets root by the overlay; `scripts/designSystemDescriptors.mjs` checks coverage and vocabulary from the content drift check.
- Core: new `packages/core/src/content/designSystemMatching.ts` (facets, scoring, question set), `contentIndex.ts` (load descriptors, `recommendDesignSystems`, multi-word design-system search).
- Tools: `packages/mcp-server/src/index.ts`/`tools.ts` (new tool on every host), `packages/vscode/package.json` and its tool adapter (same tool as a `languageModelTool`).
- Skills: `packages/claude-plugin/skills/open-design/SKILL.md` step 2, the generated per-skill stubs' "call `list_open_design_design_systems` first only if…" line, `open-design-new`; CLI, Codex and `.agents` copies via the existing generators and drift checks.
- Docs: `docs/guides/design-systems.md` (a "Not sure which one?" section; also fix its stale "152" count), `docs/reference/tools.md`.
- Content finding, not changed here: some upstream summaries call a light-token system "dark" (list in design.md). Matching reads tokens, so it isn't affected; fixing the prose is an upstream change.
