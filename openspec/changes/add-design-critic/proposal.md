## Why

The agent that built a design is the one that decides it is done. Step 6 of the open-design skill has it fix check errors and glance at its own screenshots, and it stops after two rounds. Self-review is weak: the builder sees what it meant, not what it made. The kit already knows a fresh look helps, because 3D designs get a critique "from a subagent where your host has one" with the `3d-object` scorecard, but pages, decks, posters and cards don't. XIAS (MIT) runs a separate `design-critic` agent through `/critique`, with a fixed rubric and a verdict, before work counts as finished. Non-technical Desktop users (see the non-technical personas study) can't judge "is this good?" themselves and would value a plain-words second opinion. This is opportunity 3 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **A critique skill,** `open-design-critique` in `packages/claude-plugin/skills/`, with CLI, Codex and `.agents` copies. It reviews one registered artifact from its latest check run (screenshots plus findings), the brief recorded in the manifest (`metadata.brief` from `add-brief-questions`, else the title and skill id), and the active design system's `DESIGN.md`, against a fixed rubric: purpose and hierarchy, typography, colour and contrast, layout and rhythm, copy, states, and fit to the design system. It returns one verdict, `ship`, `polish` or `rework`, and at most five findings, each with where, what is wrong, and the change to make.
- **A critic agent for hosts that have subagents:** `packages/claude-plugin/agents/design-critic.md`, read-only (it reads the check run and source; it does not edit), so the critique comes from a fresh context. Hosts without subagents run the same rubric inline, and the skill says the critique is a self-review there.
- **Step 6 gains a critic round** for every artifact kind: after the checks are clean (or the two fix rounds are spent), get a critique; on `polish` fix the findings once and re-check; on `rework` tell the user what is wrong and ask before rebuilding; on `ship` say it's done. One critique round by default (3D keeps its three). The user can ask for "another opinion" at any time.
- **Plain words on Desktop.** In Desktop Chat (non-technical hosts), the agent reports the verdict as "I had a second look: …" with the top one or two findings in everyday words, never the rubric names.
- **Critic notes on the manifest:** `metadata.critique` (`verdict`, `findings[]` with `area` and `fix`, `checkRunId`, `at`), so the preview's Checks panel and later edits can see the last opinion, and `add-output-quality-evals` can score runs.
- **The builder knows the rubric.** Step 6 names the rubric's areas in one line, so the builder knows what the critic will look for. (The craft docs under `packages/content/assets/` are synced from upstream and not edited here.)

## Capabilities

### New Capabilities
- `design-critique`: the critique skill and rubric, the verdicts and finding limit, the critic agent, the critic round in the check step, plain-words reporting, and the manifest record.

### Modified Capabilities
None. The 3D critique requirement in `artifact-visual-check` stays as it is; this change adds a critic round for the other kinds alongside it.

## Impact

- New: `packages/claude-plugin/skills/open-design-critique/SKILL.md`, `packages/claude-plugin/agents/design-critic.md` (and the plugin manifest entry if the host needs one).
- `packages/claude-plugin/skills/open-design/SKILL.md` step 6, and generated copies (`npm run generate-skills` for claude-plugin and codex, `copy-skill-content`); the skills drift check.
- `packages/core/src/workspace` manifest types and validation for `metadata.critique` (≤ 4 KB, inside the 16 KB metadata limit); written by `register_open_design_artifact` when passed `critique`.
- `packages/vscode` preview Checks panel shows the last verdict (small).
- Docs: `docs/guides/generate-a-design.md` ("Second opinion"), `docs/reference/artifact-manifest.md`, `docs/reference/tools.md` (`critique` input).
- Depends on nothing; works better after `add-taste-checks` and `add-state-accessibility-checks`, whose findings the critic reads.
