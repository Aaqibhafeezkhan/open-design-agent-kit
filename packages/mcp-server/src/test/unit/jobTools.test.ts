// Recurring design jobs end to end (openspec add-recurring-design-jobs): the
// real server over stdio, driven by a scripted MCP client through first run,
// skip, source change, runNow, series paths and an unknown run id.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { periodKey, writeArtifactManifest } from '@feimacode/open-design-agent-kit-core';

const DECK_JOB = '.open-design/jobs/weekly-kpis.job.md';
const DECK_TARGET = '.open-design/weekly-kpis/weekly-kpis.html';
const SOCIAL_JOB = '.open-design/jobs/social-week.job.md';

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-mcp-jobs-'));
  await fs.mkdir(path.join(root, '.open-design/jobs'), { recursive: true });
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  await fs.writeFile(path.join(root, 'data/kpis.csv'), 'metric,value\nsignups,4210\n');
  await fs.writeFile(
    path.join(root, DECK_JOB),
    [
      '---',
      'id: weekly-kpis',
      'title: Weekly KPIs',
      'recipe: open-design-deck-from-source',
      'period: week',
      'timezone: Europe/Berlin',
      'mode: update',
      `target: ${DECK_TARGET}`,
      'outputs: [standalone, pdf]',
      'sources: [data/kpis.csv]',
      '---',
      '',
      'A one-slide KPI summary from data/kpis.csv.',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(root, SOCIAL_JOB),
    [
      '---',
      'id: social-week',
      'title: Social week',
      'recipe: open-design-social-post',
      'period: week',
      'timezone: Europe/Berlin',
      'mode: series',
      'target: .open-design/social-week/{period}/posts.html',
      'outputs: [png]',
      '---',
      '',
      'Five LinkedIn posts from CHANGELOG.md.',
      '',
    ].join('\n'),
  );
  return root;
}

async function connect(root: string): Promise<Client> {
  const client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: {} });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--require', 'tsx/cjs', path.join(__dirname, '..', '..', 'index.ts')],
      // No browser and not a cloud session, whatever this machine has.
      env: { ...process.env, OPEN_DESIGN_WORKSPACE_ROOT: root, OPEN_DESIGN_PREVIEW: 'off', OPEN_DESIGN_BROWSER_PATH: path.join(root, 'no-browser'), CLAUDE_CODE_REMOTE: 'false' } as Record<string, string>,
      stderr: 'ignore',
    }),
  );
  return client;
}

const text = (result: unknown): string =>
  ((result as CallToolResult).content ?? [])
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

const runIdOf = (out: string): string => {
  const id = out.match(/"runId": "([^"]+)"/)?.[1];
  assert.ok(id, out);
  return id;
};

async function writeEntry(root: string, entry: string, body: string): Promise<void> {
  await fs.mkdir(path.join(root, path.dirname(entry)), { recursive: true });
  await fs.writeFile(path.join(root, entry), `<!doctype html><h1 data-od-field="headline">${body}</h1>`);
  await writeArtifactManifest({ workspaceRoot: root, entryPath: entry, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Job output' } });
}

describe('recurring job tools over MCP', function () {
  this.timeout(60000);
  let root: string;
  let client: Client;

  before(async () => {
    root = await workspace();
    client = await connect(root);
  });
  after(() => client?.close());

  it('lists both job tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('start_open_design_job_run'));
    assert.ok(names.includes('finish_open_design_job_run'));
  });

  it('runs the first time, then skips, rebuilds on a source change, and rebuilds with runNow', async () => {
    const week = periodKey('week', 'Europe/Berlin');
    const first = text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: DECK_JOB } }));
    assert.match(first, new RegExp(`for ${week} started`));
    assert.match(first, /"browser": false/);
    assert.doesNotMatch(first, /check_open_design_artifact/);
    assert.match(first, /format "standalone"/);
    assert.doesNotMatch(first, /format "pdf"/);
    const runId = runIdOf(first);

    await writeEntry(root, DECK_TARGET, 'Signups 4,210');
    const finished = text(
      await client.callTool({ name: 'finish_open_design_job_run', arguments: { jobPath: DECK_JOB, runId, status: 'completed', outputs: { written: [DECK_TARGET] } } }),
    );
    assert.match(finished, /recorded as completed/);
    assert.match(finished, /pdf \(no browser in this run\)/);
    assert.match(finished, /"skipped": "?no-browser|"reason": "no-browser"/);

    const skipped = text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: DECK_JOB } }));
    assert.match(skipped, /^skip: /);
    assert.match(skipped, new RegExp(runId));

    await fs.writeFile(path.join(root, 'data/kpis.csv'), 'metric,value\nsignups,4388\n');
    const changed = text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: DECK_JOB } }));
    assert.match(changed, /"changedSources": \[\s*"data\/kpis.csv"\s*\]/);
    const changedRun = runIdOf(changed);
    await writeEntry(root, DECK_TARGET, 'Signups 4,388');
    await client.callTool({ name: 'finish_open_design_job_run', arguments: { jobPath: DECK_JOB, runId: changedRun, status: 'completed', outputs: { written: [DECK_TARGET] } } });
    assert.match(text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: DECK_JOB } })), /^skip: /);

    const forced = text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: DECK_JOB, runNow: true } }));
    assert.match(forced, /"forced": true/);

    const log = JSON.parse(await fs.readFile(path.join(root, '.open-design/jobs/weekly-kpis.runs.json'), 'utf8'));
    assert.deepStrictEqual(
      log.runs.map((r: { status: string }) => r.status),
      ['started', 'completed', 'completed'],
    );
  });

  it('resolves series targets to this period', async () => {
    const week = periodKey('week', 'Europe/Berlin');
    const started = text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: SOCIAL_JOB } }));
    const entry = `.open-design/social-week/${week}/posts.html`;
    assert.match(started, new RegExp(`"entryPath": "${entry}"`));
    await writeEntry(root, entry, 'Shipped: recurring jobs');
    const finished = text(
      await client.callTool({ name: 'finish_open_design_job_run', arguments: { jobPath: SOCIAL_JOB, runId: runIdOf(started), status: 'completed', outputs: { written: [entry] } } }),
    );
    assert.match(finished, /recorded as completed/);
  });

  it('refuses an unknown run id and writes nothing', async () => {
    const before = await fs.readFile(path.join(root, '.open-design/jobs/social-week.runs.json'), 'utf8');
    const result = await client.callTool({ name: 'finish_open_design_job_run', arguments: { jobPath: SOCIAL_JOB, runId: 'not-a-run', status: 'completed' } });
    assert.match(text(result), /No run not-a-run was started/);
    assert.strictEqual(await fs.readFile(path.join(root, '.open-design/jobs/social-week.runs.json'), 'utf8'), before);
  });

  it('refuses an invalid job by field', async () => {
    await fs.writeFile(path.join(root, '.open-design/jobs/bad.job.md'), '---\nid: bad\ntitle: Bad\nrecipe: x\nperiod: week\nmode: series\ntarget: a.html\noutputs: []\ndeliver: [netlify]\n---\n\nBrief.\n');
    const out = text(await client.callTool({ name: 'start_open_design_job_run', arguments: { jobPath: '.open-design/jobs/bad.job.md' } }));
    assert.match(out, /- timezone: /);
    assert.match(out, /- target: /);
    assert.match(out, /- deliver: /);
  });
});
