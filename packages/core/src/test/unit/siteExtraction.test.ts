import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { findBrowser } from '../../export/browserDiscovery';
import { cssColorToHex, evidenceToTokens, mapTypeScale, type PageEvidence } from '../../generation/evidenceToTokens';
import { extractSite, extractionSlug, isPrivateAddress, registrableDomain, validateExtractionUrls } from '../../generation/siteExtraction';

const FIXTURES = path.resolve(__dirname, '../../../src/test/fixtures/siteExtraction');
const publicDns = async (): Promise<string[]> => ['93.184.216.34'];

function page(overrides: Partial<PageEvidence> = {}): PageEvidence {
  return {
    url: 'https://example.com/',
    roles: {
      bg: { value: 'rgb(255, 255, 255)', selector: 'body', count: 1 },
      fg: { value: 'rgb(60, 60, 60)', selector: 'main > p', count: 4 },
      accent: { value: 'rgb(88, 204, 2)', selector: 'button.btn-primary', count: 1, crop: 'crops/accent.png' },
      'accent-on': { value: 'rgb(255, 255, 255)', selector: 'button.btn-primary', count: 1 },
      'accent-hover': { value: 'rgb(70, 163, 2)', selector: 'button.btn-primary:hover', count: 1 },
    },
    textRoles: [
      { role: 'h1', selector: 'h1', fontFamily: '"Nunito", Arial, sans-serif', fontSize: 48, lineHeight: 52, fontWeight: 800, letterSpacing: -0.96 },
      { role: 'h2', selector: 'h2', fontFamily: '"Nunito", Arial, sans-serif', fontSize: 32, lineHeight: 40, fontWeight: 700 },
      { role: 'h3', selector: 'h3', fontFamily: '"Nunito", Arial, sans-serif', fontSize: 22, lineHeight: 28, fontWeight: 700 },
      { role: 'body', selector: 'main > p', fontFamily: '"Nunito", Arial, sans-serif', fontSize: 15, lineHeight: 24, fontWeight: 400 },
      { role: 'small', selector: 'small', fontFamily: '"Nunito", Arial, sans-serif', fontSize: 13, fontWeight: 400 },
    ],
    fonts: [{ family: 'Nunito', weight: '400', style: 'normal', source: 'url(/fonts/nunito.woff2)' }],
    customProperties: { root: { '--brand-green': '#58cc02' }, themes: {} },
    radii: [
      { px: 12, count: 2, kind: 'button' },
      { px: 16, count: 3, kind: 'card' },
      { px: 8, count: 1, kind: 'input' },
    ],
    spacing: [
      { px: 24, count: 9 },
      { px: 16, count: 5 },
      { px: 12, count: 3 },
    ],
    containerMax: 1120,
    transitions: { durations: [], easings: [] },
    ...overrides,
  };
}

describe('site extraction: URL safety', () => {
  it('refuses private, loopback and link-local hosts, by literal and by resolution', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      assert.strictEqual(isPrivateAddress(ip), true, ip);
    }
    assert.strictEqual(isPrivateAddress('93.184.216.34'), false);
    const literal = await validateExtractionUrls('http://192.168.1.10/', [], publicDns);
    assert.deepStrictEqual(literal.ok, false);
    assert.match((literal as { error: string }).error, /private/);
    const rebinding = await validateExtractionUrls('https://intranet.example.com/', [], async () => ['10.0.0.5']);
    assert.match((rebinding as { error: string }).error, /resolves to a local or private address/);
    assert.match(((await validateExtractionUrls('http://localhost:3000/', [], publicDns)) as { error: string }).error, /local and private/);
    assert.match(((await validateExtractionUrls('file:///etc/passwd', [], publicDns)) as { error: string }).error, /only http and https/);
  });

  it('keeps extra pages on the same site, at most three', async () => {
    assert.strictEqual(registrableDomain('www.shop.example.co.uk'), 'example.co.uk');
    assert.strictEqual(registrableDomain('docs.example.com'), 'example.com');
    const ok = await validateExtractionUrls('https://example.com/', ['https://docs.example.com/start'], publicDns);
    assert.strictEqual(ok.ok, true);
    const other = await validateExtractionUrls('https://example.com/', ['https://other.org/'], publicDns);
    assert.match((other as { error: string }).error, /https:\/\/other\.org\/ is not on the same site/);
    const many = await validateExtractionUrls('https://example.com/', ['a', 'b', 'c', 'd'].map((p) => `https://example.com/${p}`), publicDns);
    assert.match((many as { error: string }).error, /at most 3/);
    assert.strictEqual(extractionSlug(new URL('https://www.example.com/pricing')), 'example-com');
  });

  it('returns invalid-args and renders nothing for a refused URL', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'od-extract-'));
    const result = await extractSite({ url: 'http://192.168.1.10/', workspaceRoot, outputDir: '.open-design', resolveHost: publicDns });
    assert.strictEqual(result.status, 'invalid-args');
    await assert.rejects(fs.access(path.join(workspaceRoot, '.open-design', '.extract')));
  });
});

describe('evidenceToTokens', () => {
  it('reads computed colours as hex', () => {
    assert.strictEqual(cssColorToHex('rgb(88, 204, 2)'), '#58cc02');
    assert.strictEqual(cssColorToHex('rgba(0, 0, 0, 0)'), undefined);
    assert.strictEqual(cssColorToHex('rgba(0, 0, 0, 0.5)'), '#00000080');
    assert.strictEqual(cssColorToHex('#FFF'), '#ffffff');
  });

  it('takes the accent from the primary button and its forced hover state', () => {
    const draft = evidenceToTokens({ pages: [page()] });
    assert.strictEqual(draft.tokens['--accent'], '#58cc02');
    assert.strictEqual(draft.tokens['--accent-hover'], '#46a302');
    assert.strictEqual(draft.sources['--accent'].selector, 'button.btn-primary');
    assert.strictEqual(draft.sources['--accent'].crop, 'crops/accent.png');
  });

  it('anchors the type scale on body and puts the largest heading at --text-4xl', () => {
    const draft = evidenceToTokens({ pages: [page()] });
    assert.strictEqual(draft.tokens['--text-base'], '15px');
    assert.strictEqual(draft.tokens['--text-4xl'], '48px');
    assert.strictEqual(draft.tokens['--text-3xl'], '32px');
    assert.strictEqual(draft.tokens['--text-2xl'], '22px');
    assert.strictEqual(draft.tokens['--text-sm'], '13px');
    assert.ok(draft.unmeasured.includes('--text-lg'));
    assert.strictEqual(draft.tokens['--leading-body'], '1.6');
    assert.strictEqual(draft.tokens['--tracking-display'], '-0.02em');
    assert.deepStrictEqual(mapTypeScale(16, [12, 14, 18, 20, 24, 30, 36, 48, 60]), {
      '--text-base': '16px',
      '--text-4xl': '60px',
      '--text-3xl': '36px',
      '--text-2xl': '30px',
      '--text-xl': '20px',
      '--text-lg': '18px',
      '--text-sm': '14px',
      '--text-xs': '12px',
    });
  });

  it('puts the loaded font first in the stack', () => {
    const draft = evidenceToTokens({
      pages: [page({ textRoles: [{ role: 'body', selector: 'p', fontFamily: 'Arial, "Nunito", sans-serif', fontSize: 16, fontWeight: 400 }] })],
    });
    assert.strictEqual(draft.tokens['--font-body'], '"Nunito", Arial, sans-serif');
  });

  it('omits what nothing measured and lists it', () => {
    const draft = evidenceToTokens({ pages: [page()] });
    assert.strictEqual(draft.tokens['--motion-fast'], undefined);
    assert.ok(draft.unmeasured.includes('--motion-fast'));
    assert.ok(draft.unmeasured.includes('--surface'));
    assert.strictEqual(draft.tokens['--radius-md'], '12px');
    assert.strictEqual(draft.tokens['--radius-lg'], '16px');
    assert.strictEqual(draft.tokens['--space-3'], '12px');
    assert.strictEqual(draft.tokens['--space-4'], '16px');
    assert.strictEqual(draft.tokens['--space-6'], '24px');
    assert.ok(draft.unmeasured.includes('--space-1'));
    assert.strictEqual(draft.tokens['--container-max'], '1120px');
  });

  it('adds dark values only where the dark theme differs', () => {
    const draft = evidenceToTokens({
      pages: [page()],
      dark: { trigger: 'prefers-color-scheme', roles: { bg: { value: 'rgb(19, 31, 36)', selector: 'body', count: 1 }, accent: { value: 'rgb(88, 204, 2)', selector: 'button', count: 1 } } },
    });
    assert.deepStrictEqual(draft.dark, { '--bg': '#131f24' });
    assert.strictEqual(evidenceToTokens({ pages: [page()] }).dark, undefined);
  });
});

describe('extractSite in a browser', function () {
  this.timeout(120_000);
  let server: http.Server;
  let base: string;
  let executablePath: string;

  before(async function () {
    const found = await findBrowser();
    if (!found.ok) this.skip();
    executablePath = found.executablePath;
    server = http.createServer((req, res) => {
      const name = (req.url ?? '/').split('?')[0].replace(/^\//, '') || 'light.html';
      fs.readFile(path.join(FIXTURES, path.basename(name.endsWith('.html') ? name : `${name}.html`)))
        .then((body) => {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(body);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => server?.close());

  const run = async (file: string, theme: 'light' | 'dark' | 'both' = 'light') => {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'od-extract-'));
    const result = await extractSite({ url: `${base}/${file}`, theme, workspaceRoot, outputDir: '.open-design', executablePath, allowHostsForTesting: ['127.0.0.1'] });
    return { workspaceRoot, result };
  };

  it('measures a light marketing page and writes the evidence bundle', async () => {
    const { workspaceRoot, result } = await run('light.html', 'both');
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    const t = result.draft!.tokens;
    assert.strictEqual(t['--accent'], '#58cc02');
    assert.strictEqual(t['--accent-hover'], '#46a302');
    assert.strictEqual(t['--accent-active'], '#3c8c02');
    assert.strictEqual(t['--accent-on'], '#ffffff');
    assert.strictEqual(t['--bg'], '#ffffff');
    assert.strictEqual(t['--fg'], '#3c3c3c');
    assert.strictEqual(t['--surface'], '#f7f7f7');
    // White copy over the photo band is long but unreadable on the page, so it's neither text role.
    assert.strictEqual(t['--muted'], '#777777');
    assert.ok(!Object.values(t).includes('2px'), 'a 2px nudge is not a spacing step');
    assert.match(t['--font-body'], /^"?Nunito"?, Arial/);
    assert.strictEqual(t['--text-base'], '15px');
    assert.strictEqual(t['--text-4xl'], '48px');
    assert.strictEqual(t['--radius-md'], '12px');
    assert.strictEqual(t['--container-max'], '1120px');
    assert.strictEqual(t['--motion-fast'], '150ms');
    assert.strictEqual(result.draft!.dark, undefined);
    assert.ok(result.notes.some((n) => /No dark theme was found/.test(n)));
    const bundle = path.join(workspaceRoot, result.bundleDir);
    assert.strictEqual(result.bundleDir, '.open-design/.extract/127-0-0-1');
    const evidence = JSON.parse(await fs.readFile(path.join(bundle, 'evidence.json'), 'utf8'));
    assert.strictEqual(evidence.pages[0].customProperties.root['--brand-green'], '#58cc02');
    await fs.access(path.join(bundle, 'desktop.png'));
    await fs.access(path.join(bundle, 'mobile.png'));
    await fs.access(path.join(bundle, 'crops', 'accent.png'));
    await fs.access(path.join(bundle, 'logo.svg'));
  });

  it('measures a dark theme only when the site has one', async () => {
    const { result } = await run('dark.html', 'both');
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(result.draft!.dark?.['--bg'], '#131f24');
    assert.strictEqual(result.draft!.dark?.['--fg'], '#f1f7fb');
  });

  it('measures styles a CSS-in-JS app injects at runtime', async () => {
    const { result } = await run('css-in-js.html');
    assert.strictEqual(result.status, 'ok');
    if (result.status !== 'ok') return;
    assert.strictEqual(result.draft!.tokens['--accent'], '#7c5cff');
    assert.strictEqual(result.draft!.tokens['--bg'], '#0b0d12');
    assert.strictEqual(result.draft!.tokens['--radius-pill'], '9999px');
  });

  it('reports a bot-check page as blocked, with its screenshot and no evidence', async () => {
    const { workspaceRoot, result } = await run('challenge.html');
    assert.strictEqual(result.status, 'blocked');
    if (result.status !== 'blocked') return;
    assert.match(result.blocked[0].reason, /bot check/);
    await fs.access(path.join(workspaceRoot, result.blocked[0].screenshot!));
    assert.strictEqual(result.draft, undefined);
  });
});
