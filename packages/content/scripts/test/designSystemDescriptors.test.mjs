import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDescriptors } from '../designSystemDescriptors.mjs';

const assetsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'open-design');

async function fixture(systems, dirs) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-desc-'));
  for (const d of dirs) await fs.mkdir(path.join(root, 'design-systems', d), { recursive: true });
  const vocabulary = { moods: ['calm'], industries: ['saas'], surfaces: ['web'], kinds: ['brand', 'genre'] };
  await fs.writeFile(path.join(root, 'design-system-descriptors.json'), JSON.stringify({ vocabulary, systems }));
  return root;
}

test('the shipped descriptors cover every bundled design system', async () => {
  assert.deepEqual(await checkDescriptors(assetsRoot), []);
});

test('reports a missing row, an orphan row and an unknown value', async () => {
  const root = await fixture({ b: { kind: 'genre', moods: ['loud'], industries: ['saas'], surfaces: ['web'] }, gone: { kind: 'brand', moods: ['calm'], industries: ['saas'], surfaces: ['web'] } }, ['a', 'b']);
  const problems = await checkDescriptors(root);
  assert.ok(problems.includes('a: no descriptor row'));
  assert.ok(problems.includes("gone: descriptor for a design system that doesn't exist"));
  assert.ok(problems.some((p) => p.startsWith('b: moods value "loud"')));
});
