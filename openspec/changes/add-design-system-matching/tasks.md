## 1. Index

- [x] 1.1 Token facets (theme, accent hue family, display type, corner shape) as a pure function in `packages/core/src/content/designSystemMatching.ts`, with unit tests on a few fixtures
- [x] 1.2 Draft `packages/content/local/design-system-descriptors.json` (moods, industries, surfaces, kind) for all bundled systems; human review
- [x] 1.3 Overlay copies the descriptors to the assets root; drift check fails on a missing row or an out-of-vocabulary value
- [ ] 1.4 Report the summaries that say "dark" over light tokens upstream (prose is upstream-owned; matching reads tokens)

## 2. Matching

- [x] 2.1 Profile type with closed vocabularies; scoring, brand penalty, confidence, question set
- [x] 2.2 Eval set of 15 briefs with acceptable answers, run as a unit test
- [x] 2.3 Multi-word `query` in `list_open_design_design_systems`, also over descriptors

## 3. Tools

- [x] 3.1 `recommend_open_design_design_systems` in `packages/mcp-server` (every host)
- [x] 3.2 Same tool as a VS Code `languageModelTool`
- [x] 3.3 `designSystemHint` on `prepare_open_design_brief` when no design system was used (MCP server and VS Code)

## 4. Skills and docs

- [x] 4.1 Overview skill step 2: when to recommend, infer vs ask, shortlist by host, fallback when the tool is missing
- [x] 4.2 Per-skill stub line and `open-design-new`; regenerate CLI, Codex and `.agents` copies; drift checks
- [x] 4.3 `docs/guides/design-systems.md` "Not sure which one?" (and fix the 152 count); `docs/reference/tools.md`

## 5. Verification

- [x] 5.1 Server tool tests: recommend ranks without touching the active system; brief hint present only without a design system
- [ ] 5.2 Try three eval briefs end to end in Claude Code, Copilot Chat and Codex; note where the agent asked and what it picked
