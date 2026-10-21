import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { publishArtifact } from '../../generation/publishArtifact';
import { restoreArtifact } from '../../generation/restoreArtifact';
import { writeArtifactManifest } from '../../vendored/artifactCreate';
import { collectSyncBundle, encodeSyncBlock, injectSyncBlock, parseSyncBundle, syncFileHash, type SyncBundle } from '../../workspace/artifactSync';
import { readShareRecords } from '../../workspace/shareRecords';

const OUT = '.open-design';
const ENTRY = '.open-design/poster/poster.html';
const PAGE = '<!doctype html><html><head><title>Gig</title></head><body><h1>Gig night</h1><img src="assets/photo.png"></body></html>';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c80000000049454e44ae426082', 'hex');
const ARTIFACT = 'https://claude.ai/artifact/abc';

async function workspace(options: { metadata?: Record<string, unknown>; page?: string; designSystemId?: string } = {}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-sync-'));
  await fs.mkdir(path.join(root, '.open-design/poster/assets'), { recursive: true });
  await fs.writeFile(path.join(root, ENTRY), options.page ?? PAGE);
  await fs.writeFile(path.join(root, '.open-design/poster/assets/photo.png'), PNG);
  await fs.writeFile(path.join(root, `${ENTRY}.comments.json`), JSON.stringify([{ id: 'c1', text: 'Bigger headline' }]));
  await fs.mkdir(path.join(root, '.open-design/poster/exports'), { recursive: true });
  await fs.writeFile(path.join(root, '.open-design/poster/exports/poster.pdf'), 'pdf');
  await fs.writeFile(path.join(root, `${ENTRY}.od-figma.json`), '{}');
  await writeArtifactManifest({
    workspaceRoot: root,
    entryPath: ENTRY,
    artifactManifest: {
      kind: 'html',
      renderer: 'html',
      exports: ['html'],
      title: 'Gig poster',
      supportingFiles: ['assets/photo.png'],
      ...(options.designSystemId ? { designSystemId: options.designSystemId } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    },
  });
  return root;
}

async function emptyWorkspace(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'od-sync-restore-'));
}

async function manifestOf(root: string, entry = ENTRY) {
  return JSON.parse(await fs.readFile(path.join(root, `${entry}.artifact.json`), 'utf8'));
}

/** Publishes with sync and returns the page the agent would publish. */
async function syncedPage(root: string): Promise<string> {
  const result = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'claude-artifact', sync: true });
  assert.ok(result.ok, result.text);
  return fs.readFile(path.join(root, '.open-design/poster/exports/poster.sync.html'), 'utf8');
}

async function savePage(html: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'od-sync-page-'));
  const file = path.join(dir, 'artifact.html');
  await fs.writeFile(file, html);
  return file;
}

function bundleOf(html: string): SyncBundle {
  const parsed = parseSyncBundle(html);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  return parsed.bundle;
}

describe('artifact sync — bundle', () => {
  it('carries the entry, manifest, comments and supporting image, and no exports or Figma capture', async () => {
    const root = await workspace();
    const bundle = bundleOf(await syncedPage(root));
    assert.strictEqual(bundle.version, 1);
    assert.strictEqual(bundle.entry, 'poster/poster.html');
    assert.deepStrictEqual(bundle.files.map((f) => f.path).sort(), [
      'poster/assets/photo.png',
      'poster/poster.html',
      'poster/poster.html.artifact.json',
      'poster/poster.html.comments.json',
    ]);
    const image = bundle.files.find((f) => f.path === 'poster/assets/photo.png')!;
    assert.strictEqual(image.encoding, 'base64');
    assert.ok(Buffer.from(image.content, 'base64').equals(PNG));
    assert.strictEqual(image.sha256, syncFileHash(PNG));
  });

  it('stores the entry as readable text', async () => {
    const html = await syncedPage(await workspace());
    const block = /<script type="application\/od-sync\+json" id="od-sync">([\s\S]*?)<\/script>/.exec(html)![1]!;
    assert.ok(block.includes('<h1>Gig night<\\/h1>'), 'the entry HTML is a plain JSON string');
    const entry = bundleOf(html).files.find((f) => f.path === 'poster/poster.html')!;
    assert.strictEqual(entry.encoding, 'utf8');
    assert.strictEqual(entry.content, PAGE);
  });

  it('round-trips script-closing text in a file', async () => {
    const page = '<!doctype html><html><body><p>End a script with </script> and <!-- <script> --></p></body></html>';
    const root = await workspace({ page });
    const html = await syncedPage(root);
    assert.strictEqual(html.match(/application\/od-sync\+json/g)?.length, 1);
    const parsed = parseSyncBundle(html);
    assert.ok(parsed.ok);
    assert.strictEqual(parsed.files.find((f) => f.path === 'poster/poster.html')!.data.toString('utf8'), page);
  });

  it('removes claim URLs from the manifest copy', async () => {
    const root = await workspace({
      metadata: { shares: [{ provider: 'netlify-temporary', url: 'https://x.netlify.app', claimUrl: 'https://app.netlify.com/claim#secret', publishedAt: '2026-10-01T00:00:00Z' }] },
    });
    const html = await syncedPage(root);
    assert.ok(!html.includes('claim#secret'));
    const manifest = JSON.parse(bundleOf(html).files.find((f) => f.path.endsWith('.artifact.json'))!.content);
    assert.strictEqual(manifest.metadata.shares[0].url, 'https://x.netlify.app');
    assert.strictEqual(manifest.metadata.shares[0].claimUrl, undefined);
  });

  it("carries a user design system's DESIGN.md", async () => {
    const root = await workspace({ designSystemId: 'user:acme' });
    await fs.mkdir(path.join(root, '.open-design/design-systems/acme'), { recursive: true });
    await fs.writeFile(path.join(root, '.open-design/design-systems/acme/DESIGN.md'), '# Acme');
    const result = await collectSyncBundle({ workspaceRoot: root, entryPath: ENTRY, outputDir: OUT });
    assert.ok(result.ok);
    assert.ok(result.bundle.files.some((f) => f.path === 'design-systems/acme/DESIGN.md' && f.content === '# Acme'));
  });

  it('rejects a path with a ".." segment', () => {
    const bundle: SyncBundle = {
      version: 1,
      entry: 'p/p.html',
      createdAt: '',
      files: [{ path: '../../.ssh/config', encoding: 'utf8', bytes: 1, sha256: null, content: 'x' }],
    };
    const parsed = parseSyncBundle(injectSyncBlock('<html><body></body></html>', encodeSyncBlock(bundle)));
    assert.ok(!parsed.ok);
    assert.match(parsed.error, /\.\./);
  });

  it('accepts a null hash and reports a mismatched one', async () => {
    const html = await syncedPage(await workspace());
    const bundle = bundleOf(html);
    const entry = bundle.files.find((f) => f.path === bundle.entry)!;
    entry.content = entry.content.replace('Gig night', 'Gig NIGHT');
    entry.sha256 = null;
    assert.ok(parseSyncBundle(encodeSyncBlock(bundle)).ok);
    entry.sha256 = syncFileHash(Buffer.from('something else'));
    const bad = parseSyncBundle(encodeSyncBlock(bundle));
    assert.ok(!bad.ok);
    assert.match(bad.error, /poster\/poster\.html doesn't match its sha256/);
  });
});

describe('artifact sync — publish', () => {
  it('stores metadata.sync and keeps the bundle on later publishes', async () => {
    const root = await workspace();
    const first = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'claude-artifact', sync: true });
    assert.ok(first.ok, first.text);
    assert.strictEqual((await manifestOf(root)).metadata.sync, true);
    const synced = path.join(root, '.open-design/poster/exports/poster.sync.html');
    assert.ok(first.text.includes(`Call your Artifact tool with the file's path, \`${synced}\``));
    assert.match(first.text, /anyone they share the artifact with can read them/);
    assert.match(first.text, /earlier versions keep their copy/);
    const plain = await fs.readFile(path.join(root, '.open-design/poster/exports/poster.html'), 'utf8');
    assert.ok(!plain.includes('od-sync'), 'the plain standalone export carries no sources');

    await fs.writeFile(path.join(root, ENTRY), PAGE.replace('Gig night', 'Gig night II'));
    const again = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'claude-artifact' });
    assert.ok(again.ok, again.text);
    assert.ok(!/anyone they share the artifact with/.test(again.text), 'the notice is given once');
    const entry = bundleOf(await fs.readFile(synced, 'utf8')).files.find((f) => f.path === 'poster/poster.html')!;
    assert.ok(entry.content.includes('Gig night II'));
  });

  it('turns sync off: no block, and the instructions say earlier versions still hold one', async () => {
    const root = await workspace({ metadata: { sync: true } });
    const result = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'claude-artifact', sync: false });
    assert.ok(result.ok, result.text);
    assert.strictEqual((await manifestOf(root)).metadata.sync, false);
    assert.match(result.text, /earlier versions of the artifact still hold their copy/);
    await assert.rejects(fs.access(path.join(root, '.open-design/poster/exports/poster.sync.html')));
    assert.ok(result.text.includes('exports/poster.html`'));
  });

  it('has no block when sync was never on', async () => {
    const root = await workspace();
    const result = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'claude-artifact' });
    assert.ok(result.ok);
    assert.ok(!/## Sync/.test(result.text));
    await assert.rejects(fs.access(path.join(root, '.open-design/poster/exports/poster.sync.html')));
  });

  it('rejects sync for other providers and builds nothing', async () => {
    const root = await workspace();
    const result = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'netlify', sync: true });
    assert.strictEqual(result.ok, false);
    assert.match(result.text, /invalid-args/);
    await assert.rejects(fs.access(path.join(root, '.open-design/poster/exports/site')));
  });

  it('drops the bundle, not the preview, when page plus bundle is over 16 MB', async () => {
    const root = await workspace({ page: '<!doctype html><html><body><img src="assets/big.png"></body></html>' });
    // 6.5 MB of image: about 8.7 MB inlined in the page, and as much again in the bundle.
    await fs.writeFile(path.join(root, '.open-design/poster/assets/big.png'), Buffer.alloc(6_500_000, 1));
    const manifest = await manifestOf(root);
    await writeArtifactManifest({ workspaceRoot: root, entryPath: ENTRY, artifactManifest: { ...manifest, supportingFiles: ['assets/big.png'] } });
    const result = await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, provider: 'claude-artifact', sync: true });
    assert.ok(result.ok, result.text);
    assert.match(result.text, /\[artifact-sync-dropped\][^\n]*page 8\.7 MB, sync bundle 8\.7 MB/);
    assert.match(result.text, /## Stage 2 — publish/);
    assert.ok(result.text.includes('exports/poster.html`'));
  });
});

describe('artifact sync — restore', () => {
  it('restores into an empty workspace and records the artifact', async () => {
    const source = await workspace();
    const page = await savePage(await syncedPage(source));
    const target = await emptyWorkspace();
    const result = await restoreArtifact({ workspaceRoot: target, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.ok(result.ok, result.text);
    assert.strictEqual(await fs.readFile(path.join(target, ENTRY), 'utf8'), PAGE);
    assert.ok((await fs.readFile(path.join(target, '.open-design/poster/assets/photo.png'))).equals(PNG));
    const manifest = await manifestOf(target);
    assert.strictEqual(manifest.entry, ENTRY);
    assert.strictEqual(manifest.metadata.sync, true);
    const shares = readShareRecords(manifest);
    assert.strictEqual(shares[shares.length - 1]!.provider, 'claude-artifact');
    assert.strictEqual(shares[shares.length - 1]!.url, ARTIFACT);
    assert.deepStrictEqual(result.ok && result.report.editedOutside, []);

    // The next preview publish goes to the same artifact.
    const again = await publishArtifact({ workspaceRoot: target, entryPath: ENTRY, provider: 'claude-artifact' });
    assert.ok(again.text.includes(`pass \`${ARTIFACT}\` as the artifact URL to update`));
    assert.ok(again.text.includes('poster.sync.html'));
  });

  it('leaves identical files untouched, including the manifest once the share is recorded', async () => {
    const root = await workspace();
    const page = await savePage(await syncedPage(root));
    await publishArtifact({ workspaceRoot: root, entryPath: ENTRY, published: { provider: 'claude-artifact', url: ARTIFACT } });
    const result = await restoreArtifact({ workspaceRoot: root, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.ok(result.ok, result.text);
    assert.ok(result.report.identical.includes('poster/poster.html'));
    assert.ok(result.report.identical.includes('poster/assets/photo.png'));
    assert.deepStrictEqual(result.report.written, ['poster/poster.html.artifact.json']);
  });

  it('refuses to overwrite newer local work without overwrite, and writes it with overwrite', async () => {
    const root = await workspace();
    const page = await savePage(await syncedPage(root));
    await fs.writeFile(path.join(root, ENTRY), '<html><body>newer</body></html>');
    const refused = await restoreArtifact({ workspaceRoot: root, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.strictEqual(refused.ok, false);
    assert.match(refused.text, /- poster\/poster\.html/);
    assert.strictEqual(await fs.readFile(path.join(root, ENTRY), 'utf8'), '<html><body>newer</body></html>');

    const forced = await restoreArtifact({ workspaceRoot: root, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT, overwrite: true });
    assert.ok(forced.ok, forced.text);
    assert.strictEqual(await fs.readFile(path.join(root, ENTRY), 'utf8'), PAGE);
  });

  it('says a page without a bundle was published without sync, and writes nothing', async () => {
    const page = await savePage(PAGE);
    const target = await emptyWorkspace();
    const result = await restoreArtifact({ workspaceRoot: target, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.strictEqual(result.ok, false);
    assert.match(result.text, /published without sync/);
    assert.deepStrictEqual(await fs.readdir(target), []);
  });

  it('refuses a non-claude.ai URL', async () => {
    const page = await savePage(await syncedPage(await workspace()));
    const target = await emptyWorkspace();
    const result = await restoreArtifact({ workspaceRoot: target, outputDir: OUT, pagePath: page, artifactUrl: 'https://example.com/a' });
    assert.strictEqual(result.ok, false);
    assert.match(result.text, /invalid-args/);
    assert.deepStrictEqual(await fs.readdir(target), []);
  });

  it('refuses the whole restore for a path escape', async () => {
    const html = await syncedPage(await workspace());
    const bundle = bundleOf(html);
    bundle.files.push({ path: '../../.ssh/config', encoding: 'utf8', bytes: 1, sha256: null, content: 'x' });
    const page = await savePage(injectSyncBlock(PAGE, encodeSyncBlock(bundle)));
    const target = await emptyWorkspace();
    const result = await restoreArtifact({ workspaceRoot: target, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(await fs.readdir(target), []);
  });

  it('writes and reports an entry edited outside the kit, and bumps updatedAt', async () => {
    const html = await syncedPage(await workspace());
    const bundle = bundleOf(html);
    const entry = bundle.files.find((f) => f.path === bundle.entry)!;
    entry.content = entry.content.replace('Gig night', 'Late show');
    entry.sha256 = null;
    // A hand-edited page: the edited entry plus the bundle.
    const page = await savePage(injectSyncBlock(entry.content, encodeSyncBlock(bundle)));
    const target = await emptyWorkspace();
    const before = Date.now();
    const result = await restoreArtifact({ workspaceRoot: target, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.ok(result.ok, result.text);
    assert.deepStrictEqual(result.report.editedOutside, ['poster/poster.html']);
    assert.match(result.text, /Edited outside the kit/);
    assert.ok((await fs.readFile(path.join(target, ENTRY), 'utf8')).includes('Late show'));
    assert.ok(Date.parse((await manifestOf(target)).updatedAt) >= before - 1000);
  });

  it('reports sources that are not present locally', async () => {
    const root = await workspace();
    const manifest = await manifestOf(root);
    await fs.writeFile(path.join(root, 'brief.md'), '# Brief');
    await writeArtifactManifest({ workspaceRoot: root, entryPath: ENTRY, artifactManifest: { ...manifest, sources: [{ path: 'brief.md', sha256: syncFileHash(Buffer.from('# Brief')) }] } });
    const page = await savePage(await syncedPage(root));
    const target = await emptyWorkspace();
    const result = await restoreArtifact({ workspaceRoot: target, outputDir: OUT, pagePath: page, artifactUrl: ARTIFACT });
    assert.ok(result.ok, result.text);
    assert.deepStrictEqual(result.report.missingSources, ['brief.md']);
  });
});
