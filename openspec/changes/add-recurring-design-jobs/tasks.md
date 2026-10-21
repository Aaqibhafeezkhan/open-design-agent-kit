## 1. Core

- [x] 1.1 `packages/core/src/jobs/jobFile.ts`: parse frontmatter and body; validate fields with per-field errors, including the public-deliver refusal
- [x] 1.2 Period key per `day`/`week`/`month` in an IANA timezone (ISO week numbering), with unit tests for year and DST boundaries
- [x] 1.3 Run log read/write (`.open-design/jobs/<id>.runs.json`, newest first, capped at 52) and the skip decision (completed run, source hash change, `runNow`)
- [x] 1.4 Browserless checks: missing local refs, empty `data-od-field`, placeholder text, reuse of the registration number check and the claude-artifact size check
- [x] 1.5 Capability probe: `findBrowser` result and `CLAUDE_CODE_REMOTE`

## 2. MCP tools

- [x] 2.1 `start_open_design_job_run`: definition, handler, ordered steps (with and without a browser, cloud state branch, preview republish)
- [x] 2.2 `finish_open_design_job_run`: checks, status rules (`needs-review` for required checks without a browser), run record, summary text
- [x] 2.3 Scripted MCP client tests: first run, skip on re-run, source change, `runNow`, series paths, unknown run id

## 3. Content

- [x] 3.1 `packages/content/local/prompts/recurring.md` (set-up and run modes, `model_trigger` for "every week", "on a schedule", "recurring")
- [x] 3.2 Regenerate the Claude plugin, CLI-installed Claude and Codex skills, VS Code prompt and MCP prompt; drift checks pass
- [x] 3.3 Overview skill line: when asked for a recurring design, use `open-design-recurring`

## 4. Docs

- [x] 4.1 `docs/guides/recurring-jobs.md` with the per-surface sections and an example job for a weekly deck and a weekly social batch
- [x] 4.2 `docs/reference/tools.md` entries; guides index; link from `docs/automation/social-pipeline.md`

## 5. Verification

- [ ] 5.1 Claude Code cloud scheduled task on a test repo after `init --tool claude`: run, skip on Run now, state branch carries the log (needs the MCP server release)
- [ ] 5.2 Cloud setup script installing `chrome-headless-shell`: confirm `findBrowser` finds it and a PDF export works, or document the needed `apt` packages
- [ ] 5.3 Claude Desktop local scheduled task with the plugin: first Run now approvals, catch-up run is skipped (needs the plugin pin bumped past 0.1.8)
