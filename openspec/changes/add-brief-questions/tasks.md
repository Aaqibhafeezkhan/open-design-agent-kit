## 1. Content

- [x] 1.1 Question object type and loader in `contentIndex.ts` (both shapes); `scripts/surfaces.mjs` guard warns on plain strings in bundled content
- [x] 1.2 Rewrite every surface's questions in `packages/content/local/surfaces.json` with options, default and `changes`

## 2. Brief

- [x] 2.1 `answers` and `assumptions` on `prepare_open_design_brief` (MCP, VS Code), limits and errors
- [x] 2.2 "Build to these decisions" section in `composeInstructions.ts`
- [x] 2.3 `brief` input on `register_open_design_artifact` (MCP, VS Code) stored as `metadata.brief`; the instructions tell the agent to pass it; tests

## 3. Skills and docs

- [x] 3.1 Overview and `open-design-new` skills: at most three, one message, merged with recommender questions, assumptions line; regenerate copies
- [x] 3.2 `docs/reference/tools.md`, `docs/guides/generate-a-design.md`
