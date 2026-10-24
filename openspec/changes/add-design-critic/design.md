## Context

Step 6 of `packages/claude-plugin/skills/open-design/SKILL.md`: call `check_open_design_artifact`, fix every error, look at the screenshots, re-check, at most two fix rounds. For 3D, the check result asks for the `3d-object` scorecard from a subagent and allows three critique rounds. Each check run is saved under `.open-design/.checks/<run>/` with screenshots and findings. Manifests (`<entry>.artifact.json`) carry a free `metadata` object up to 16 KB.

## Goals / Non-Goals

**Goals:** a fresh-context opinion on every design before "done"; a short, actionable result (verdict plus at most five fixes); the same rubric on every host; cost bounded to one extra model pass by default.

**Non-Goals:** a numeric score shown to users; blocking "done" on the critic; a critic that edits files; multiple critics or a debate; critiquing source code quality.

## Decisions

### A skill plus an optional agent, not a tool

The critique is language work on images the host model can already see, so a server tool would only pass files around. A skill keeps the rubric in one place for every host (Claude Code, Codex, CLI, Desktop). Where the host supports plugin agents (Claude Code), `agents/design-critic.md` runs it in a fresh context with read-only tools, which is the point of a critic. Elsewhere the skill runs inline and says so; a self-review with a fixed rubric is still better than an eyeball.

### The rubric

| Area | Looks for |
|---|---|
| Purpose and hierarchy | Can you tell in five seconds what this is and what to do? One clear first read. |
| Typography | Display scale used, line length, too many sizes or weights |
| Colour and contrast | Accent used for meaning, not decoration; check findings on contrast |
| Layout and rhythm | Spacing on the system's steps, alignment, crowded or dead areas |
| Copy | Filler, invented numbers, vague buttons ("Submit", "Learn more") |
| States | Empty, loading, error present where the design has data (see `craft/state-coverage.md`) |
| Fit | Matches `DESIGN.md` and the brief, not a generic look |

Verdicts: `ship` (no finding worth a round), `polish` (one round of listed fixes), `rework` (the direction is wrong: wrong audience, wrong surface, unreadable). At most five findings, ordered by impact, so the builder isn't handed a list it will half-do.

### One round by default

Each round costs a model pass and a check. One critic round after the fix rounds keeps the total small; `rework` stops and asks the user because it means rebuilding, which is the user's call. 3D keeps its existing three rounds.

### What the critic sees

The latest check run's screenshots (both viewports, or the slide sheet), its findings including taste and state codes, the brief from `metadata.brief` (or, before `add-brief-questions` ships, the title and skill id) from the manifest, and `DESIGN.md`. It does not see the builder's conversation, by design.

### Record on the manifest

`metadata.critique` is the last critique only (not history), validated, ≤ 4 KB. It lets the preview show "Second look: polish, 2 fixes" and lets evals compare runs without re-running the critic.

## Risks / Trade-offs

- **Critic agreeing with itself** on hosts without subagents. Mitigation: the inline path reads only the saved run, and the skill tells the agent to judge the screenshots, not its intent; the docs say it's weaker.
- **Taste disagreements with the user.** The critic follows the brief and design system; if the user asked for the look, the finding is dropped. The skill says the user's brief wins.
- **Token cost** of images. One run's screenshots are already capped by `maxImages`; the critic reuses them, it doesn't re-render.

## Open Questions

- Should Desktop users be able to turn the second look off? Proposed: yes, by saying so; remembered in `.open-design/config.json` as `critique: false`.
