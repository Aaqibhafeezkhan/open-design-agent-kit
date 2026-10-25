import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkCraftRequires, checkSupersededQuotes } from '../craftRequires.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-craft-requires-'));
  await fs.mkdir(path.join(root, 'design-templates', 'dashboard'), { recursive: true });
  await fs.writeFile(path.join(root, 'design-templates', 'dashboard', 'SKILL.md'), '---\nname: dashboard\n---\n');
  await fs.mkdir(path.join(root, 'craft'), { recursive: true });
  await fs.writeFile(path.join(root, 'craft', 'state-coverage.md'), '# State\n');
  await fs.writeFile(path.join(root, 'craft', 'form-validation.md'), '| `submitting` | Disable submit, announce status |\n');
  return root;
}

test('a map naming real ids passes, comments ignored', async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, 'craft-requires.json'), JSON.stringify({ $comment: 'x', dashboard: ['state-coverage'] }));
  assert.deepEqual(await checkCraftRequires(root), []);
});

test('an absent map passes', async () => {
  assert.deepEqual(await checkCraftRequires(await fixture()), []);
});

test('unknown skill and craft ids are named', async () => {
  const root = await fixture();
  await fs.writeFile(path.join(root, 'craft-requires.json'), JSON.stringify({ dashbord: ['state-coverage'], dashboard: ['ux-writng'] }));
  assert.deepEqual(await checkCraftRequires(root), ['dashbord: unknown skill or template id', 'dashboard: unknown craft id "ux-writng"']);
});

test('a superseded quote must still be in the upstream doc', async () => {
  const assets = await fixture();
  const local = await fs.mkdtemp(path.join(os.tmpdir(), 'od-craft-local-'));
  await fs.mkdir(path.join(local, 'craft'));
  await fs.writeFile(path.join(local, 'craft', 'action-states.md'), 'Supersedes `form-validation.md`: "Disable submit, announce status".\n');
  assert.deepEqual(await checkSupersededQuotes(local, assets), []);
  await fs.writeFile(path.join(assets, 'craft', 'form-validation.md'), '| `submitting` | Keep submit focusable |\n');
  const problems = await checkSupersededQuotes(local, assets);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /form-validation\.md no longer says "Disable submit, announce status"/);
});
