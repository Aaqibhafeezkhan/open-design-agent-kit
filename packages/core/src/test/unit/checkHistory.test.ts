import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CHECK_RUNS_KEPT, checkRunSlug, formatSavedCheckRun, listCheckRuns, onCheckRunSaved, readCheckRunImage, saveCheckRun } from '../../export/checkHistory';

const ENTRY = '.open-design/landing/index.html';
const image = { label: 'desktop 1/2', data: Buffer.from('jpeg'), width: 10, height: 10 };

describe('check history', () => {
  it('names an entry\'s runs after its path below the output folder', () => {
    assert.strictEqual(checkRunSlug(ENTRY), 'landing-index.html');
    assert.strictEqual(checkRunSlug('designs/a b.html', 'designs'), 'a-b.html');
  });

  it('saves images and findings, reports the previous run and the change in counts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-checks-'));
    const first = await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [{ severity: 'error', check: 'a', message: 'x' }, { severity: 'error', check: 'b', message: 'y' }], images: [image] }, new Date('2026-10-19T10:00:00Z'));
    assert.strictEqual(first.previous, undefined);
    assert.deepStrictEqual(first.run.images.map((i) => i.file), ['01-desktop-1-2.jpg']);
    const second = await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [], images: [image] }, new Date('2026-10-19T10:05:00Z'));
    assert.strictEqual(second.previous?.run.id, first.run.id);
    const text = formatSavedCheckRun(second).join('\n');
    assert.match(text, /Screenshots saved for the user: \.open-design\/\.checks\/landing-index\.html\/2026-10-19T10-05-00\/01-desktop-1-2\.jpg/);
    assert.match(text, /errors 2 → 0, warnings 0 → 0/);
    assert.strictEqual(String(await readCheckRunImage(root, '.open-design', ENTRY, second.run.id, '01-desktop-1-2.jpg')), 'jpeg');
    assert.strictEqual(await readCheckRunImage(root, '.open-design', ENTRY, second.run.id, '../run.json'), undefined);
  });

  it('gives two runs in the same second their own folders', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-checks-'));
    const at = new Date('2026-10-19T10:00:00Z');
    const a = await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [], images: [] }, at);
    const b = await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [], images: [] }, at);
    assert.notStrictEqual(a.run.id, b.run.id);
    assert.strictEqual((await listCheckRuns(root, '.open-design', ENTRY))[0].id, b.run.id);
  });

  it(`keeps only the newest ${CHECK_RUNS_KEPT} runs and notifies listeners`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-checks-'));
    const seen: string[] = [];
    const off = onCheckRunSaved((s) => seen.push(s.run.id));
    try {
      for (let i = 0; i < CHECK_RUNS_KEPT + 1; i++) await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [], images: [image] }, new Date(Date.UTC(2026, 9, 19, 10, i)));
    } finally {
      off();
    }
    const runs = await listCheckRuns(root, '.open-design', ENTRY);
    assert.strictEqual(runs.length, CHECK_RUNS_KEPT);
    assert.strictEqual(runs[runs.length - 1].id, '2026-10-19T10-01-00');
    assert.strictEqual(seen.length, CHECK_RUNS_KEPT + 1);
  });
});
