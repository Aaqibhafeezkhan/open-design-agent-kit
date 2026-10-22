import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');

test('export writes a custom "-inspired" system in strict Claude format, keeping its suffix', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-ds-'));
  const dir = path.join(tmp, 'dating-com-inspired');
  await fs.mkdir(dir);
  await fs.writeFile(path.join(dir, 'DESIGN.md'), '# Design System Inspired by Dating.com\n\n> One bold red on white.\n\n## Color\n\nRed CTA.\n');
  await fs.writeFile(path.join(dir, 'tokens.css'), ':root {\n  --bg: #ffffff;\n  --fg: #222222;\n  --accent: #d5232f;\n  --accent-hover: color-mix(in oklab, var(--accent), white 15%);\n  --font-body: "Albert Sans", sans-serif;\n}\n');
  const out = path.join(tmp, 'out');
  const result = JSON.parse(execFileSync(tsx, ['scripts/claude-design-system.ts', 'export', dir, out], { cwd: root, encoding: 'utf8' }));
  assert.deepEqual(result.warnings, []);
  const index = JSON.parse(await fs.readFile(path.join(out, 'project/design-system.json'), 'utf8'));
  assert.equal(index.title, 'Dating.com-inspired');
  const readme = await fs.readFile(path.join(out, 'project/README.md'), 'utf8');
  assert.match(readme, /^> One bold red on white\./);
  const tokens = await fs.readFile(path.join(out, 'project/tokens.json'), 'utf8');
  assert.doesNotMatch(tokens, /color-mix\(/);
});
