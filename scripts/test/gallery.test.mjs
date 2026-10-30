import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const pilot = JSON.parse(await fs.readFile(path.join(root, 'gallery', 'pilot.json'), 'utf8'));

test('the pilot builds a hub and a spoke per item, with hand-off prompts and downloads', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-'));
  execFileSync(tsx, [path.join(root, 'scripts', 'build-gallery.ts'), '--out', out, '--no-thumbs'], { cwd: root, stdio: 'pipe' });

  const dsHub = await fs.readFile(path.join(out, 'design-systems', 'index.html'), 'utf8');
  assert.equal(dsHub.match(/<li class="card/g)?.length, pilot.designSystems.length);
  assert.match(dsHub, /<meta name="robots" content="noindex">/);
  for (const id of pilot.designSystems) assert.ok(dsHub.includes(`href="${id}/"`), `hub links ${id}`);

  const kami = await fs.readFile(path.join(out, 'design-systems', 'kami', 'index.html'), 'utf8');
  assert.match(kami, /Use the Open Design design system &quot;kami&quot; for my designs\./);
  assert.match(kami, /https:\/\/claude\.ai\/new\?q=/);
  assert.match(kami, /href="claude\/tokens\.json" download/);
  assert.match(kami, /href="kit\/DESIGN\.md" download/);
  assert.doesNotMatch(kami, /Bundled OpenDesign package/);
  await fs.access(path.join(out, 'design-systems', 'kami', 'preview.html'));
  await fs.access(path.join(out, 'design-systems', 'kami', 'claude', 'design-system.json'));
  assert.match(kami, /data-src="claude\/view\.html"/);
  const view = await fs.readFile(path.join(out, 'design-systems', 'kami', 'claude', 'view.html'), 'utf8');
  assert.match(view, /<h2>Color<\/h2>/);
  assert.match(view, /<code>#f5f4ed<\/code>/);
  assert.match(view, /<h2>README<\/h2>/);
  assert.match(view, /src="cover\.html"/);
  assert.match(await fs.readFile(path.join(out, 'design-systems', 'kami', 'claude', 'cover.html'), 'utf8'), /--bg:/);

  const exHub = await fs.readFile(path.join(out, 'examples', 'index.html'), 'utf8');
  assert.equal(exHub.match(/<li class="card/g)?.length, pilot.examples.length);
  const poster = await fs.readFile(path.join(out, 'examples', 'magazine-poster', 'index.html'), 'utf8');
  assert.match(poster, /<h1>Magazine poster<\/h1>/);
  assert.match(poster, /Remix the Open Design example od:prototype:magazine-poster:example\./);
  await fs.access(path.join(out, 'examples', 'magazine-poster', 'preview.html'));
  await fs.access(path.join(out, '.nojekyll'));

  const hub = await fs.readFile(path.join(out, 'design-systems', 'index.html'), 'utf8');
  assert.match(hub, /URLSearchParams\(location\.hash/, 'hub reads its filter from the hash');
  const json = JSON.parse(await fs.readFile(path.join(out, 'gallery.json'), 'utf8'));
  assert.equal(json.version, 1);
  assert.equal(json.site, null);
  assert.equal(json.designSystems.length, pilot.designSystems.length);
  assert.equal(json.examples.length, pilot.examples.length);
  const kamiEntry = json.designSystems.find((d) => d.id === 'kami');
  assert.equal(kamiEntry.url, 'design-systems/kami/');
  assert.equal(kamiEntry.claudeDesignUrl, 'design-systems/kami/#claude');
  assert.ok(kamiEntry.files.claudeDesign.includes('design-systems/kami/claude/tokens.json'));
  assert.equal(kamiEntry.prompts.kit, 'Use the Open Design design system "kami" for my designs.');
  const posterEntry = json.examples.find((e) => e.slug === 'magazine-poster');
  assert.equal(posterEntry.id, 'od:prototype:magazine-poster:example');
  assert.equal(posterEntry.prompts.remix, 'Remix the Open Design example od:prototype:magazine-poster:example.');
  assert.ok(json.hubs.examples.tags.length > 0);
});

test('--base-url makes gallery.json links absolute', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-'));
  execFileSync(tsx, [path.join(root, 'scripts', 'build-gallery.ts'), '--out', out, '--no-thumbs', '--base-url', 'https://example.github.io/kit'], { cwd: root, stdio: 'pipe' });
  const json = JSON.parse(await fs.readFile(path.join(out, 'gallery.json'), 'utf8'));
  assert.equal(json.site, 'https://example.github.io/kit/');
  assert.equal(json.designSystems.find((d) => d.id === 'kami').url, 'https://example.github.io/kit/design-systems/kami/');
  assert.equal(json.hubs.examples.url, 'https://example.github.io/kit/examples/');
});

test('--index drops the noindex tag', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-'));
  execFileSync(tsx, [path.join(root, 'scripts', 'build-gallery.ts'), '--out', out, '--no-thumbs', '--index'], { cwd: root, stdio: 'pipe' });
  assert.doesNotMatch(await fs.readFile(path.join(out, 'index.html'), 'utf8'), /noindex/);
});
