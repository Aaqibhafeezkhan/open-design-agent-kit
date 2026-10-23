## Why

The kit's skills and prompts were written for people who use coding agents, and the agent's replies take on their vocabulary. A Desktop Chat user who asked for a flyer gets told the "artifact" was "registered", that the "design system" `warm-editorial` is "active", that preflight found text "in the bleed", and that the export is at `.open-design/seed-swap/exports/seed-swap-a4.pdf`. Each of those words is a small wall for someone who doesn't write code, and the reply often ends without saying what they can do next.

Nothing tells the agent otherwise. The overview skill (`packages/claude-plugin/skills/open-design/SKILL.md`) and the local prompts (`packages/content/local/prompts/*.md`) have no guidance on how to talk to the user, and some of them tell the agent to repeat internal terms ("say which design system you used", "mention that they can click **Comment**").

Research: "Ideas Without Code" report (https://claude.ai/artifact/Pg7HrNyTJLTVaSbUi8YCsz), friction row "Words".

## What Changes

- **One shared voice block.** New file `packages/content/local/voice.md`: a short set of rules and a glossary for anything the agent says to the user. It is inserted into every local prompt and the overview skill at generation time through a `{{voice}}` placeholder, so all hosts and all copies get the same text.
- **The rules.**
  - Match the user's words. If they say "artifact", "design tokens" or a file path, use their terms; otherwise use the plain ones below.
  - Never put tool names, file extensions of internal files (`.artifact.json`, `.comments.json`), ids like `od:prototype:poster-hero`, or the words "register", "manifest", "sidecar", "entry" or "surface" in a reply.
  - Explain a print term the first time it comes up, in one short clause, and not again.
  - Describe where a file is the way the user would find it ("in your Open Design folder, under seed-swap-flyer"); give a raw path only where the host makes it clickable (Claude Code, the Desktop Code tab) or the user asks.
  - End each reply that finishes a step with what they can do next: one line, at most two options ("Want it in Instagram sizes too, or ready to print?").
- **The glossary.**

  | Instead of | Say |
  |---|---|
  | artifact, entry, registered | your design, saved |
  | design system, active design system | your style (first time: "a saved style: colours, fonts and spacing") |
  | surface, skill, template, recipe | kind of design, starting layout (or say nothing) |
  | workspace, output directory | your folder, your Open Design folder |
  | bleed | print edge ("a few millimetres extra that the printer trims off") |
  | trim size | final size |
  | preflight findings, errors | "I checked it and fixed…" / "one thing to look at:" |
  | export | save as PDF, save as an image |
  | inline preview, MCP App | the preview above |

- **Prompts and skill reworded where they ask for internal terms.** For example, "say which design system you used and that the user can switch" becomes "say which style you used and that they can pick another".
- **Build check.** The content sync check fails when a local prompt or the overview skill source lacks `{{voice}}`, so a new prompt can't skip it.

Not in this change: rewording tool result strings in the MCP server (beyond what desktop-first-run-welcome changes), VS Code UI labels, docs pages, translations.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `open-design-agent-plugins`: a shared voice block in every prompt and the overview skill, its rules and glossary, and the build check.

## Impact

- New `packages/content/local/voice.md`; `packages/content/scripts/localPrompts.mjs` (substitute `{{voice}}`, claude-only rules still apply), `check-content-sync.mjs` (presence check), generator tests.
- Overview skill: `packages/claude-plugin/skills/open-design/SKILL.md` is hand-written today, so the voice block is inserted by the same copy step that produces `packages/cli/assets/{claude,codex}-skills/open-design/SKILL.md` and `.agents/skills/open-design/SKILL.md`, or the source moves into `packages/content/local/` (see design.md).
- All twelve local prompts gain `{{voice}}` and a few reworded lines; every generated copy changes (VS Code prompt files, Claude skills, Codex skills, CLI assets).
- Affects developers' hosts too. The "match the user's words" rule keeps technical terms for people who use them.
