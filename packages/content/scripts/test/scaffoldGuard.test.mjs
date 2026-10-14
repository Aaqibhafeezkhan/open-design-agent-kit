import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findUnreviewedScaffolds } from '../scaffoldGuard.mjs';

async function localWith(systems) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-scaffold-guard-'));
  for (const [id, css] of Object.entries(systems)) {
    await fs.mkdir(path.join(root, 'design-systems', id), { recursive: true });
    if (css !== null) await fs.writeFile(path.join(root, 'design-systems', id, 'tokens.css'), css);
  }
  return root;
}

test('reviewed tokens pass', async () => {
  const root = await localWith({ 'monzo-ios': ':root { --bg: #F6F7F9; }', application: null });
  assert.deepEqual(await findUnreviewedScaffolds(root), []);
});

test('a TODO comment or the scaffold header names the design system', async () => {
  const root = await localWith({
    'monzo-ios': ':root { --bg: #F6F7F9; /* TODO: confirm */ }',
    'spotify-ios': '/* design-systems/spotify-ios/tokens.css — SCAFFOLD, NOT FINAL. */\n:root {}',
    'calm-ios': ':root { --bg: #0B1E3F; }',
  });
  assert.deepEqual(await findUnreviewedScaffolds(root), ['monzo-ios', 'spotify-ios']);
});

test('no design-systems directory is fine', async () => {
  assert.deepEqual(await findUnreviewedScaffolds(await fs.mkdtemp(path.join(os.tmpdir(), 'od-scaffold-guard-'))), []);
});
