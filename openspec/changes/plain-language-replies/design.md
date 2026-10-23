## Context

User-facing wording comes from three places: the overview skill (hand-written, four copies), twelve local prompts rendered per host by `localPrompts.mjs`, and text inside tool results that tells the agent what to say. The first two are where the agent learns its vocabulary for a session. Tool result text is out of scope here except where the welcome change already rewrites it.

## Goals / Non-Goals

**Goals**
- Every prompt and the overview skill carry the same short voice rules, kept in one file.
- A non-technical user never sees tool names, internal file names or kit jargon unless they used those words first.
- A developer who talks about artifacts and tokens still gets those words back.

**Non-Goals**
- A separate "beginner mode" that changes what the kit does. This only changes how the agent talks.
- Translating anything.

## Decisions

**1. One `voice.md` inserted by placeholder, not copied by hand.** The prompts already go through `localPrompts.mjs`, which substitutes `{{brief}}`; `{{voice}}` uses the same mechanism. Alternatives: a reference file the skill tells the agent to read (agents skip optional reads), or pasting the block into each prompt (drifts).

**2. The overview skill gets the block through its copy step.** It is hand-written in `packages/claude-plugin/skills/open-design/SKILL.md` and copied to three places. Two options:
- (a) keep it there and have the copy step substitute `{{voice}}` in the plugin's own file too, which means the plugin file carries the placeholder resolved in place (generated region between markers, like `<!-- generated:curated-entry -->`);
- (b) move its source into `packages/content/local/` and generate all four copies.
Recommended: (a), a marked generated region, because it's the smaller change and matches how curated-entry blocks are already generated.

**3. "Match the user's words" is the first rule.** It's what keeps the change safe on developer hosts: in Claude Code the user's own messages are full of paths and technical terms, so the agent keeps using them.

**4. Keep the block short.** About 15 lines including the glossary table, so it costs little in every prompt. Longer guidance (examples of good and bad replies) goes in the docs for contributors, not in the prompts.

**5. Raw paths only where they're clickable.** Claude Code and the Desktop Code tab open a clicked path in the Browser pane (Desktop guide), so paths stay there. Desktop Chat gets a description plus, once, the folder's path so the user can find it.

## Risks / Trade-offs

- **Prompt length.** Fifteen more lines in every prompt. Acceptable; it replaces scattered "tell the user…" lines that some prompts already have.
- **The agent may over-correct** and avoid useful precision ("A4" is fine; "print edge" may confuse a print shop). The glossary keeps sizes and formats as they are and only replaces kit jargon.
- **Generated diff is large.** Every copy of every prompt changes once.

## Open Questions

- Should the same glossary apply to the MCP App labels (inline preview buttons, campaign sheet)? Most already read plainly ("Ask Claude to apply", "Fix this piece"), so it's left out.
