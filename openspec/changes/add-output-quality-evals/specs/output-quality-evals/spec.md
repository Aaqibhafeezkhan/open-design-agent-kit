## ADDED Requirements

### Requirement: Eval Brief Set

The repository SHALL contain a fixed set of eval briefs under `evals/briefs/`, one each for a poster, a landing page, a deck, a shop pack, a card set and a dashboard, plus at least two deliberately vague briefs, each giving the user's request as typed, the expected surface, answers to likely questions and the "must" notes a reviewer checks.

#### Scenario: Brief file
- **WHEN** a contributor opens `evals/briefs/gig-poster.yaml`
- **THEN** it has a request, an expected surface, answers and must notes

### Requirement: Eval Runner

`npm run evals` SHALL run the briefs headless through Claude Code with the local plugin in fresh temporary workspaces, answering questions from each brief's answers or "you pick", and SHALL support `--score-only <dir>` to score designs made elsewhere, `--only <id>` and `--repeat <n>` (default 2).

#### Scenario: Full run
- **WHEN** a contributor runs `npm run evals` with Claude Code installed
- **THEN** each brief runs twice and its designs are scored

#### Scenario: Designs made in Desktop
- **WHEN** a contributor runs the scorer with `--score-only` on a folder of registered designs
- **THEN** they get the same score table without any agent run

### Requirement: Eval Scores

Each design SHALL be scored with the kit's own check findings (errors and warnings by code), the critic's verdict and finding count when the critic is available, questions asked, assumptions stated, wall time and tool calls; each run SHALL also report how many distinct look signatures the set produced.

#### Scenario: Critic not installed
- **WHEN** the run happens before the critic exists
- **THEN** the critic columns show "n/a" and the other scores are reported

### Requirement: Committed Results

Each run SHALL append a dated section to `evals/RESULTS.md` with the kit version, model, mode and score table, and a contact sheet under 1 MB; full run folders SHALL stay out of git.

#### Scenario: Before and after
- **WHEN** a PR changes checks, skills or craft content
- **THEN** its description includes the RESULTS.md table from before and after the change
