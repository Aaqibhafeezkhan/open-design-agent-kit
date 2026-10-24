## Why

On Claude Desktop, where most non-technical users are, the kit's questions arrive as a wall of chat text: the surface questions, the design-system recommender's questions, "which direction?", "fix these?". The MCP App (`ui://open-design/preview`) already renders inline there and already hands picks back as chat messages (`transport.ts` calls `app.sendMessage`), but it only shows artifacts, examples, design systems and campaign sheets. OpenUI (MIT) shows the value of letting the model ask for a small form and getting a structured answer back from a tap (`@ToAssistant`); we want that effect without OpenUI Lang or a renderer runtime. This is opportunity 5 in the UI/UX opportunities study (2026-10-24), and it belongs with the Desktop non-technical work already under way.

## What Changes

- **One generic ask view** in the existing preview MCP App: a new `ask` target in `ShowTarget` / `PreviewAppState` (`packages/core/src/preview/mcpApp/protocol.ts`) and one renderer in `mcpApp/main.ts`. It shows up to four questions, each as tappable option chips (single or multiple choice), an optional image per option (a design-system swatch, an example thumbnail, a direction screenshot), a "You pick" chip, and an optional short free-text box. One "Send" button.
- **A small JSON schema, not a language:** `{ title?, questions: [{ id, text, kind: "single" | "multi" | "text", options?: [{ id, label, imageRef? }], default? }] }`, validated in core, at most four questions and eight options each. `imageRef` names things the server already knows how to render (`designSystem:<id>`, `example:<id>`, `artifact:<entryPath>`, `checkRun:<id>`), loaded through the app-only `get_open_design_preview_state`, never raw URLs or HTML.
- **A model-visible show tool,** `show_open_design_questions(questions, title?)`, listed only to hosts that render MCP Apps (same filter as `show_open_design_examples`). On other hosts it returns the questions as a numbered text list the agent can paste, so the skill can call it everywhere.
- **The tap is the answer.** "Send" posts one chat message in a fixed, readable form ("Answers: where = Printed; mood = Dark") plus a machine line (`<!-- od-answers {"where":"printed"} -->`) the skills tell the agent to read. The page never calls a model-visible tool that changes state, matching the picker rule in `add-mcp-app-pickers`.
- **Wired into the flows that ask today:** surface questions and recommender questions (`add-brief-questions`), direction picks after an exploration, and the critic's `rework` question (`add-design-critic`). The skills say: where `show_open_design_questions` is in your tools, ask through it; otherwise ask in one chat message.
- **Feedback chips on the artifact view:** the existing artifact view gains three quick replies under the design ("Looks good", "Change something", "Try another direction"), sent the same way, so a user who doesn't know what to type has a next step.

## Capabilities

### New Capabilities
- `mcp-app-ask-view`: the ask schema and its limits, the ask view, the show tool and its text fallback, the answer message format, image references, and the feedback chips.

### Modified Capabilities
None. `mcp-app-preview` (from add-mcp-app-preview, not yet archived) keeps its requirements; this change adds a view beside the others.

## Impact

- `packages/core/src/preview/mcpApp/protocol.ts` (ask target, schema, answer message builder), `mcpApp/main.ts` and `appCss.ts` (ask renderer, feedback chips), `preview/server/mcpApp.ts` (image refs through the preview state builder).
- `packages/mcp-server/src/index.ts`, `src/tools.ts` (`show_open_design_questions`, list filter, text fallback).
- Skills: the overview, `open-design-new` and `open-design-explore` skills and generated copies.
- Docs: `docs/guides/inline-preview.md`, `docs/reference/tools.md`.
- Reaches plugin users only after a server release past the plugin's pinned version, like the pickers.
