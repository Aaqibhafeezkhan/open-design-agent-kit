## 1. Briefs

- [ ] 1.1 Six surface briefs and two vague briefs in `evals/briefs/`, with `evals/README.md` describing the format

## 2. Runner and scorer

- [ ] 2.1 `scripts/evals/run.mjs`: fresh temp workspace per brief, `claude -p` with the local plugin, fixed model and turn cap, scripted answers, `--only`, `--repeat`
- [ ] 2.2 `scripts/evals/score.mjs`: CLI `check` (add `--json` if missing), manifest reads (critique, brief), question and assumption counts from the transcript, signatures; `--score-only`
- [ ] 2.3 Contact sheet (reuse the campaign sheet composer), `RESULTS.md` append, `.gitignore` for `evals/runs/`, root `evals` npm script

## 3. Baseline and docs

- [ ] 3.1 Baseline run on current main; commit the first `RESULTS.md` section
- [ ] 3.2 `docs/contributing/README.md`: when to run evals and the before/after expectation
