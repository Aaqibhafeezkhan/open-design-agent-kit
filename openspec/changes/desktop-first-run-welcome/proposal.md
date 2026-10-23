## Why

People who don't write code now reach the kit through Claude Desktop Chat. The first minute decides whether they stay, and today it goes badly in three ways:

- **No tools, and a technical explanation.** In plain Chat with only the plugin, Chat ignores the plugin's MCP server, so Claude has the skills but none of the tools. Step 0 of the overview skill (`packages/claude-plugin/skills/open-design/SKILL.md`) handles this in one long sentence that names `open-design-<version>.mcpb` and "the project's GitHub releases", and offers no steps a non-technical person can follow.
- **Tools but no folder.** With the desktop extension and no connected folder, the agent calls `use_open_design_managed_workspace` without telling the user that is what's happening, or why. With the plugin in a Chat with a folder, it calls `set_open_design_workspace`. Neither path says what the user gets ("your designs will be saved in…").
- **A menu of formats instead of a question about goals.** `open-design-new` (`packages/content/local/prompts/new.md`) with a vague or empty request shows the 17 surfaces (Prototype, Wireframe, Color + type, 3D scene…) and asks which one. People with an idea know what they want to achieve ("promote my seed swap", "show investors my app idea", "get a UX job"), not which format does it.

The research behind this is the "Ideas Without Code" report (https://claude.ai/artifact/Pg7HrNyTJLTVaSbUi8YCsz), friction rows "First chat" and "Words".

## What Changes

- **Goals in the surface catalog.** `packages/content/local/surfaces.json` gains a `goals` list. Each goal has an `id`, a plain `label` ("Promote an event"), a one-line `description`, an `icon`, and an ordered list of ready surface ids it leads to (for example `promote-event` → `poster`, `social`, `campaign`). The content sync check fails on a goal that names an unknown or planned surface. Starter set: promote an event, sell or run a small shop, show an idea, get hired, explain something, post regularly, build a product screen.
- **`surface: "list"` returns the goals too.** `list_open_design_skills` with `surface: "list"` adds a `goals` array next to `surfaces`. A new `goal` argument returns that goal's surfaces in order, with the first marked as the default.
- **Welcome when nothing is set up (skill text).** Step 0's Desktop Chat line is rewritten as a short, plain welcome: say in one sentence that Open Design can't save or check designs in this chat yet, then give two numbered options with the actual clicks:
  1. Connect a folder: make a folder called `Open Design` (in Documents, for example), then in this chat click **+** → **Add folder** and pick it.
  2. Install the Open Design desktop app extension: download the file from the releases page (link), double-click it, then start a new chat.
  Then ask what the design is for. If the user wants to go ahead anyway, keep today's single-page Claude artifact fallback.
- **Welcome when the tools are there (skill text).** The first time in a session that the agent sets the workspace (either `set_open_design_workspace` or `use_open_design_managed_workspace`), it tells the user in one sentence where designs will be saved and that they can open that folder any time. In a managed workspace it offers to name the folder after the design.
- **Ask about the goal first.** The overview skill and `open-design-new`: when the request names no kind of thing to make, or is empty, the agent shows the goals (label and description) instead of the surfaces and asks one question: "What's it for?". Once the user picks a goal, the agent goes to that goal's first surface, or asks which one only if the goal leads to several and the request doesn't settle it. A request that already names a surface ("a poster") still skips straight to it. In Desktop Chat, where MCP Apps render, the goals may be shown as tiles by reusing the examples gallery with a goal filter (follow-up, not required here).
- **Home-folder guard text.** The refusal when the server would work in the home folder is reworded so the agent can relay it as is: "I need a folder to save your designs in" plus the two options.
- **Docs.** `docs/getting-started/claude-desktop.md` gains a short "Your first design" section with the welcome as the user sees it. `docs/reference/tools.md` documents `goal` and `goals`.

Not in this change: a gallery MCP App for goals, a one-click installer, changes to the Code tab or to other hosts beyond the shared `open-design-new` prompt.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `design-surfaces`: the catalog gains goals, `list_open_design_skills` returns them and accepts `goal`, the build guard checks them, and `open-design-new` leads with goals for a vague request.
- `open-design-agent-plugins`: the first-run welcome in Claude Desktop Chat (with and without tools) and the reworded home-folder guard.

## Impact

- `packages/content/local/surfaces.json`, `packages/content/scripts/surfaces.mjs` (build guard), `packages/core/src/content/contentIndex.ts` (goal parsing, mirrored from the guard), `packages/core/src/content/listSkillsPayload.ts`, `packages/mcp-server/src/index.ts` (`goal` input, guard text), unit tests.
- Skills: `packages/claude-plugin/skills/open-design/SKILL.md` and its copies (`packages/cli/assets/{claude,codex}-skills/open-design/SKILL.md`, `.agents/skills/open-design/SKILL.md`); `packages/content/local/prompts/new.md` and everything generated from it; content drift check.
- VS Code: its New design grid keeps showing surfaces. Showing goals there is a follow-up; the `open-design-new` prompt change reaches Copilot Chat too, which is intended.
- Pairs with plain-language-replies (wording rules the welcome follows) and desktop-visible-design-folder (the folder the welcome names). It can land first: the welcome names whatever folder the workspace tools report.
