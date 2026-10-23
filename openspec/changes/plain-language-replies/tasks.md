## 1. Voice block

- [ ] 1.1 Write `packages/content/local/voice.md`: the five rules and the glossary from the proposal, about 15 lines
- [ ] 1.2 `localPrompts.mjs`: substitute `{{voice}}` (after claude-only handling, so the block reads the same on every host); unit test
- [ ] 1.3 `check-content-sync.mjs`: fail when a local prompt or the overview skill's source lacks `{{voice}}`; test

## 2. Prompts and skill

- [ ] 2.1 Add `{{voice}}` to all twelve local prompts, near the top
- [ ] 2.2 Overview skill: generated voice region between markers, filled by the copy step; regenerate the three copies
- [ ] 2.3 Reword lines that ask the agent to use internal terms (for example "say which design system you used" in `new.md` and the overview skill; "mention that they can click **Comment**" stays, since it names a button)
- [ ] 2.4 Regenerate every host's copies; content drift check passes

## 3. Verification

- [ ] 3.1 Desktop Chat: "make a flyer for our seed swap" through to a PDF; the replies contain no tool names, `.open-design` paths, "artifact", "register" or "design system", explain the print edge once, and end with a next step
- [ ] 3.2 Claude Code: a user who says "register the artifact and export it" gets those words back and clickable paths
- [ ] 3.3 Read two generated copies (Claude skill, VS Code prompt) and confirm the voice block is identical
