import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveCheckRun } from '../../export/checkHistory';
import { buildCritiqueInput, critiqueSummary, MAX_CRITIQUE_BYTES, prepareCritiqueRecord, readCritique, validateCritique, withCritique } from '../../workspace/critique';

const ENTRY = '.open-design/landing/index.html';
const AT = new Date('2026-10-24T12:00:00Z');

describe('design critique record', () => {
  it('normalizes a valid critique, defaulting at and checkRunId', () => {
    const result = validateCritique(
      { verdict: 'polish', findings: [{ area: 'copy', where: ' hero button ', problem: 'Says "Submit"', fix: 'Say "Start free trial"' }] },
      { now: AT, checkRunId: 'run-1' },
    );
    assert.ok(result.ok);
    assert.deepStrictEqual(result.record, {
      verdict: 'polish',
      findings: [{ area: 'copy', where: 'hero button', problem: 'Says "Submit"', fix: 'Say "Start free trial"' }],
      at: AT.toISOString(),
      checkRunId: 'run-1',
    });
  });

  it('rejects unknown verdicts and areas, missing fixes and more than five findings', () => {
    const finding = { area: 'typography', fix: 'Use the display size' };
    const cases: Array<[unknown, RegExp]> = [
      [{ verdict: 'great', findings: [] }, /verdict must be one of ship, polish, rework/],
      [{ verdict: 'polish', findings: [{ area: 'vibes', fix: 'x' }] }, /area must be one of/],
      [{ verdict: 'polish', findings: [{ area: 'copy' }] }, /fix is required/],
      [{ verdict: 'polish', findings: Array(6).fill(finding) }, /at most 5/],
      ['ship', /must be an object/],
    ];
    for (const [input, error] of cases) {
      const result = validateCritique(input);
      assert.ok(!result.ok, JSON.stringify(input));
      assert.match(result.error, error);
    }
  });

  it('rejects a critique over 4 KB, naming the limit', () => {
    const long = 'x'.repeat(1000);
    const result = validateCritique({ verdict: 'polish', findings: Array(5).fill({ area: 'layout-rhythm', problem: long, fix: long }) });
    assert.ok(!result.ok);
    assert.match(result.error, new RegExp(`limit is ${MAX_CRITIQUE_BYTES} bytes \\(4 KB\\)`));
  });

  it('keeps only the latest critique on the metadata, beside other fields', () => {
    const first = validateCritique({ verdict: 'polish', findings: [] }, { now: AT });
    const second = validateCritique({ verdict: 'ship', findings: [] }, { now: AT });
    assert.ok(first.ok && second.ok);
    const metadata = withCritique(withCritique({ format: 'a3' }, first.record), second.record);
    assert.deepStrictEqual(metadata, { format: 'a3', critique: second.record });
    assert.deepStrictEqual(readCritique({ metadata }), second.record);
    assert.strictEqual(readCritique({ metadata: { critique: { verdict: 'meh' } } }), undefined);
  });

  it('summarizes a critique for the preview', () => {
    const fix = { area: 'copy' as const, fix: 'x' };
    assert.strictEqual(critiqueSummary({ verdict: 'polish', findings: [fix, fix], at: '' }), 'Second look: polish, 2 fixes');
    assert.strictEqual(critiqueSummary({ verdict: 'rework', findings: [fix], at: '' }), 'Second look: rework, 1 fix');
    assert.strictEqual(critiqueSummary({ verdict: 'ship', findings: [], at: '' }), 'Second look: ship');
  });

  it('points the record at the latest check run and gathers the critique input', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-critique-'));
    const empty = await buildCritiqueInput({ workspaceRoot: root, outputDir: '.open-design', entryPath: ENTRY, manifest: null });
    assert.strictEqual(empty.checkRun, undefined);

    const saved = await saveCheckRun(
      root,
      '.open-design',
      ENTRY,
      { mode: 'page', findings: [{ severity: 'warning', check: 'contrast', message: 'low contrast' }], images: [{ label: 'desktop', data: Buffer.from('jpg'), width: 1, height: 1 }] },
      AT,
    );
    const prepared = await prepareCritiqueRecord(root, '.open-design', ENTRY, { verdict: 'ship', findings: [] });
    assert.ok(prepared.ok);
    assert.strictEqual(prepared.record.checkRunId, saved.run.id);

    const manifest = { kind: 'html', title: 'Landing', sourceSkillId: 'od:prototype:landing', designSystemId: 'clean', metadata: { brief: { goal: 'sign-ups' }, critique: prepared.record } };
    const input = await buildCritiqueInput({ workspaceRoot: root, outputDir: '.open-design', entryPath: ENTRY, manifest, designSystem: { id: 'clean', name: 'Clean', designMd: '# Clean' } });
    assert.strictEqual(input.title, 'Landing');
    assert.deepStrictEqual(input.brief, { goal: 'sign-ups' });
    assert.strictEqual(input.designSystem?.designMd, '# Clean');
    assert.strictEqual(input.checkRun?.id, saved.run.id);
    assert.deepStrictEqual(input.checkRun?.images, [{ label: 'desktop', path: `${saved.dir}/01-desktop.jpg` }]);
    assert.strictEqual(input.checkRun?.findings[0].check, 'contrast');
    assert.deepStrictEqual(input.lastCritique, prepared.record);
  });
});
