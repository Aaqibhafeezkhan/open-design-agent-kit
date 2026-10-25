import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSurfaces, isStubEntry, STUB_MARKER } from '../surfaces.mjs';

async function catalog(surfaces, entries = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-surfaces-'));
  for (const [rel, body] of Object.entries(entries)) {
    await fs.mkdir(path.join(root, path.dirname(rel)), { recursive: true });
    await fs.writeFile(path.join(root, rel), body);
  }
  await fs.writeFile(path.join(root, 'surfaces.json'), JSON.stringify({ surfaces }));
  return root;
}
const ready = (id, entries, extra = {}) => ({ id, label: id, description: 'd', status: 'ready', entries, ...extra });
const real = '---\nname: x\n---\nA real workflow.';
const stub = `---\nname: y\n---\n${STUB_MARKER} in OpenDesign.`;

test('a valid catalog has no problems; planned surfaces are not checked', async () => {
  const root = await catalog([ready('poster', ['poster-hero'], { prompt: 'open-design-poster' }), { id: '3d', label: '3D', description: 'd', status: 'planned', entries: ['nope'] }], {
    'skills/poster-hero/SKILL.md': real,
    'prompts/poster.md': '---\nname: open-design-poster\ndescription: d\n---\n{{brief}}',
  });
  assert.deepEqual(await checkSurfaces(root), []);
});

test('a missing entry, a stub entry and an unknown prompt are each reported by name', async () => {
  const root = await catalog([ready('animation', ['remotion', 'ghost'], { prompt: 'open-design-nope' })], { 'skills/remotion/SKILL.md': stub });
  const problems = await checkSurfaces(root);
  assert.ok(problems.some((p) => p.includes('animation') && p.includes('"remotion"') && p.includes('stub')), problems.join('\n'));
  assert.ok(problems.some((p) => p.includes('"ghost"') && p.includes("doesn't exist")));
  assert.ok(problems.some((p) => p.includes('open-design-nope')));
});

test('a stub skill paired with a real example is not a stub entry', async () => {
  const root = await catalog([ready('x', ['pair'])], { 'skills/pair/SKILL.md': stub, 'examples/pair/SKILL.md': real, 'examples/pair/example.html': '<p>' });
  assert.deepEqual(await checkSurfaces(root), []);
  assert.equal(await isStubEntry(path.join(root, 'skills', 'pair')), true);
  assert.equal(await isStubEntry(path.join(root, 'examples', 'pair')), false);
});

test('the shipped catalog passes against the shipped assets', async () => {
  const assets = path.join(import.meta.dirname, '..', '..', 'assets', 'open-design');
  assert.deepEqual(await checkSurfaces(assets), []);
});

test('goals must lead to ready surfaces', async () => {
  const { checkGoals } = await import('../surfaces.mjs');
  const surfaces = [{ id: 'poster', status: 'ready' }, { id: 'diagram', status: 'planned' }];
  assert.deepEqual(checkGoals({ surfaces, goals: [{ id: 'promote-event', label: 'Promote an event', description: 'x', surfaces: ['poster'] }] }), []);
  const problems = checkGoals({
    surfaces,
    goals: [
      { id: 'a', label: 'A', description: 'x', surfaces: ['diagram', 'nope'] },
      { id: 'a', label: 'A', description: 'x', surfaces: [] },
    ],
  });
  assert.ok(problems.some((p) => p.includes('"diagram"')));
  assert.ok(problems.some((p) => p.includes('"nope"')));
  assert.ok(problems.some((p) => p.includes('id used twice')));
  assert.ok(problems.some((p) => p.includes('at least one surface')));
});

test('structured questions need options, a default among them and what they change; plain strings only warn', async () => {
  const { checkSurfaceQuestions, plainQuestionWarnings } = await import('../surfaces.mjs');
  const good = { id: 'where', text: 'Where will it be seen?', options: ['Printed', 'On screens', 'Both'], default: 'Both', changes: 'size, bleed and file type' };
  assert.deepEqual(checkSurfaceQuestions({ id: 'poster', questions: [good, 'A plain question?'] }), []);
  const problems = checkSurfaceQuestions({ id: 'poster', questions: [{ ...good, options: ['Only'], default: 'Nope', changes: '' }] });
  assert.ok(problems.some((p) => p.includes('two to four options')));
  assert.ok(problems.some((p) => p.includes('default must be one of its options')));
  assert.ok(problems.some((p) => p.includes('"changes"')));
  assert.deepEqual(plainQuestionWarnings({ surfaces: [{ id: 'poster', questions: [good, 'A plain question?'] }] }).length, 1);
});

test('every shipped surface question is structured', async () => {
  const { plainQuestionWarnings } = await import('../surfaces.mjs');
  const catalog = JSON.parse(await fs.readFile(path.join(import.meta.dirname, '..', '..', 'local', 'surfaces.json'), 'utf8'));
  assert.deepEqual(plainQuestionWarnings(catalog), []);
});
