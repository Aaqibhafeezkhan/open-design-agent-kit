## Why

People want the same design every week: a report deck rebuilt from this week's numbers, a batch of social posts for next week, a refreshed one-pager. Claude can already run work on a schedule in four places, each with different limits (research and sources in `design.md`):

- **Claude Code cloud scheduled tasks** (formerly routines; claude.ai/code/routines, `/schedule`). They run in Anthropic's cloud from a fresh clone, can reach the repo's `.mcp.json`, `.claude/skills` and claude.ai connectors, and have no browser installed by default. They run at most once an hour and need no approval during a run.
- **Desktop local scheduled tasks** (Claude Desktop Code tab). They run on the user's machine with local files, the plugin and Chrome, but only while the app is open and the computer is awake. A missed run gets one catch-up run.
- **Cowork scheduled tasks.** These run in the cloud by default since 6 Oct 2026. Local MCP servers work only through the desktop app, so the kit's plugin server is not there.
- **`/loop`.** It runs only inside an open session, and its recurring tasks expire after 7 days.

Today the kit has no notion of a job. Each run starts from a prompt and makes a new design, and nothing stops a catch-up run or a "Run now" from making a second copy. The run has to work out on its own whether a browser exists. When it doesn't, `check_open_design_artifact` and every capture export return `no-browser` (`packages/core/src/export/checkArtifact.ts`, `exportArtifact.ts`), and nobody is told that the PNGs were skipped. The pieces a job needs already exist:

- source hashing and `staleSources` (deck-from-source, `register_open_design_artifact` `sources`);
- browserless `standalone`/`site`/`email`/`paste` exports (`packages/core/src/export/exportArtifact.ts`);
- a recorded publish target that later publishes update in place (`publish_open_design_artifact` `published`, `provider: "claude-artifact"`);
- data-row bulk export (bulk-export) and the scripted CLI export (`docs/automation/social-pipeline.md`).

## What Changes

- **Job file.** A job is `.open-design/jobs/<job-id>.job.md`: YAML frontmatter followed by the brief as the body. The frontmatter names the recipe (a skill id such as `open-design-deck-from-source` or `open-design-social-post`), the design system, the sources (workspace files, or connector instructions plus a snapshot path), the period (`day`, `week`, `month`) and timezone, a fixed target entry path (or a per-period path template), the outputs (export formats), the delivery (`claude-artifact` preview, commit or PR, connector hand-off in prose), the check policy (`required` or `best-effort`), and, for cloud runs, a state branch. The job lives with the work and is versioned there. The scheduler only holds a one-line prompt: "Run the Open Design job `.open-design/jobs/weekly-kpis.job.md`."
- **Two MCP tools** (MCP only; VS Code has no scheduler):
  - `start_open_design_job_run({ jobPath, runNow? })` validates the job and computes the period key (e.g. `2026-W43` in the job's timezone). It reads the run log `.open-design/jobs/<job-id>.runs.json` and returns `skip` with a reason when this period already has a completed run and the sources haven't changed. Otherwise it returns a `runId`, the target's state (exists, manifest, `staleSources`, recorded preview URL), the run's capabilities (`browser`, `cloud` from `CLAUDE_CODE_REMOTE`) and the ordered steps for the agent.
  - `finish_open_design_job_run({ jobPath, runId, status, outputs, notes })` runs the browserless checks and records the run. Outputs it couldn't make, such as captures without a browser, are recorded as skipped with the reason. The result carries a one-paragraph run summary for the session or a connector message.
- **Idempotent re-runs.** A job either updates one artifact in place each period (`mode: update`) or makes one artifact per period at a templated path (`mode: series`). Both republish the job's single recorded Claude artifact, so the link stays the same. The period key and the run log turn a Desktop catch-up run, a duplicate "Run now" or a retried cloud run into a no-op, unless `runNow: true` forces a rebuild.
- **Headless-safe checks.** When no browser is found, the run still updates the HTML, makes the standalone file and publishes the private preview. Captures are recorded as skipped rather than failed. `finish_open_design_job_run` runs browserless checks:
  - missing local files;
  - unfilled `data-od-field` elements and leftover placeholder text;
  - the source number check;
  - the artifact size limits.

  With `checks: required` and no browser, the run ends `needs-review` and does no shared delivery (commits and connector posts); the private preview is still published.
- **Unattended runs never go public.** The fired prompt can't stand in for the person's consent, so scheduled runs stay private. They don't use public publish providers and don't post to social networks. Social batches end as files plus a private preview for a person to post.
- **Recipe skill `open-design-recurring`** (new local prompt `packages/content/local/prompts/recurring.md`, rendered for Claude Code, Codex, VS Code and the MCP prompt). It has two parts:
  - **Set up:** agree the brief and sources, write the job file, do one supervised run, and record the preview URL in the job. It then tells the person how to schedule the job on the surface they use, with the exact prompt, and for Desktop it says to click Run now once and approve each tool.
  - **Run:** follow the steps `start_open_design_job_run` returns.
- **Docs.** A new guide, `docs/guides/recurring-jobs.md`, covers each surface:
  - cloud scheduled task: `init --tool claude` so the repo has `.mcp.json` and skills, the state branch, and a setup script for a headless browser;
  - Desktop local task;
  - Cowork, which is not supported until a remote connector exists;
  - `/loop` for trying a job out;
  - GitHub Actions for export-only refreshes.

  `docs/reference/tools.md` gains the two tools.

## Capabilities

### New Capabilities
- `recurring-design-jobs`: the job file, the start and finish tools, the period key and run log, update and series modes, browserless checks and skipped captures, private-only delivery in unattended runs, the recipe skill, and the per-surface guide.

### Modified Capabilities
None. Existing tools keep their behaviour: `check_open_design_artifact` still returns `no-browser`, and the job tools report it.

## Impact

- `packages/core/src/jobs/` (new): a job parser and validator (frontmatter schema), the period key, the run log read and write, and browserless checks that reuse `findBrowser` (`packages/core/src/export/browserDiscovery.ts`), the source hashing behind `staleSources`, and the standalone size check used by the `claude-artifact` provider.
- `packages/mcp-server/src/index.ts`, `src/tools.ts`: the two tool definitions and handlers.
- `packages/content/local/prompts/recurring.md`: generated skills in `packages/claude-plugin/skills/open-design-recurring/`, the CLI-installed Claude and Codex skills, the VS Code prompt and the MCP prompt.
- `docs/guides/recurring-jobs.md`, `docs/guides/README.md`, `docs/reference/tools.md`, and a link from `docs/automation/social-pipeline.md`.
- Release: cloud runs get the tools only from a published MCP server (the repo's `.mcp.json` runs `npx`), and Desktop runs need the plugin pin bumped past 0.1.8.
