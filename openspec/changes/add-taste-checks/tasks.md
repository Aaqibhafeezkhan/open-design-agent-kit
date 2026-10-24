## 1. Detectors

- [ ] 1.1 Shared candidate-box walk in `collectPreflight` (capped at 2,000 elements) and the `data-od-allow` ancestor lookup
- [ ] 1.2 `slop-glow` (gradient stops and blurred glows, indigo accent list)
- [ ] 1.3 `card-row` and `uniform-surface`
- [ ] 1.4 `type-scale`, with the design system's display tokens passed in from `checkArtifact.ts`
- [ ] 1.5 `intent` (destructive words list, `data-intent`, identical primary/secondary)
- [ ] 1.6 Good and bad fixtures per code under `packages/core/src/test/fixtures/taste/`, tests in `pageScripts.test.ts`; `NOTICE.md` in the fixture folder and `docs/contributing/upstream-ports.md`

## 2. Tuning

- [ ] 2.1 Run the check over every bundled remixable example; tune thresholds until good examples show at most one taste warning; record counts in the PR

## 3. Guidance and docs

- [ ] 3.1 Skill step 6 (taste warnings rule); regenerate CLI, Codex and `.agents` copies
- [ ] 3.2 "Checked in this kit" note in `composeInstructions.ts` when `anti-ai-slop` is included; test
- [ ] 3.3 `docs/reference/tools.md` check codes; `docs/guides/generate-a-design.md`
