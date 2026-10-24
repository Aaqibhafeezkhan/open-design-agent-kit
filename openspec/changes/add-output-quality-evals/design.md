## Context

Tests run only in `release.yml`; there is no PR CI. The CLI has a `check` command that runs `check_open_design_artifact`'s logic and saves runs under `.open-design/.checks/`. Claude Code can run headless (`claude -p`) with a plugin directory. Other hosts (Desktop Chat, Codex) can't be driven from a script in this repo.

## Goals / Non-Goals

**Goals:** a cheap, repeatable before/after for quality changes; scores that come from the kit's own checks so they mean the same thing as what users see; results a reviewer can read in the PR.

**Non-Goals:** a leaderboard across models; human preference studies; running on every commit; a model-graded aesthetic score (the critic's verdict is reported, not treated as ground truth); evaluating every skill (six surfaces cover the main paths).

## Decisions

### Briefs as typed by a user

Each brief's `request` is what a person would type ("Make a poster for our jazz night at The Blue Room on 4 May"), not a tuned prompt, so the evals exercise surface routing, questions and the recommender too. `answers` holds what the "user" says if asked; anything else gets "you pick".

```yaml
id: gig-poster
request: "Make a poster for our jazz night at The Blue Room on 4 May"
expect: { surface: poster }
answers: { where: "Both" }
must: ["Date, time and venue readable from 3 m", "One clear focal image or type"]
```

### Scores from the kit's checks, not a new judge

Check errors and warnings by code are deterministic given the HTML, so differences between runs come from the agent, not the scorer. The critic verdict is useful signal but a model's opinion, so it's a column, not the headline. "Must" notes are ticked by a human reviewer in `RESULTS.md` when they look at the contact sheet.

### Variance

Model output varies run to run. Each brief runs twice by default (`--repeat 2`), and the table shows both, so a one-off is visible. A change counts as an improvement when error totals drop on both repeats and no brief gets worse by more than one error.

### What is committed

`RESULTS.md` (tables and notes) and one contact sheet PNG per run (the six designs side by side, under 1 MB). Full runs stay local under `evals/runs/` to keep the repo small.

## Risks / Trade-offs

- **Cost.** Eight briefs × two repeats is sixteen agent runs. Mitigation: `--only <id>` and `--repeat 1` for quick looks; the full run only before and after a quality change.
- **Headless runs differ from Desktop.** The `--score-only` mode lets someone score Desktop-made designs with the same table.
- **Briefs going stale** as the kit grows. Reviewed when a surface is added.

## Open Questions

- Should the runner also drive Codex headless (`codex exec`) once the Codex package supports it? Proposed: later.
