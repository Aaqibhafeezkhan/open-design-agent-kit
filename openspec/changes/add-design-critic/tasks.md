## 1. Skill and agent

- [ ] 1.1 `packages/claude-plugin/skills/open-design-critique/SKILL.md`: rubric, verdicts, five-finding limit, inline fallback wording, plain-words rule
- [ ] 1.2 `packages/claude-plugin/agents/design-critic.md` (read-only tools), plugin manifest entry if needed
- [ ] 1.3 Step 6 of `skills/open-design/SKILL.md`: critic round, `rework` stop, 3D unchanged; one line naming the rubric areas
- [ ] 1.4 Regenerate CLI, Codex and `.agents` copies; drift checks pass

## 2. Record

- [ ] 2.1 `metadata.critique` type, validation, 4 KB limit; `critique` input on `register_open_design_artifact` (MCP, VS Code)
- [ ] 2.2 Preview Checks panel shows the last verdict and findings

## 3. Docs and trial

- [ ] 3.1 `docs/guides/generate-a-design.md` (Second opinion), `docs/reference/artifact-manifest.md`, `docs/reference/tools.md`
- [ ] 3.2 Trial on five bundled briefs in Claude Code and Desktop Chat: note verdicts, whether fixes helped, and token cost
