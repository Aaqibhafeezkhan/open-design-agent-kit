## Why

Agents either ask nothing and guess, or ask a page of questions before doing anything. The kit already has the parts for a middle path: each surface in `packages/content/local/surfaces.json` (the kit's own file, copied into `assets/` by the overlay) lists two or three `questions`, goals map plain aims ("Promote an event") to surfaces, and the skill says "ask only the surface's questions the request doesn't answer". But the questions are free text, they don't say which answers change the design, there is no "you pick" default, and when the agent does guess, nothing makes it say what it assumed, so a wrong guess shows up only when the user sees the result. XIAS `/grill-me` (MIT) asks a few sharp questions and writes the assumptions down before building. This is opportunity 4 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **Structured surface questions.** Each `questions` entry in `surfaces.json` becomes `{ id, text, options[], default, changes }`: two to four short options, the option used when the user says "you pick", and one line on what the answer changes ("layout density", "palette"). Plain strings stay valid for a release and are read as a question with no options.
- **Skip what the request answers.** `list_open_design_skills` with `surface` returns the questions as now; the skill rule becomes: ask at most three, only those the request, conversation and workspace don't answer, in one message, as multiple choice, accepting "you pick". A request that already says enough gets no questions.
- **Assumptions are stated.** `prepare_open_design_brief` gains an optional `assumptions` input (up to six short strings, for what the agent decided without asking) and `answers` (question id to answer). Both are written into the instructions ("Build to these decisions"), and the instructions tell the agent to pass them, with the one-line brief, to `register_open_design_artifact`'s new `brief` input (`{ text, answers, assumptions }`), stored as `metadata.brief`. Today the manifest records the skill and design system but not what was asked, so edits and the critic (`add-design-critic`) can't see it.
- **Say it once.** The skill tells the agent to list the assumptions in one line in its reply when the design is ready ("I assumed a dark theme and a single sign-up button; say if you want otherwise"), so a wrong guess costs one message, not a rebuild.
- **Desktop.** The same flow, with the host's question tool where it has one, and the ask view (`add-mcp-app-ask-view`) where the MCP App renders.

## Capabilities

### New Capabilities
- `brief-questions`: structured surface questions, the ask-at-most-three rule, `answers` and `assumptions` on the brief, the manifest record and the assumptions line in the reply.

### Modified Capabilities
None. `design-surfaces` keeps its catalog requirements; the question shape is defined here and read by the existing surface listing.

## Impact

- `packages/content/local/surfaces.json` (every surface's questions rewritten with options and defaults), its loader in `packages/core/src/content/contentIndex.ts` (accept both shapes).
- `packages/core/src/generation/composeInstructions.ts` ("Build to these decisions" section), `packages/mcp-server/src/tools.ts` `prepareBrief` and the VS Code brief tool (`answers`, `assumptions`); `register_open_design_artifact` gains a `brief` input stored as `metadata.brief`.
- Skills: the overview and `open-design-new` skills, and generated copies.
- Docs: `docs/reference/tools.md`, `docs/guides/generate-a-design.md`.
