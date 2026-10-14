// The in-page preview bridge (openspec add-preview-bridge), driven the way the
// artifact preview drives it: a host page frames a design with the built
// dist/webview/bridge.js injected, and talks to it over postMessage. Runs in
// real Chromium (skipped when none is installed), like core's page-script
// tests. Run `npm run compile` first.
/// <reference lib="dom" />
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { findBrowser, injectPreviewBridge } from '@feimacode/open-design-agent-kit-core';
import puppeteer, { type Browser, type Frame, type Page } from 'puppeteer-core';

const BRIDGE_JS = path.join(__dirname, '..', '..', 'dist', 'webview', 'bridge.js');

const DESIGN = `<!doctype html><html><head><title>Probe</title>
<style>body { margin: 0; } .tall { height: 2000px; } #price { font-size: 32px; font-weight: 700; padding: 4px 8px; }</style></head>
<body>
  <h1 id="price">$124.50</h1>
  <img id="logo" src="data:image/png;base64,iVBORw0KGgo=" data-od-preview-src="assets/logo.png" alt="Logo" width="20" height="20">
  <a id="local" href="other.html">Other</a>
  <div class="tall"></div>
  <p id="far">Far down</p>
</body></html>`;

type Message = { od: string; type: string; [key: string]: unknown };

let browser: Browser | undefined;
let page: Page;
let frame: Frame;

async function messages(): Promise<Message[]> {
  return page.evaluate(() => (window as unknown as { msgs: Message[] }).msgs);
}

async function waitFor(type: string, since = 0, match: (m: any) => boolean = () => true): Promise<Message> {
  for (let i = 0; i < 50; i++) {
    const found = (await messages()).slice(since).find((m) => m.type === type && match(m));
    if (found) return found;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`no "${type}" message from the bridge`);
}

async function send(message: Record<string, unknown>): Promise<void> {
  await page.evaluate((m) => (window as unknown as { send(m: unknown): void }).send(m), message);
}

describe('preview bridge', () => {
  before(async () => {
    // Without a browser every test below skips itself (browser stays undefined).
    const found = await findBrowser();
    if (!found.ok) return;
    const bridge = await fs.readFile(BRIDGE_JS, 'utf8');
    const srcdoc = injectPreviewBridge(DESIGN, bridge);
    browser = await puppeteer.launch({ executablePath: found.executablePath, headless: true });
    page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });
    await page.setContent(
      `<!doctype html><html><body style="margin:0"><iframe id="f" style="width:600px;height:400px;border:0"></iframe>
      <script>
        window.msgs = [];
        const f = document.getElementById('f');
        addEventListener('message', (e) => { if (e.source === f.contentWindow && e.data && e.data.od === 'bridge') msgs.push(e.data); });
        window.send = (m) => f.contentWindow.postMessage(Object.assign({ od: 'bridge' }, m), '*');
        f.srcdoc = ${JSON.stringify(srcdoc).replace(/<\//g, '<\\/')};
      </script></body></html>`,
    );
    await waitFor('ready');
    frame = page.frames().find((f) => f !== page.mainFrame())!;
  });

  after(async () => {
    await browser?.close();
  });

  it('announces itself and answers hello', async (t) => {
    if (!browser) return t.skip();
    const ready = await waitFor('ready');
    assert.strictEqual(ready.title, 'Probe');
    const since = (await messages()).length;
    await send({ type: 'hello' });
    assert.strictEqual((await waitFor('ready', since)).title, 'Probe');
  });

  it('in Edit mode, adds the pick style and snapshots the clicked element', async (t) => {
    if (!browser) return t.skip();
    await send({ type: 'set-mode', mode: 'edit' });
    await frame.waitForSelector('#od-bridge-pick');
    const since = (await messages()).length;
    await frame.click('#price');
    const select = (await waitFor('select', since)) as Message & { element: Record<string, any> };
    const el = select.element;
    assert.strictEqual(el.tag, 'H1');
    assert.match(el.selector, /h1#price$/);
    assert.match(el.htmlHint, /^<h1 id="price"/);
    assert.ok(el.elementId.startsWith('auto-'), 'data-od-id ensured');
    assert.strictEqual(el.text, '$124.50');
    assert.strictEqual(el.styles.fontSize, '32px');
    assert.strictEqual(el.styles.fontWeight, '700');
    assert.strictEqual(el.styles.paddingLeft, '8px');
    assert.ok(el.rect.width > 0 && el.rect.height > 0);
  });

  it("reports an image's original src, not the preview's data: URI", async (t) => {
    if (!browser) return t.skip();
    const since = (await messages()).length;
    await frame.click('#logo');
    const el = ((await waitFor('select', since)) as Message & { element: Record<string, any> }).element;
    assert.strictEqual(el.attrs.src, 'assets/logo.png');
    assert.strictEqual(el.attrs.alt, 'Logo');
  });

  it('applies patches and returns source without the bridge or any preview-only node', async (t) => {
    if (!browser) return t.skip();
    const elementId = await frame.$eval('#price', (e) => e.getAttribute('data-od-id'));
    const since = (await messages()).length;
    await send({
      type: 'apply-patches',
      requestId: 'r1',
      patches: [
        { kind: 'set-text', elementId, value: '$130.00' },
        { kind: 'set-style', elementId, styles: { color: '#ff0000' } },
      ],
    });
    const patched = (await waitFor('patched', since)) as Message & { newSource: string };
    assert.strictEqual(patched.requestId, 'r1');
    assert.strictEqual(patched.ok, true);
    assert.match(patched.newSource, /\$130\.00/);
    assert.match(patched.newSource, /color: rgb\(255, 0, 0\)|color: #ff0000/);
    assert.ok(!patched.newSource.includes('data-od-preview-only'), 'no preview-only nodes');
    assert.ok(!patched.newSource.includes('od-bridge-pick'), 'no pick style');
    assert.ok(!patched.newSource.includes('__odPreviewBridge'), 'no bridge code');
    assert.match(patched.newSource, /src="assets\/logo\.png"/, 'inlined image restored to its original src');
  });

  it('reports ok: false when no patch applies', async (t) => {
    if (!browser) return t.skip();
    const since = (await messages()).length;
    await send({ type: 'apply-patches', requestId: 'r2', patches: [{ kind: 'set-text', elementId: 'nope', value: 'x' }] });
    const patched = await waitFor('patched', since);
    assert.strictEqual(patched.ok, false);
    assert.strictEqual(patched.newSource, undefined);
  });

  it('keeps comment pin rects current when the page scrolls', async (t) => {
    if (!browser) return t.skip();
    await send({ type: 'set-mode', mode: 'comment' });
    await send({ type: 'set-comments', comments: [{ id: 'c1', selector: 'p#far', status: 'open' }, { id: 'c2', selector: '#missing', status: 'open' }] });
    const hasPin = (m: { pins?: { commentId: string }[] }) => Boolean(m.pins?.some((p) => p.commentId === 'c1'));
    const first = (await waitFor('rects', 0, hasPin)) as Message & { pins: { commentId: string; rect: { top: number } | null }[] };
    const before = first.pins.find((p) => p.commentId === 'c1')!.rect!.top;
    assert.strictEqual(first.pins.find((p) => p.commentId === 'c2')!.rect, null, 'unresolvable anchor reports null');
    const since = (await messages()).length;
    await frame.evaluate(() => window.scrollTo(0, 500));
    const after = (await waitFor('rects', since, hasPin)) as Message & { pins: { commentId: string; rect: { top: number } | null }[] };
    assert.strictEqual(Math.round(before - after.pins.find((p) => p.commentId === 'c1')!.rect!.top), 500);
  });

  it('captures the page for Figma', async (t) => {
    if (!browser) return t.skip();
    const since = (await messages()).length;
    await send({ type: 'capture-figma', requestId: 'f1' });
    const capture = (await waitFor('figma-capture', since)) as Message & { capture: { title?: string } };
    assert.strictEqual(capture.requestId, 'f1');
    assert.ok(capture.capture && typeof capture.capture === 'object');
  });

  it('in View mode, removes the pick style and reports a relative link instead of navigating', async (t) => {
    if (!browser) return t.skip();
    await send({ type: 'set-mode', mode: 'view' });
    await frame.waitForFunction(() => !document.getElementById('od-bridge-pick'));
    const since = (await messages()).length;
    await frame.click('#local');
    const link = await waitFor('open-local-link', since);
    assert.strictEqual(link.href, 'other.html');
    assert.ok(await frame.$('#price'), 'still on the same page');
  });

  it('ignores messages that are not from its parent', async (t) => {
    if (!browser) return t.skip();
    const since = (await messages()).length;
    // The page's own script posts to itself, as a design could.
    await frame.evaluate(() => window.postMessage({ od: 'bridge', type: 'apply-patches', requestId: 'evil', patches: [] }, '*'));
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(!(await messages()).slice(since).some((m) => m.requestId === 'evil'));
  });
});
