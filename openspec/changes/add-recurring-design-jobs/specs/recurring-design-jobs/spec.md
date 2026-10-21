## ADDED Requirements

### Requirement: Job File
A recurring design job SHALL be defined in `.open-design/jobs/<job-id>.job.md`: YAML frontmatter followed by the brief as the Markdown body. The required fields SHALL be `id`, `title`, `recipe` (a skill id), `period` (`day`, `week` or `month`), `timezone` (an IANA name), `mode` (`update` or `series`), `target` (an entry path, or a `{period}` template in `series` mode) and `outputs` (export formats, possibly empty).

#### Scenario: Valid weekly deck job
- **WHEN** a job file names `recipe: open-design-deck-from-source`, `period: week`, `timezone: Europe/Berlin`, `mode: update`, a target entry and `outputs: [pdf]`
- **THEN** `start_open_design_job_run` SHALL accept it

#### Scenario: Missing timezone
- **WHEN** a job file has no `timezone`
- **THEN** the job tools SHALL refuse it with an error naming `timezone`

#### Scenario: Series target without a period placeholder
- **WHEN** a job has `mode: series` and a `target` without `{period}`
- **THEN** the job tools SHALL refuse it with an error naming `target`

### Requirement: Optional Job Fields
A job file MAY set these fields:
- `designSystemId`;
- `sources`: workspace paths, or connector instructions each with a `snapshot` workspace path;
- `deliver`;
- `checks`: `required` or `best-effort`, default `best-effort`;
- `rebuildOnSourceChange`: default true;
- `preview.url`;
- `cloud.stateBranch`.

The job tools SHALL validate every field and return all problems by field name.

#### Scenario: Connector source needs a snapshot path
- **WHEN** a source is a connector instruction with no `snapshot` path
- **THEN** the job tools SHALL refuse the job with an error naming `sources`

### Requirement: Start Job Run Tool
The MCP server SHALL provide `start_open_design_job_run` taking `jobPath` and optional `runNow`. It SHALL return either `skip` with a reason, or a new `runId` with:
- the period key;
- the resolved target entry path;
- the target's state: whether it exists, its manifest, `staleSources` and `preview.url`;
- the run's capabilities;
- the ordered steps for the agent.

The VS Code extension SHALL NOT offer the tool.

#### Scenario: First run of the period
- **WHEN** the run log has no completed run for the current period
- **THEN** the tool SHALL return a new `runId` with the target's state and the steps

### Requirement: Period Key
The job tools SHALL compute the period key from `period` in the job's `timezone`: `YYYY-MM-DD` for a day, the ISO week `YYYY-Www` for a week, and `YYYY-MM` for a month.

#### Scenario: Weekly job on 21 Oct 2026
- **WHEN** a weekly job with `timezone: Europe/Berlin` is started on 21 Oct 2026
- **THEN** the period key SHALL be `2026-W43`

### Requirement: Run Capabilities
`start_open_design_job_run` SHALL report two capabilities:
- `browser`: true when an export browser is found the same way export finds one;
- `cloud`: true when `CLAUDE_CODE_REMOTE` is `true`.

When `browser` is false, the returned steps SHALL leave out the visual check and the capture outputs.

#### Scenario: Cloud run without a browser
- **WHEN** the job is started in a cloud session with no Chrome, Edge or Chromium installed
- **THEN** the result SHALL report `browser: false` and `cloud: true`, and its steps SHALL leave out the visual check and captures

### Requirement: Run Log
The job tools SHALL record each run in `.open-design/jobs/<job-id>.runs.json`, keeping run id, period key, status, source hashes, outputs and time for each run.

#### Scenario: Run recorded
- **WHEN** a run finishes
- **THEN** the run log SHALL contain its record with the period key and status

### Requirement: Idempotent Re-Runs
`start_open_design_job_run` SHALL return `skip` when a `completed` run exists for the current period key. Two exceptions SHALL apply: `runNow` is true, or `rebuildOnSourceChange` is on and a source's hash differs from the hash recorded for that run.

#### Scenario: Catch-up run after a completed run
- **WHEN** a Desktop catch-up run starts the job in the same ISO week as a completed run and the sources are unchanged
- **THEN** the tool SHALL return `skip` with a reason that names the completed run

#### Scenario: Source changed mid-period
- **WHEN** the week's run completed and `data/kpis.csv` has since changed
- **THEN** the tool SHALL return a new `runId` and list the source as changed

#### Scenario: Forced re-run
- **WHEN** the agent passes `runNow: true` after this week's run completed
- **THEN** the tool SHALL return a new `runId`

### Requirement: Update and Series Modes
In `update` mode, every run SHALL write the same target entry. In `series` mode, each period SHALL write the target with `{period}` replaced by the period key.

#### Scenario: Series mode keeps history
- **WHEN** a `series` job with target `.open-design/social-week/{period}/posts.html` runs in weeks `2026-W43` and `2026-W44`
- **THEN** both `2026-W43/posts.html` and `2026-W44/posts.html` SHALL exist afterwards

### Requirement: Finish Job Run Tool
The MCP server SHALL provide `finish_open_design_job_run` taking:
- `jobPath`;
- `runId`;
- `status`: `completed`, `needs-review` or `failed`;
- `outputs`: paths written, and outputs not made with a reason;
- optional `notes`.

It SHALL run the browserless checks, write the run record and return a short run summary.

#### Scenario: Unknown run id
- **WHEN** `runId` does not match a run started for this job
- **THEN** the tool SHALL refuse with an error and write nothing

### Requirement: Run Status and Summary
`finish_open_design_job_run` SHALL record `completed` only when no browserless check reports an error. When the job has `checks: required` and the run had no browser, it SHALL record `needs-review`. The summary SHALL name the period, the outputs made, the outputs skipped with their reasons, the check findings and the preview link.

#### Scenario: Summary names skipped captures
- **WHEN** a run without a browser finishes with the PDF output reported as not made for `no-browser`
- **THEN** the run record SHALL list the PDF as `skipped: no-browser` and the summary SHALL say so

#### Scenario: Required checks without a browser
- **WHEN** a job with `checks: required` finishes a run whose start reported `browser: false`
- **THEN** the run SHALL be recorded as `needs-review`, not `completed`

### Requirement: Browserless Job Checks
The job checks SHALL run without a browser and report:
- local files that the entry or its supporting files reference but that are missing;
- empty `data-od-field` elements;
- leftover placeholder text (`{{`, `TODO`, "Lorem ipsum");
- numbers on the page found in no recorded source (the registration number check);
- for a `preview` delivery, a standalone file over the artifact viewer's limits.

#### Scenario: Missing image
- **WHEN** the target entry references `img/chart.png` and that file does not exist
- **THEN** `finish_open_design_job_run` SHALL report an error finding naming `img/chart.png`

#### Scenario: Unfilled field
- **WHEN** an element with `data-od-field="headline"` is empty
- **THEN** the checks SHALL report a finding naming the `headline` field

### Requirement: Private-Only Delivery in Unattended Runs
Job runs SHALL deliver only to these targets:
- the job's private Claude artifact preview;
- workspace files;
- a commit or pull request on the job's state branch;
- connector actions that the job names in `deliver`.

The validator SHALL refuse `deliver` entries that need a public publish provider or that post to a social network.

#### Scenario: Public deliver refused
- **WHEN** a job's `deliver` names `netlify` or "post to X"
- **THEN** the job tools SHALL refuse the job with an error naming `deliver`

### Requirement: Preview Republished In Place
When the job records `preview.url`, the steps SHALL republish that artifact through `publish_open_design_artifact` with `provider: "claude-artifact"` rather than create a new artifact.

#### Scenario: Preview republished to the same link
- **WHEN** a job with a recorded `preview.url` completes a run in a host with an Artifact tool
- **THEN** the steps SHALL republish to that URL

### Requirement: Cloud State Branch
For a run whose start reports `cloud: true`, the steps SHALL tell the agent:
- to check out the job's state branch, when it exists, before reading the run log. The branch is `cloud.stateBranch`, default `claude/open-design-job-<job-id>`;
- to commit the run log and outputs to that branch at the end;
- to open a pull request only when `deliver` includes `pr`.

#### Scenario: Second cloud run sees the first run's log
- **WHEN** a cloud run completes week `2026-W43` and pushes the state branch, and another cloud run starts the same week from a fresh clone
- **THEN** after checking out the state branch, `start_open_design_job_run` SHALL return `skip`

### Requirement: Recurring Job Recipe Skill
The kit SHALL ship a recipe prompt `recurring` (skill `open-design-recurring`) through the local content overlay, rendered for Claude Code, Codex, VS Code and as an MCP prompt. In run mode the skill SHALL follow the steps that `start_open_design_job_run` returns, and stop when the result is `skip`.

#### Scenario: Scheduled run that is already done
- **WHEN** a scheduled run invokes the skill and `start_open_design_job_run` returns `skip`
- **THEN** the agent SHALL report the reason in one line and make no changes

### Requirement: Recurring Job Set-Up
In set-up mode, the `open-design-recurring` skill SHALL have the agent:
- agree the brief, sources and outputs with the person;
- write the job file;
- do one supervised run;
- record the preview link in `preview.url`;
- give scheduling instructions for the person's surface, with the exact one-line prompt to save.

#### Scenario: Set up a weekly social batch
- **WHEN** the person asks for "five LinkedIn posts every Monday from our changelog"
- **THEN** the agent SHALL write a `series` job with recipe `open-design-social-post`, run it once, and give the one-line scheduler prompt with instructions for their surface

### Requirement: Recurring Jobs Guide
The docs SHALL include `docs/guides/recurring-jobs.md`, linked from the guides index and from `docs/automation/social-pipeline.md`. It SHALL have one section per surface:
- Claude Code cloud scheduled tasks;
- Claude Desktop local scheduled tasks;
- `/loop`;
- Cowork scheduled tasks, documented as unsupported for now;
- GitHub Actions, for export-only refreshes.

Each section SHALL say whether runs have a browser and SHALL link the official docs.

#### Scenario: Reader on a cloud scheduled task
- **WHEN** a reader opens the cloud section
- **THEN** it SHALL say to run `open-design-agent-kit init --tool claude` in the repo, that no browser is installed by default, that PNG, PDF and PPTX outputs are recorded as skipped without one, and how to add one in a setup script

#### Scenario: Reader on a Desktop local task
- **WHEN** a reader opens the Desktop section
- **THEN** it SHALL say that the app must be open and the computer awake, that a missed run gets one catch-up run, and to click Run now once and approve each tool

### Requirement: Job Tools Reference
`docs/reference/tools.md` SHALL document `start_open_design_job_run` and `finish_open_design_job_run` as tools available only through MCP.

#### Scenario: Tools reference
- **WHEN** a reader opens `docs/reference/tools.md`
- **THEN** it SHALL list both job tools with their arguments
