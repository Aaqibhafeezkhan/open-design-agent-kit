## Context: where scheduled work runs today (researched 21 Oct 2026)

| Surface | Runs on | Machine on / app open? | Kit available? | Browser for checks and captures | Local files | Min interval | Missed runs | Approval during run |
|---|---|---|---|---|---|---|---|---|
| Claude Code cloud scheduled task (formerly routine): claude.ai/code/routines, `/schedule`, Desktop Code tab "Scheduled" | Anthropic cloud, or a self-hosted environment | No | Only through the repo: committed `.mcp.json` and `.claude/skills` (what `open-design-agent-kit init --tool claude` writes), plus claude.ai connectors. Locally added MCP servers are not carried over | None installed by default. The image has Node with `chromedriver`, but no Chrome. A setup script runs as root on Ubuntu 24.04 and is cached | No: a fresh clone each run | 1 hour | Not documented. Runs on the hour can start minutes late | None. Runs are autonomous |
| Desktop local scheduled task: Code tab, Routines, New, Local | User's machine | Yes: app open and computer awake | Yes: config-file MCP servers, connectors, plugins | Yes, if Chrome, Edge or Chromium is installed | Yes, in the chosen folder, optionally in a worktree | 1 minute | One catch-up run for the most recent missed time in the last 7 days | Per-task permission mode. "Always allow" from a first Run now carries over |
| Cowork scheduled task | Cloud by default since 6 Oct 2026. Tasks that were local before that stay local | No, for cloud tasks | Skills and plugins load, but "local connectors and plugins that use local MCP servers work only in the desktop app", so the kit's stdio server is absent from a cloud task | Driving a browser needs the desktop app open | Only connected folders, and only while the desktop app is open | Hourly, daily, weekdays, weekly, manual | Not documented | n/a |
| `/loop` and the cron tools | User's machine, inside the open session | Yes, with the session open | Inherits the session | Inherits the session | Yes | 1 minute | No catch-up. Recurring tasks expire after 7 days | Inherits the session |
| GitHub Actions `schedule` (already in `docs/automation/social-pipeline.md`) | CI runner | No | The CLI (`open-design-agent-kit export`) | Runner images usually ship Chrome | The repo checkout | Cron | n/a | n/a |

Other facts that shape the design:

- A cloud scheduled run "can publish a new artifact without asking". It republishes an existing artifact without asking only when the artifact is private or only shared without auto-follow, belongs to the user's organization, and the publish doesn't force over a newer version or declare runtime capabilities. "When a scheduled task's job is to keep a page current, give it an artifact you already published." The kit's `claude-artifact` provider already records the URL (`publish_open_design_artifact` `published`).
- "The fired prompt … can't act as approval or consent for actions during the run." Unattended runs therefore can't satisfy the kit's existing "explicit yes" gate for public publishing (artifact-publishing).
- A cloud run starts from the default branch and pushes to `claude/`-prefixed branches "unless your prompt directs" otherwise. State written by one run is gone in the next unless it is merged or the next run checks out a known branch.
- The default cloud network allowlist includes `registry.npmjs.org`, `storage.googleapis.com` (where Chrome for Testing downloads come from), `fonts.googleapis.com` and `fonts.gstatic.com`. `npx` of the kit's MCP server and the browser download in `findBrowser`'s hint should therefore work in a cloud setup script. **UNVERIFIED:** the headless shell also needs system libraries (`libnss3` and others) through `apt`, and nobody has run it end to end yet.
- Ubuntu 24.04's `apt install chromium` installs a snap, which doesn't run in containers. `findBrowser` already tries snap paths last, and already searches `~/.cache/puppeteer` and `~/.cache/ms-playwright` (`packages/core/src/export/browserDiscovery.ts`).
- This change's own cloud session (a Claude Code cloud container) had no `google-chrome`, `chromium` or Playwright cache, which matches the docs.

Sources:
- Cloud scheduled tasks: https://code.claude.com/docs/en/routines (also served at https://code.claude.com/docs/en/web-scheduled-tasks)
- Desktop local scheduled tasks: https://code.claude.com/docs/en/desktop-scheduled-tasks
- `/loop` and the comparison table: https://code.claude.com/docs/en/scheduled-tasks
- Cloud environments (installed tools, setup scripts, allowlist): https://code.claude.com/docs/en/cloud-environments
- Cowork scheduled tasks: https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- Cowork in the cloud since 6 Oct 2026: https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile
- Install landscape for plugins and MCP per surface: `/mnt/project-files/desktop-research/install-landscape.md` sections 3c and 5
- Desktop Chat spike, which showed the plugin server runs on the user's machine with Chrome: `/mnt/project-files/cowork-spike/FINDINGS.md`

## Goals / Non-Goals

Goals:
- One job definition that runs the same on the cloud and Desktop surfaces.
- Re-running a period is safe.
- No run silently produces less than it claims.

Non-goals:
- A scheduler of our own. The surfaces above already schedule.
- Wrapping connectors. Data pulls and deliveries go through whatever connectors the task includes, written as prose in the job.
- Cowork support. That waits for a remote Open Design connector (install-landscape §6).
- Auto-posting to social networks.

## Decisions

### D1. The job lives in the workspace; the scheduler holds one line
The job is `.open-design/jobs/<id>.job.md`: frontmatter followed by a prose brief. This matches the shape Desktop already uses on disk (`~/.claude/scheduled-tasks/<name>/SKILL.md`), and it gets versioned with the outputs. The prompt saved in the scheduler is only "Run the Open Design job <path>", so switching surfaces, or editing the brief, means changing one file.

Alternative considered: put everything in the scheduler prompt. Rejected because the prompt isn't versioned, isn't shared between surfaces, and can't be validated by a tool.

### D2. Two tools, and the agent does the design
`start_open_design_job_run` and `finish_open_design_job_run` handle the bookkeeping that a model gets wrong when it is unattended: the period key in the job's timezone, the skip decision, capability detection, browserless checks and the run record. Design work stays in the existing recipe skills and tools: `prepare_open_design_brief`, `register_open_design_artifact` with `sources`, `export_open_design_artifact`, `publish_open_design_artifact`.

Alternative considered: one `run_open_design_job` tool that designs headlessly. Rejected because the server has no model, and generation is the agent's job everywhere else in the kit.

### D3. Period key and run log for idempotency
The period key comes from `period` (`day` gives `2026-10-21`, `week` gives the ISO week `2026-W43`, `month` gives `2026-10`) in the job's `timezone`. The run log is `.open-design/jobs/<id>.runs.json`, newest first and capped at 52 entries. `start` returns `skip` when a `completed` run already exists for the period, unless the sources changed since that run (when `rebuildOnSourceChange`, the default, is on) or `runNow: true` is passed. This covers three cases:
- the Desktop catch-up run that fires late ("a task scheduled for 9am might run at 11pm");
- a manual Run now just after a scheduled run;
- a retried cloud run.

### D4. Update or series; one preview link per job
- `mode: update` overwrites the same entry each period, which suits a living weekly report.
- `mode: series` writes `.open-design/<job>/{period}/…` and keeps history, which suits weekly social batches.

Either way the job records one `preview.url`, written by the supervised setup run, and every run republishes that artifact. That matches the docs' advice to give a scheduled task an artifact you already published, and stays inside the no-prompt republish rule. Older periods stay in the workspace and git history, not in extra artifacts.

### D5. Cloud state goes on a fixed state branch
Cloud runs start from a fresh clone, so the run log and outputs would be lost. The job's `cloud.stateBranch` (default `claude/open-design-job-<id>`) is checked out at the start when it exists and pushed at the end. The job file itself, including `preview.url`, stays on the default branch, where the setup run committed it. Opening a PR from the state branch is optional (`deliver: pr`).

Alternative considered: commit to the default branch. Rejected because it bypasses review and branch protection.

### D6. Headless-safe checks; captures recorded as skipped
Captures (PNG, JPEG, PDF, PPTX, video) and `check_open_design_artifact` need Chrome. In the cloud there usually is none.
- **Without a browser:** the run still produces the HTML, the `standalone` export and the private preview, because those exports are browserless. `finish` then runs browserless checks:
  - local files the entry references are missing;
  - `data-od-field` elements are empty;
  - placeholder text such as `{{`, `TODO` or "Lorem ipsum" is left over;
  - the source number check from registration;
  - the artifact size limits.

  Each capture missing for lack of a browser is recorded as `skipped: no-browser`, and the summary says so.
- **`checks: required`:** with no browser, the run ends `needs-review` and does no shared delivery (commit or PR, or connector posts). The private preview still updates.
- **Getting a browser in the cloud:** the guide documents a setup script that installs `chrome-headless-shell` into `~/.cache/puppeteer`, the path `findBrowser` already searches and the one its own hint suggests. This is unverified (see Context).

Alternative considered: download a browser at run time. Rejected because export deliberately never downloads one (social-post-export D1).

### D7. Unattended runs stay private
The fired prompt isn't consent, and the kit already requires an explicit yes for public publishing. So job runs:
- use `claude-artifact` (private) and workspace or git outputs only;
- never call public providers;
- never post to social networks.

Connector deliveries are allowed only when the job names them and the task includes the connector. Examples are a Slack message linking the private preview, or a file uploaded to the person's own Drive. `deliver` entries that need a public publish are rejected by the validator.

### D8. Surfaces supported
- **Cloud scheduled tasks** are the default recommendation for reliability, with the browser caveat.
- **Desktop local tasks** are recommended when the job needs local files, captures out of the box, or the plugin.
- **`/loop`** is documented only for trying out a job.
- **Cowork** is documented as unsupported for now.
- **GitHub Actions** is documented for export-only refreshes, where the design is fixed and only the data rows change, through bulk export.

## Risks / Trade-offs

- Cloud scheduled tasks are a research preview. Limits, names and API may change, so the guide links the docs rather than copying them.
- A wrong `timezone`, or a cloud run's late start, can push a run across a period boundary. The validator requires `timezone`, and the guide suggests scheduling a few minutes past the hour, mid-period.
- Prose connector instructions are only as reliable as the connector. Snapshotting the data to a file before designing keeps every number traceable, and a failed pull ends the run `failed` before any design work.
- The state branch can drift from the default branch. The guide suggests merging the state branch's PR periodically, or using `deliver: pr`.

## Open Questions

- Does the `chrome-headless-shell` setup script run in the default cloud image without extra `apt` packages? Verify before writing the guide's script as fact.
- Do plugins synced from the account load in Claude Code cloud sessions? That would remove the need for `init` in the repo. The install-landscape doc marks this UNCONFIRMED.
- Should a later remote Open Design connector make Cowork scheduled tasks work? That is tracked separately.
