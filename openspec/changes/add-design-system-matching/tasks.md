## 1. Index

- [ ] 1.1 Token facets (theme, accent hue family, display type, corner shape, density) as a pure function in `packages/core/src/content/designSystemMatching.ts`, with unit tests on a few fixtures
- [ ] 1.2 Draft `packages/content/local/design-system-descriptors.json` (moods, industries, surfaces, kind) for all bundled systems; human review
- [ ] 1.3 Content build writes `design-systems.profile.json`; drift check fails on a system without descriptors
- [ ] 1.4 Review the summaries that say "dark" over light tokens (list in design.md) and fix the ones that are wrong

## 2. Matching

- [ ] 2.1 Profile type with closed vocabularies; scoring, brand penalty, confidence, question set
- [ ] 2.2 Eval set of ~30 briefs with acceptable answers, run as a unit test
- [ ] 2.3 Multi-word `query` in `list_open_design_design_systems`, also over descriptors

## 3. Tools

- [ ] 3.1 `recommend_open_design_design_systems` in `packages/mcp-server` (every host)
- [ ] 3.2 Same tool as a VS Code `languageModelTool`
- [ ] 3.3 Optional: hint on `prepare_open_design_brief` when no design system resolved (open question)

## 4. Skills and docs

- [ ] 4.1 Overview skill step 2: when to recommend, infer vs ask, shortlist by host, fallback when the tool is missing
- [ ] 4.2 Per-skill stub line and `open-design-new`; regenerate CLI, Codex and `.agents` copies; drift checks
- [ ] 4.3 `docs/guides/design-systems.md` "Not sure which one?" (and fix the 152 count); `docs/reference/tools.md`

## 5. Verification

- [ ] 5.1 Scripted MCP client: recommend returns 3–5 ids with reasons; thin profile returns the question set
- [ ] 5.2 Try three eval briefs end to end in Claude Code, Copilot Chat and Codex; note where the agent asked and what it picked
