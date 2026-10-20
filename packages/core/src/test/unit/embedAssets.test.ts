import * as assert from 'node:assert';
import { promises as fs, readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import puppeteer from 'puppeteer-core';
import { findBrowser } from '../../export/browserDiscovery';
import { declaredRemoteAssets, embedDeclaredAssets, EMBEDDED_ASSETS_TYPE, polyHavenKind, type BinaryFetch } from '../../export/embedAssets';
import { exportArtifact } from '../../export/exportArtifact';
import { publishArtifact } from '../../generation/publishArtifact';
import { writeArtifactManifest } from '../../vendored/artifactCreate';

const FIXTURES = path.resolve(__dirname, '../../../src/test/fixtures/polyhaven');
const PH = 'https://dl.polyhaven.org/file/ph-assets';
const HDRI_1K = `${PH}/HDRIs/hdr/1k/studio_small_09_1k.hdr`;
const HDRI_2K = `${PH}/HDRIs/hdr/2k/studio_small_09_2k.hdr`;
const TEXTURE = `${PH}/Textures/jpg/1k/cobblestone_floor_08/`;
const LANTERN = `${PH}/Models/gltf/1k/Lantern_01/Lantern_01_1k.gltf`;

/** Serves the recorded Poly Haven file lists, and a few bytes (the URL itself) for any CDN file; records every URL. */
function fakeFetch(calls: string[], missing: string[] = [], bytes: (url: string) => Buffer = (u) => Buffer.from(u)): BinaryFetch {
  return async (url) => {
    calls.push(url);
    const files = /api\.polyhaven\.com\/files\/(.+)$/.exec(url);
    if (files) {
      let body: unknown;
      try {
        body = JSON.parse(readFileSync(path.join(FIXTURES, `files-${decodeURIComponent(files[1]!)}.json`), 'utf8'));
      } catch {
        return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
      }
      return { ok: true, status: 200, json: async () => body, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    if (missing.includes(url)) return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
    const b = bytes(url);
    return { ok: true, status: 200, json: async () => JSON.parse(b.toString()), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
  };
}

const scenePage = (assets: Array<Record<string, string>>, script = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><script type="application/od-scene+json">${JSON.stringify({ assets })}</script></head><body><canvas data-od-webgl></canvas><script type="module">${script}</script></body></html>`;

function embeddedBlock(html: string): Record<string, { type: string; data: string }> {
  const m = new RegExp(`<script type="${EMBEDDED_ASSETS_TYPE.replace(/[+]/g, '\\+')}" id="od-embedded-assets">([\\s\\S]*?)</script>`).exec(html);
  assert.ok(m, 'the embedded-assets block is in the page');
  return JSON.parse(m[1]!);
}

describe('embedAssets: declared assets', () => {
  it('reads the scene spec and the 3d-object asset block, https only, once each', () => {
    const html = `<script type="application/od-scene+json">{ "assets": [{ "source": "polyhaven", "id": "a", "url": "https://x.test/a.hdr" }, { "url": "http://x.test/b.hdr" }] }</script>
      <script type="application/od-assets+json">[{ "url": "https://x.test/a.hdr" }, "https://x.test/c.glb"]</script>
      <script type="application/json">{ "assets": [{ "url": "https://x.test/ignored.png" }] }</script>`;
    assert.deepStrictEqual(declaredRemoteAssets(html), [
      { url: 'https://x.test/a.hdr', source: 'polyhaven', id: 'a' },
      { url: 'https://x.test/c.glb', source: undefined, id: undefined },
    ]);
  });

  it('reads Poly Haven CDN paths', () => {
    assert.deepStrictEqual(polyHavenKind(HDRI_1K), { type: 'hdri', resolution: '1k' });
    assert.deepStrictEqual(polyHavenKind(TEXTURE), { type: 'texture', resolution: '1k' });
    assert.deepStrictEqual(polyHavenKind(LANTERN), { type: 'model', resolution: '1k' });
    assert.strictEqual(polyHavenKind('https://example.com/HDRIs/hdr/1k/x.hdr'), undefined);
  });
});

describe('embedAssets: embedding', () => {
  it('embeds an HDRI, a texture folder\'s maps and a glTF with its includes, under the URLs the page requests', async () => {
    const calls: string[] = [];
    const html = scenePage([
      { source: 'polyhaven', id: 'studio_small_09', url: HDRI_1K },
      { source: 'polyhaven', id: 'cobblestone_floor_08', url: TEXTURE },
      { source: 'polyhaven', id: 'Lantern_01', url: LANTERN },
    ]);
    const r = await embedDeclaredAssets(html, { fetchImpl: fakeFetch(calls) });
    const urls = r.embedded.map((a) => a.url);
    assert.ok(urls.includes(HDRI_1K));
    assert.ok(urls.includes(`${PH}/Textures/jpg/1k/cobblestone_floor_08/cobblestone_floor_08_diff_1k.jpg`));
    assert.ok(urls.includes(`${PH}/Textures/jpg/1k/cobblestone_floor_08/cobblestone_floor_08_arm_1k.jpg`));
    assert.ok(urls.includes(LANTERN));
    assert.ok(urls.includes(`${PH}/Models/gltf/4k/Lantern_01/Lantern_01.bin`), 'the glTF include under its CDN URL');
    assert.deepStrictEqual(r.notEmbedded, []);
    const block = embeddedBlock(r.html);
    assert.strictEqual(Buffer.from(block[HDRI_1K]!.data, 'base64').toString(), HDRI_1K);
    assert.strictEqual(block[HDRI_1K]!.type, 'image/vnd.radiance');
    assert.ok(r.html.indexOf('od-embedded-assets') < r.html.indexOf('application/od-scene+json'), 'block and runtime come before the page\'s scripts');
    assert.strictEqual(r.totalBytes, Buffer.byteLength(r.html));
    assert.ok(!calls.some((u) => u.endsWith('/')), 'never downloads a folder URL');
  });

  it('fetches textures and HDRIs at maxResolution, keeping the page\'s URL', async () => {
    const calls: string[] = [];
    const r = await embedDeclaredAssets(scenePage([{ source: 'polyhaven', id: 'studio_small_09', url: HDRI_2K }]), { fetchImpl: fakeFetch(calls) });
    const hdri = r.embedded.find((a) => a.url === HDRI_2K);
    assert.ok(hdri, JSON.stringify(r.embedded));
    assert.strictEqual(hdri.fetchedFrom, HDRI_1K);
    assert.ok(!calls.includes(HDRI_2K));
    const at2k = await embedDeclaredAssets(scenePage([{ source: 'polyhaven', id: 'studio_small_09', url: HDRI_2K }]), { fetchImpl: fakeFetch([]), maxResolution: '2k' });
    assert.strictEqual(at2k.embedded[0]!.fetchedFrom, undefined);
  });

  it('expands a glTF from another site to its relative buffers and images', async () => {
    const gltf = 'https://models.example/chair/chair.gltf';
    const body = JSON.stringify({ buffers: [{ uri: 'chair.bin' }, { uri: 'data:application/octet-stream;base64,AA==' }], images: [{ uri: 'textures/wood.jpg' }] });
    const r = await embedDeclaredAssets(scenePage([{ url: gltf }]), { fetchImpl: fakeFetch([], [], (u) => Buffer.from(u === gltf ? body : u)) });
    assert.deepStrictEqual(r.embedded.map((a) => a.url).sort(), [gltf, 'https://models.example/chair/chair.bin', 'https://models.example/chair/textures/wood.jpg'].sort());
  });

  it('reports a download that fails and keeps going', async () => {
    const tex = 'https://cdn.example/stone.jpg';
    const r = await embedDeclaredAssets(scenePage([{ url: tex }, { url: 'https://cdn.example/sky.hdr' }]), { fetchImpl: fakeFetch([], [tex]) });
    assert.deepStrictEqual(r.notEmbedded, [{ url: tex, reason: 'HTTP 404' }]);
    assert.deepStrictEqual(r.embedded.map((a) => a.url), ['https://cdn.example/sky.hdr']);
  });

  it('fails above 16 MB, naming the largest assets, and warns from 12 MB', async () => {
    const big = (n: number) => () => Buffer.alloc(n);
    const over = await embedDeclaredAssets(scenePage([{ url: 'https://cdn.example/huge.hdr' }]), { fetchImpl: fakeFetch([], [], big(13_000_000)) });
    assert.match(over.tooLarge ?? '', /over the 16\.0 MB limit\. The largest: https:\/\/cdn\.example\/huge\.hdr \(13\.0 MB\)/);
    const near = await embedDeclaredAssets(scenePage([{ url: 'https://cdn.example/big.hdr' }]), { fetchImpl: fakeFetch([], [], big(9_500_000)) });
    assert.strictEqual(near.tooLarge, undefined);
    assert.ok(near.warnings.some((w) => /close to the 16\.0 MB artifact limit/.test(w)), near.warnings.join('\n'));
  });

  it('leaves a page with nothing declared alone', async () => {
    const html = '<!doctype html><html><head></head><body></body></html>';
    const r = await embedDeclaredAssets(html, { fetchImpl: fakeFetch([]) });
    assert.strictEqual(r.html, html);
    assert.match(r.warnings[0]!, /declares no remote assets/);
  });
});

async function sceneWorkspace(html: string): Promise<{ root: string; entry: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-embed-'));
  const entry = '.open-design/court/court.html';
  await fs.mkdir(path.join(root, '.open-design/court'), { recursive: true });
  await fs.writeFile(path.join(root, entry), html);
  await writeArtifactManifest({ workspaceRoot: root, entryPath: entry, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Court' } });
  return { root, entry };
}

describe('embedAssets: export and publish', () => {
  it('standalone export with embedAssets lists what it embedded and leaves the source alone', async () => {
    const html = scenePage([{ url: 'https://cdn.example/sky.hdr' }]);
    const { root, entry } = await sceneWorkspace(html);
    const r = await exportArtifact({ workspaceRoot: root, entryPath: entry, format: 'standalone', embedAssets: true, assetFetch: fakeFetch([]) });
    assert.ok(r.ok, JSON.stringify(r));
    assert.deepStrictEqual(r.embeddedAssets?.map((a) => a.url), ['https://cdn.example/sky.hdr']);
    assert.strictEqual(await fs.readFile(path.join(root, entry), 'utf8'), html);
    assert.match(await fs.readFile(path.join(root, r.output), 'utf8'), /od-embedded-assets/);
  });

  it('rejects embedAssets outside standalone, and a bad maxResolution', async () => {
    const { root, entry } = await sceneWorkspace(scenePage([]));
    const site = await exportArtifact({ workspaceRoot: root, entryPath: entry, format: 'site', embedAssets: true });
    assert.ok(!site.ok && /standalone/.test(site.error));
    const res = await exportArtifact({ workspaceRoot: root, entryPath: entry, format: 'standalone', embedAssets: true, maxResolution: '8k' as never });
    assert.ok(!res.ok && /maxResolution must be one of 1k, 2k, 4k/.test(res.error));
  });

  it('claude-artifact embeds a 3D scene\'s Poly Haven assets, so the preflight is quiet about dl.polyhaven.org', async () => {
    const script = `const PH = '${PH}'; const HDRI = \`\${PH}/HDRIs/hdr/1k/studio_small_09_1k.hdr\`;`;
    const { root, entry } = await sceneWorkspace(scenePage([{ source: 'polyhaven', id: 'studio_small_09', url: HDRI_1K }], script));
    const { ok, text } = await publishArtifact({ workspaceRoot: root, entryPath: entry, provider: 'claude-artifact', assetFetch: fakeFetch([]) });
    assert.ok(ok, text);
    assert.ok(text.includes(`- ${HDRI_1K} (`), 'lists the embedded HDRI');
    assert.ok(!text.includes('artifact-blocked-host'), text);
  });

  it('claude-artifact still reports an asset it could not embed', async () => {
    const { root, entry } = await sceneWorkspace(scenePage([{ url: 'https://cdn.example/stone.jpg' }]));
    const { ok, text } = await publishArtifact({ workspaceRoot: root, entryPath: entry, provider: 'claude-artifact', assetFetch: fakeFetch([], ['https://cdn.example/stone.jpg']) });
    assert.ok(ok, text);
    assert.match(text, /\[artifact-blocked-host\] https:\/\/cdn\.example\/stone\.jpg/);
  });
});

describe('embedAssets: runtime (real browser; skipped when none is installed)', function () {
  this.timeout(60000);
  let browserPath: string | undefined;
  before(async function () {
    const found = await findBrowser();
    if (!found.ok) this.skip();
    else browserPath = found.executablePath;
  });

  it('answers fetch, Request, XHR and <img> for the original URLs from blob: URLs, with the CDN blocked', async () => {
    // A 1×1 PNG.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const html = scenePage([{ url: 'https://cdn.example/sky.hdr' }, { url: 'https://cdn.example/stone.png' }]);
    const r = await embedDeclaredAssets(html, { fetchImpl: fakeFetch([], [], (u) => (u.endsWith('.png') ? png : Buffer.from('HDR bytes'))) });
    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const blocked: string[] = [];
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.url().startsWith('https://cdn.example/')) {
          blocked.push(req.url());
          void req.abort();
        } else void req.continue();
      });
      await page.setContent(r.html, { waitUntil: 'load' });
      const result = await page.evaluate(async () => {
        const viaFetch = await (await fetch('https://cdn.example/sky.hdr')).text();
        const viaRequest = await (await fetch(new Request('https://cdn.example/sky.hdr'))).text();
        const viaXhr = await new Promise<string>((resolve) => {
          const x = new XMLHttpRequest();
          x.open('GET', 'https://cdn.example/sky.hdr');
          x.onload = () => resolve(x.responseText);
          x.onerror = () => resolve('error');
          x.send();
        });
        const width = await new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth);
          img.onerror = () => resolve(-1);
          img.src = 'https://cdn.example/stone.png';
        });
        return { viaFetch, viaRequest, viaXhr, width, src: (window as unknown as { odEmbeddedAssets: { resolve(u: string): string } }).odEmbeddedAssets.resolve('https://cdn.example/sky.hdr') };
      });
      assert.deepStrictEqual({ ...result, src: result.src.startsWith('blob:') }, { viaFetch: 'HDR bytes', viaRequest: 'HDR bytes', viaXhr: 'HDR bytes', width: 1, src: true });
      assert.deepStrictEqual(blocked, [], 'nothing went to the CDN');
    } finally {
      await browser.close();
    }
  });
});
