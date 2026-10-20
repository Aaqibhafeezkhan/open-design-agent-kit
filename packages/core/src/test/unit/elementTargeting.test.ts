// The robust comment selector and the anchor ladder (openspec
// add-browser-preview, element-comments), run in real Chromium on fixture
// pages: the modules are bundled with esbuild and exposed as a global.
// Skipped when no browser is installed.
import * as assert from 'node:assert';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { findBrowser } from '../../export/browserDiscovery';

const SRC = path.join(__dirname, '..', '..', '..', 'src');

const FIXTURE = `<!doctype html><html><body>
  <section id="pricing"><h2>Plans</h2>
    <div class="card plan"><h3>Basic</h3><button class="btn-primary px-4 md:px-6">Buy</button></div>
    <div class="card plan"><h3>Pro</h3><button class="btn-ghost px-4">Try</button></div>
  </section>
  <section id="x93821"><p>Generated id</p></section>
  <nav><a data-testid="nav-docs" href="#">Docs</a><a href="#">Blog</a></nav>
  <main><div><p>One</p><p>Two</p></div></main>
  <ul data-od-id="auto-abc"><li>Auto id</li></ul>
</body></html>`;

let browser: Browser | undefined;
let page: Page;

async function selectorOf(query: string): Promise<string> {
  return page.evaluate((q) => (window as any).od.selectorFor(document.querySelector(q)), query);
}

describe('element targeting', () => {
  before(async function () {
    const found = await findBrowser();
    if (!found.ok) this.skip();
    const bundle = await esbuild.build({
      stdin: {
        contents: `export * from './preview/dom/elementTargeting'; export * from './preview/dom/commentAnchors'; export { serializeDocument } from './preview/dom/sourcePatches';`,
        resolveDir: SRC,
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'od',
      platform: 'browser',
    });
    browser = await puppeteer.launch({ executablePath: found.executablePath, headless: true });
    page = await browser.newPage();
    await page.setContent(FIXTURE);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
  });

  after(async () => {
    await browser?.close();
  });

  it('uses a unique, hand-written id', async () => {
    assert.strictEqual(await selectorOf('#pricing'), 'section#pricing');
  });

  it('skips generated-looking ids', async () => {
    const sel = await selectorOf('#x93821 p');
    assert.ok(!sel.includes('x93821'), sel);
    assert.ok(await page.evaluate((s) => document.querySelectorAll(s).length === 1, sel));
  });

  it('uses a stable attribute', async () => {
    assert.strictEqual(await selectorOf('[data-testid="nav-docs"]'), 'a[data-testid="nav-docs"]');
  });

  it('skips utility classes and stays unique', async () => {
    const sel = await selectorOf('.btn-primary');
    assert.ok(!sel.includes('md:px-6') && !sel.includes('px-4'), sel);
    assert.strictEqual(sel, 'button.btn-primary');
  });

  it('scopes shared classes under an anchored ancestor, falling back to position', async () => {
    const sel = await selectorOf('.card:nth-of-type(2) h3');
    assert.ok(sel.startsWith('section#pricing'), sel);
    assert.strictEqual(await page.evaluate((s) => document.querySelector(s)?.textContent, sel), 'Pro');
  });

  it('falls back to the positional chain when nothing is stable', async () => {
    const sel = await selectorOf('main p:nth-of-type(2)');
    assert.match(sel, /nth-of-type\(2\)/);
    assert.strictEqual(await page.evaluate((s) => document.querySelector(s)?.textContent, sel), 'Two');
  });

  it('never uses an invented auto- id', async () => {
    assert.ok(!(await selectorOf('ul')).includes('auto-'));
    assert.strictEqual(await page.evaluate(() => (window as any).od.sourceDataOdId(document.querySelector('ul'))), undefined);
  });

  it('re-anchors a drifted comment by its text excerpt', async () => {
    const text = await page.evaluate(
      () => (window as any).od.resolveCommentAnchor(document, { selector: 'div.gone > h3', htmlHint: '<h3>', text: 'Pro' })?.textContent,
    );
    assert.strictEqual(text, 'Pro');
  });

  it('strips invented ids when serializing', async () => {
    const html: string = await page.evaluate(() => (window as any).od.serializeDocument(document));
    assert.ok(!html.includes('auto-abc'));
    assert.ok(html.includes('data-testid="nav-docs"'));
  });
});
