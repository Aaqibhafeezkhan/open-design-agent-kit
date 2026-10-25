// The browser preview end to end (openspec add-browser-preview): the real
// shell and bridge bundles, served by the preview server, driven in
// headless Chromium. Skipped when no browser is installed.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import puppeteer, { type Browser, type Frame, type Page } from 'puppeteer-core';
import { findBrowser } from '../../export/browserDiscovery';
import { saveCheckRun } from '../../export/checkHistory';
import { loadPreviewAssets } from '../../preview/server/assets';
import { startPreviewServer, type PreviewServer } from '../../preview/server/previewServer';
import { writeArtifactManifest } from '../../vendored/artifactCreate';
import { readArtifactComments, resolveArtifactComments } from '../../workspace/artifactComments';

const ENTRY = '.open-design/landing/index.html';
const DESIGN = (heading: string) => `<!doctype html><html><head><title>Landing</title>
<style>body{margin:0;font-family:sans-serif} .hero{padding:40px} .tall{height:1600px}</style></head>
<body><section class="hero" id="hero"><h1 class="hero-title text-4xl">${heading}</h1><p>Fresh beans monthly.</p></section><div class="tall"></div><footer><p>Footer</p></footer></body></html>`;

async function until<T>(fn: () => Promise<T | undefined | false>, what: string, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 80));
  }
}

describe('browser preview shell (real browser)', function () {
  this.timeout(60000);
  let browser: Browser | undefined;
  let server: PreviewServer;
  let root: string;
  let page: Page;

  const designFrame = (): Promise<Frame> => until(async () => page.frames().find((f) => f.url().includes('/.open-design/landing/index.html')), 'the design frame');

  before(async function () {
    const found = await findBrowser();
    if (!found.ok) this.skip();
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-shell-'));
    await fs.mkdir(path.join(root, '.open-design/landing'), { recursive: true });
    await fs.writeFile(path.join(root, ENTRY), DESIGN('Coffee, delivered'));
    await writeArtifactManifest({ workspaceRoot: root, entryPath: ENTRY, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Landing' } });
    server = await startPreviewServer({ workspaceRoot: root, assets: await loadPreviewAssets() });
    browser = await puppeteer.launch({ executablePath: found.executablePath, headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    // Clipboard writes need the permission in headless mode.
    await browser.defaultBrowserContext().overridePermissions(new URL(server.shellBaseUrl).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    // This headless page stands in for the window the preview drives, so crops come from what it shows.
    server.setWindow({ page, navigate: async (u) => void (await page.goto(u)), focus: async () => undefined, close: async () => undefined, isOpen: () => true });
    await page.goto(server.urlFor(ENTRY));
  });

  after(async () => {
    await browser?.close();
    await server?.close();
  });

  it('shows the design and the live indicator', async () => {
    const frame = await designFrame();
    await until(async () => (await frame.$eval('h1', (el) => el.textContent)) === 'Coffee, delivered', 'the heading');
    await until(async () => page.$eval('#od-live', (el) => !el.classList.contains('off')), 'the event stream');
  });

  it('saves a comment with a robust selector, text and a crop of the window', async () => {
    await page.click('[data-mode="comment"]');
    const frame = await designFrame();
    await new Promise((r) => setTimeout(r, 200));
    await frame.click('h1');
    await until(async () => page.$('#od-comment-text'), 'the comment input');
    await page.type('#od-comment-text', 'Make the headline warmer');
    await page.click('#od-comment-save');
    const saved = await until(async () => {
      const list = await readArtifactComments(root, ENTRY);
      return list.length === 1 && list[0].screenshot ? list : undefined;
    }, 'the comment and its crop', 20000);
    const c = saved[0];
    assert.strictEqual(c.selector, 'h1.hero-title');
    assert.strictEqual(c.text, 'Coffee, delivered');
    assert.strictEqual(c.note, 'Make the headline warmer');
    assert.strictEqual(c.host, 'browser');
    assert.strictEqual(c.elementId, undefined);
    assert.ok(c.rect && c.viewport);
    assert.strictEqual(c.screenshot, 'index.html.comments/' + c.id + '.png');
    // Taken from the window the user sees, not re-rendered; no highlight in it.
    assert.strictEqual(c.screenshotRerendered, undefined);
    assert.doesNotMatch(c.htmlHint, /auto-/);
    await fs.access(path.join(root, '.open-design/landing', c.screenshot!));
    await until(async () => page.$('.od-pin.anchored'), 'the pin');
  });

  it('Send to agent copies the instruction and marks the comment sent', async () => {
    await page.click('#od-send-comments');
    const copied = await until(async () => {
      const text = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
      return text.includes('get_open_design_artifact') ? text : undefined;
    }, 'the clipboard');
    assert.match(copied, /\.open-design\/landing\/index\.html/);
    await until(async () => (await readArtifactComments(root, ENTRY))[0]?.status === 'sent', 'the sent status');
  });

  it('reloads when the design changes, staying in Comment mode', async () => {
    await fs.writeFile(path.join(root, ENTRY), DESIGN('Coffee, warmly delivered'));
    await until(async () => {
      const frame = await designFrame();
      return (await frame.$eval('h1', (el) => el.textContent)) === 'Coffee, warmly delivered';
    }, 'the reloaded heading');
    assert.ok(await page.$eval('[data-mode="comment"]', (el) => el.classList.contains('active')));
  });

  it('drops the pin when the agent resolves the comment', async () => {
    const [c] = await readArtifactComments(root, ENTRY);
    await resolveArtifactComments(root, ENTRY, [c.id]);
    await until(async () => !(await page.$('.od-pin')), 'the pin to go');
  });

  it('shows check runs before and after', async () => {
    const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
    await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [{ severity: 'error', check: 'horizontal-scroll', message: 'Scrolls sideways' }], images: [{ label: 'mobile', data: jpg, width: 1, height: 1 }] }, new Date('2026-10-19T10:00:00Z'));
    await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [], images: [{ label: 'mobile', data: jpg, width: 1, height: 1 }] }, new Date('2026-10-19T10:05:00Z'));
    await until(async () => page.$eval('#od-checks-dot', (el) => !(el as HTMLElement).hidden), 'the new-run dot');
    await page.click('#od-checks-toggle');
    await until(async () => (await page.$$('.od-check-pair img')).length === 2, 'before and after images');
    const summary = await page.$eval('.od-check-summary', (el) => el.textContent ?? '');
    assert.match(summary, /After: .*0 errors/);
    assert.match(summary, /Before: .*1 error\b/);
  });

  it("shows the design critic's last opinion when the manifest records one", async () => {
    await writeArtifactManifest({
      workspaceRoot: root,
      entryPath: ENTRY,
      artifactManifest: {
        kind: 'html',
        renderer: 'html',
        exports: ['html'],
        title: 'Landing',
        metadata: { critique: { verdict: 'polish', findings: [{ area: 'copy', where: 'Hero button', fix: 'Say what it does' }, { area: 'typography', fix: 'Use the display size' }], at: '2026-10-24T12:00:00.000Z' } },
      },
    });
    const text = await until(async () => {
      const t = await page.$eval('#od-checks', (el) => el.textContent ?? '');
      return t.includes('Second look') && t;
    }, 'the critique in the Checks panel');
    assert.match(text, /Second look: polish, 2 fixes/);
    assert.match(text, /Hero button Say what it does/);
  });
});
