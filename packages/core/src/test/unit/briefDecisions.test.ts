import * as assert from 'node:assert';
import { composeDecisionsSection, composeRegisterBriefNote, validateBriefDecisions, validateRegisteredBrief, withBriefMetadata } from '../../generation/briefDecisions';
import { composeInstructions } from '../../generation/composeInstructions';

describe('brief answers and assumptions (openspec add-brief-questions)', () => {
  it('keeps answers and assumptions, dropping empty ones', () => {
    const r = validateBriefDecisions({ where: 'Printed', size: ' ' }, ['dark theme', '  ', 'one sign-up button']);
    assert.ok(r.ok);
    assert.deepStrictEqual(r.decisions, { answers: { where: 'Printed' }, assumptions: ['dark theme', 'one sign-up button'] });
    assert.deepStrictEqual(validateBriefDecisions(undefined, undefined), { ok: true, decisions: {} });
  });

  it('refuses more than six assumptions, long ones and the wrong shapes', () => {
    const seven = validateBriefDecisions(undefined, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    assert.ok(!seven.ok && /at most 6/.test(seven.error));
    const long = validateBriefDecisions(undefined, ['x'.repeat(161)]);
    assert.ok(!long.ok && /160 characters/.test(long.error));
    assert.ok(!validateBriefDecisions(['x'], undefined).ok);
    assert.ok(!validateBriefDecisions(undefined, 'dark').ok);
    const big = validateBriefDecisions(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`q${i}`, 'y'.repeat(80)])), undefined);
    assert.ok(!big.ok && /2 KB/.test(big.error));
  });

  it('checks the registered brief and keeps the latest one in metadata', () => {
    const r = validateRegisteredBrief({ text: 'A jazz night poster', assumptions: ['dark theme'] });
    assert.ok(r.ok);
    assert.deepStrictEqual(r.brief, { text: 'A jazz night poster', assumptions: ['dark theme'] });
    const tooLong = validateRegisteredBrief({ text: 'x'.repeat(501) });
    assert.ok(!tooLong.ok && /500/.test(tooLong.error));
    assert.deepStrictEqual(validateRegisteredBrief({}), { ok: true, brief: undefined });
    assert.deepStrictEqual(withBriefMetadata({ format: 'a3', brief: { text: 'old' } }, { text: 'new' }), { format: 'a3', brief: { text: 'new' } });
    assert.deepStrictEqual(withBriefMetadata({ brief: { text: 'old' } }, undefined), { brief: { text: 'old' } });
  });

  it('writes a "Build to these decisions" section and asks for the brief at registration', () => {
    assert.strictEqual(composeDecisionsSection({}), '');
    const instructions = composeInstructions({
      skillName: 'poster',
      skillBody: 'Body.',
      brief: 'A poster for our event',
      suggestedEntryPath: '.open-design/p/p.html',
      decisions: { answers: { where: 'Printed' }, assumptions: ['dark theme'] },
    });
    assert.match(instructions, /## Build to these decisions[\s\S]*- where: Printed\n- Assumed: dark theme/);
    assert.ok(instructions.indexOf('## Build to these decisions') < instructions.indexOf('## Active skill'));
    assert.match(instructions, /pass `brief` with the request in one line \(`text`\) and the same `answers` and `assumptions`/);
    assert.match(instructions, /list the assumptions in one sentence/);
    const plain = composeInstructions({ skillName: 'poster', skillBody: 'Body.', brief: 'x', suggestedEntryPath: 'a.html' });
    assert.ok(!plain.includes('Build to these decisions'));
    assert.match(composeRegisterBriefNote(undefined), /pass `brief` with the request in one line/);
  });
});
