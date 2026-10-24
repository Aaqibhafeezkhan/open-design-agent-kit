## Why

The kit has unit tests for its code but no measure of what it produces. Every change in this batch (taste checks, state checks, the critic, brief questions, variety memory, the states and microcopy craft doc) claims to make designs better, and today the only way to tell is to eyeball a few runs. Without a fixed set of briefs scored the same way before and after, a change that adds noise or slows the agent down looks the same as one that helps. XIAS (MIT) keeps `evals/` with briefs and a committed `RESULTS.md`; we want the same habit, scored by our own checks. This is opportunity 10 in the UI/UX opportunities study (2026-10-24).

## What Changes

- **Six fixed briefs** in `evals/briefs/`, one per main surface: a gig poster, a SaaS landing page, a pitch deck, a shop pack, a card set and an analytics dashboard. Each is a YAML file with the user's request as typed, the surface and skill expected, the design system (or none, to exercise the recommender), and two or three "must" notes a reviewer can tick (for the dashboard: "has an empty state"). Two extra briefs are deliberately vague, to score whether the agent asks the right few questions.
- **A runner,** `scripts/evals/run.mjs` (repo root `npm run evals`), with two modes:
  - `--agent claude` runs each brief headless through Claude Code with the local plugin (`claude -p` with the brief, a fresh temp workspace, a fixed model and a turn cap), answering any questions with the brief's `answers` or "you pick";
  - `--score-only <dir>` scores designs someone already made, for hosts the runner can't drive (Desktop, Codex).
- **Scores per design, all from the kit's own tools:** check errors and warnings by code (`check_open_design_artifact` through the CLI `check` command), the critic's verdict and finding count (`add-design-critic`, when installed), questions asked, assumptions stated, wall time and tool calls, and across the set: distinct look signatures (`add-variety-memory`). No pixel diffing and no model-graded "beauty" score.
- **Results committed:** `evals/RESULTS.md` gets one dated section per run (kit version, model, mode, the score table, links to the saved check screenshots under `evals/runs/<date>/`, which are git-ignored except the contact sheet), so a PR can show "before" and "after".
- **Not in CI.** The repo has no PR CI and a run costs model tokens, so evals are run by hand, before and after a quality change, and a PR that changes checks, skills or craft is expected to include a before/after table.

## Capabilities

### New Capabilities
- `output-quality-evals`: the brief set and its format, the runner and its two modes, the score set, the results file and the before/after expectation.

### Modified Capabilities
None.

## Impact

- New: `evals/briefs/*.yaml`, `evals/RESULTS.md`, `evals/README.md`, `scripts/evals/run.mjs`, `scripts/evals/score.mjs`, a root `evals` npm script, `.gitignore` entries for `evals/runs/`.
- Uses the CLI `check` command (`packages/cli`) and reads manifests; no change to packages except possibly a `--json` flag on `check` if it lacks one.
- `docs/contributing/README.md`: when and how to run evals; PR template note if the repo adds one.
- First baseline run is part of this change, before `add-taste-checks` lands, so that change can report against it.
