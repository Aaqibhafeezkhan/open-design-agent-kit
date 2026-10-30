/// <reference lib="dom" />
// The preview MCP App's pickers end to end (openspec add-mcp-app-pickers, and
// the ask view from add-mcp-app-ask-view): the
// real server over stdio, driven by a scripted MCP client with and without the
// MCP Apps extension, then each view rendered in a reference host page
// (ext-apps' AppBridge in headless Chromium; skipped when no browser is found).
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { findBrowser, MCP_APP_MIME_TYPE, MCP_APPS_EXTENSION_ID, PREVIEW_APP_URI, writeArtifactManifest, writeCampaignSheetSidecar, writeExplorationPlan } from '@feimacode/open-design-agent-kit-core';

const MASTER = '.open-design/launch/launch.html';
const QUESTIONS = [
  { id: 'where', text: 'Where will it be used?', options: [{ id: 'printed', label: 'Printed' }, { id: 'screen', label: 'On screen' }] },
  { id: 'mood', text: 'Which moods?', kind: 'multi', options: [{ id: 'dark', label: 'Dark' }, { id: 'bold', label: 'Bold' }] },
];
const LANDING = '.open-design/launch-landing/index.html';
// A 1×1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-mcp-pickers-e2e-'));
  for (const [entry, title, body] of [
    [MASTER, 'Launch', '<div data-od-card data-od-fluid><h1>Launch</h1></div>'],
    [LANDING, 'Landing page', '<h1 class="landing">Landing</h1>'],
  ] as const) {
    await fs.mkdir(path.join(root, path.dirname(entry)), { recursive: true });
    await fs.writeFile(path.join(root, entry), `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
    await writeArtifactManifest({ workspaceRoot: root, entryPath: entry, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title } });
  }
  await writeCampaignSheetSidecar({
    workspaceRoot: root,
    master: MASTER,
    title: 'Launch',
    tiles: [
      { label: 'Instagram post', shape: 'instagram-post', file: '.open-design/launch/exports/launch-instagram-post.png', errors: [] },
      { label: 'Mobile banner', shape: 'banner-mobile', errors: [{ check: 'overflow', message: 'The headline overflows the card by 12px.' }] },
      { label: 'Landing page', entryPath: LANDING, errors: [] },
    ],
    images: [{ data: PNG }, { data: PNG }, { data: PNG }],
  });
  await writeExplorationPlan(root, '.open-design', {
    version: 1,
    explorationId: 'tiles-1',
    title: 'Brand tiles',
    brief: 'A coffee brand',
    skillId: 'od:design-system:style-tile',
    skillMode: 'design-system',
    axis: 'palette',
    createdAt: '2026-10-21T00:00:00.000Z',
    directions: [
      { id: 'a', label: 'Warm', summary: 'Terracotta and cream', spec: 'warm', entryPath: '.open-design/explorations/tiles-1/a/index.html' },
      { id: 'b', label: 'Cool', summary: 'Slate and mint', spec: 'cool', entryPath: '.open-design/explorations/tiles-1/b/index.html' },
    ],
  } as unknown as Parameters<typeof writeExplorationPlan>[2]);
  return root;
}

async function connect(root: string, withApps: boolean): Promise<Client> {
  const capabilities = withApps ? { extensions: { [MCP_APPS_EXTENSION_ID]: { mimeTypes: [MCP_APP_MIME_TYPE] } } } : {};
  const client = new Client({ name: withApps ? 'reference-host' : 'plain-host', version: '1.0.0' }, { capabilities });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--require', 'tsx/cjs', path.join(__dirname, '..', '..', 'index.ts')],
      env: { ...process.env, OPEN_DESIGN_WORKSPACE_ROOT: root, OPEN_DESIGN_PREVIEW: 'off' } as Record<string, string>,
      stderr: 'ignore',
    }),
  );
  return client;
}

const text = (result: unknown): string =>
  ((result as CallToolResult).content ?? [])
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

const until = async (cond: () => boolean | Promise<boolean>, what: string): Promise<void> => {
  for (let i = 0; i < 100; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
};

describe('preview MCP App pickers over MCP', function () {
  this.timeout(90000);
  let root: string;

  before(async () => {
    root = await workspace();
  });

  describe('a host with MCP Apps', () => {
    let client: Client;
    before(async () => {
      client = await connect(root, true);
    });
    after(() => client?.close());

    it('lists both picker tools against the one preview resource', async () => {
      const { resources } = await client.listResources();
      assert.deepStrictEqual(resources.filter((r) => r.uri.startsWith('ui://')).map((r) => r.uri), [PREVIEW_APP_URI]);
      const byName = new Map((await client.listTools()).tools.map((t) => [t.name, t]));
      for (const name of ['show_open_design_examples', 'show_open_design_design_systems']) {
        const ui = (byName.get(name)?._meta as { ui?: { resourceUri?: string; visibility?: string[] } })?.ui;
        assert.strictEqual(ui?.resourceUri, PREVIEW_APP_URI, name);
        assert.strictEqual(ui?.visibility, undefined, `${name} is model-visible`);
      }
    });

    it('returns only the view, filters and title; the page reads the pages through the app-only tool', async () => {
      const shown = await client.callTool({ name: 'show_open_design_examples', arguments: { surface: 'slides' } });
      assert.deepStrictEqual(shown.structuredContent, { view: 'examples', title: 'Examples: slides', surface: 'slides' });

      const page = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'examples' } })).structuredContent as {
        examples: Array<{ id: string; mode: string }>;
        total: number;
        nextCursor?: string;
      };
      assert.ok(page.examples.length > 0 && page.examples.length <= 24);
      if (page.total > 24) {
        assert.strictEqual(page.nextCursor, '24');
        const next = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'examples', cursor: page.nextCursor } })).structuredContent as { examples: Array<{ id: string }> };
        assert.notStrictEqual(next.examples[0].id, page.examples[0].id);
      }
      const preview = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { exampleId: page.examples[0].id } })).structuredContent as { html?: string; fallback?: string };
      assert.ok(preview.html || preview.fallback);

      const slides = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'examples', surface: 'slides' } })).structuredContent as { examples: unknown[] };
      assert.ok(slides.examples.length > 0, 'the slides surface has remixable examples');
    });

    it('shows a shortlist of design systems in order, and their Visualize page', async () => {
      const all = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'design-systems' } })).structuredContent as { systems: Array<{ id: string; swatches: string[] }> };
      const ids = all.systems.slice(0, 3).map((s) => s.id).reverse();
      const shown = await client.callTool({ name: 'show_open_design_design_systems', arguments: { ids } });
      assert.deepStrictEqual(shown.structuredContent, { view: 'design-systems', title: 'Shortlisted design systems', ids });
      const state = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'design-systems', ids } })).structuredContent as { systems: Array<{ id: string; swatches: string[] }> };
      assert.deepStrictEqual(state.systems.map((s) => s.id), ids);
      assert.ok(state.systems.every((s) => s.swatches.length > 0));
      const detail = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { designSystemId: ids[0] } })).structuredContent as { html: string };
      assert.match(detail.html, /<html/i);
      assert.doesNotMatch(detail.html, /<script/i);
    });

    it('shows a campaign sheet from its sidecar, in text too', async () => {
      const shown = await client.callTool({ name: 'show_open_design_artifact', arguments: { entryPath: MASTER, campaign: true } });
      assert.deepStrictEqual(shown.structuredContent, { view: 'campaign', entryPath: MASTER, title: 'Launch' });
      assert.match(text(shown), /Mobile banner \(shape banner-mobile\): overflow/);
      const state = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'campaign', entryPath: MASTER } })).structuredContent as {
        tiles: Array<{ label: string; image?: string; errors: unknown[] }>;
      };
      assert.deepStrictEqual(state.tiles.map((t) => t.label), ['Instagram post', 'Mobile banner', 'Landing page']);
      assert.ok(state.tiles.every((t) => t.image?.startsWith('data:image/png;base64,')));
      const none = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'campaign', entryPath: LANDING } })).structuredContent as { tiles: unknown[]; message: string };
      assert.strictEqual(none.tiles.length, 0);
      assert.match(none.message, /campaignSheet: true/);
    });
  });

  describe('show_open_design_questions in a host with MCP Apps', () => {
    let client: Client;
    before(async () => {
      client = await connect(root, true);
    });
    after(() => client?.close());

    it('is model-visible against the preview resource and returns the checked questions as the ask target', async () => {
      const tool = (await client.listTools()).tools.find((t) => t.name === 'show_open_design_questions');
      assert.strictEqual((tool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri, PREVIEW_APP_URI);
      const shown = await client.callTool({ name: 'show_open_design_questions', arguments: { questions: QUESTIONS } });
      const target = shown.structuredContent as { view: string; title: string; questions: Array<{ kind: string }> };
      assert.strictEqual(target.view, 'ask');
      assert.strictEqual(target.title, 'A few quick questions');
      assert.deepStrictEqual(target.questions.map((q) => q.kind), ['single', 'multi']);
      assert.match(text(shown), /od-answers/);
    });

    it('refuses a raw image URL, naming the allowed references', async () => {
      const refused = await client.callTool({ name: 'show_open_design_questions', arguments: { questions: [{ id: 'look', text: 'Which?', options: [{ id: 'a', label: 'A', imageRef: 'https://example.com/a.png' }] }] } });
      assert.strictEqual(refused.isError, true);
      assert.match(text(refused), /designSystem:<id>/);
    });

    it('serves an option picture by imageRef through the app-only tool', async () => {
      const all = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { view: 'design-systems' } })).structuredContent as { systems: Array<{ id: string }> };
      const picture = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { imageRef: `designSystem:${all.systems[0].id}` } })).structuredContent as { swatches?: string[] };
      assert.ok(picture.swatches && picture.swatches.length > 0);
      const shot = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { imageRef: `artifact:${LANDING}` } })).structuredContent as { html?: string };
      assert.match(shot.html ?? '', /Landing/);
    });
  });

  describe('a host without MCP Apps (Codex, Claude Code terminal)', () => {
    let client: Client;
    before(async () => {
      client = await connect(root, false);
    });
    after(() => client?.close());

    it('lists neither picker tool but keeps show_open_design_artifact', async () => {
      const names = (await client.listTools()).tools.map((t) => t.name);
      assert.ok(names.includes('show_open_design_artifact'));
      assert.ok(!names.includes('show_open_design_examples'));
      assert.ok(!names.includes('show_open_design_design_systems'));
      assert.ok(!names.includes('show_open_design_questions'));
    });

    it('answers a questions call anyway with one numbered message to ask', async () => {
      const asked = await client.callTool({ name: 'show_open_design_questions', arguments: { questions: QUESTIONS } });
      assert.strictEqual(asked.structuredContent, undefined);
      assert.match(text(asked), /Ask the user these in one message:\n1\. Where will it be used\?: Printed \/ On screen \/ You pick\n2\. Which moods\? \(pick any\)/);
    });

    it('answers a picker call anyway with a short text list naming the list tool', async () => {
      const examples = await client.callTool({ name: 'show_open_design_examples', arguments: { mode: 'deck' } });
      assert.strictEqual(examples.structuredContent, undefined);
      assert.match(text(examples), /list_open_design_skills/);
      assert.match(text(examples), /- od:deck:/);
      const systems = await client.callTool({ name: 'show_open_design_design_systems', arguments: {} });
      assert.match(text(systems), /list_open_design_design_systems/);
    });
  });

  describe('in a reference host page (real browser)', () => {
    let client: Client;
    let browser: import('puppeteer-core').Browser | undefined;
    let page: import('puppeteer-core').Page;
    let resource: string;
    const messages: string[] = [];
    const calledTools: string[] = [];
    const openedLinks: string[] = [];
    // Set to give picker states a gallery link, as a live gallery-site.json would (the bundled one isn't live).
    let fakeGalleryUrl: string | undefined;

    before(async function () {
      const found = await findBrowser();
      if (!found.ok) this.skip();
      client = await connect(root, true);
      const esbuild = await import('esbuild');
      const hostJs = (
        await esbuild.build({
          stdin: {
            contents: `
              import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
              window.startHost = async (html, toolInput, toolResult, opts = {}) => {
                document.body.innerHTML = '';
                const frame = document.createElement('iframe');
                frame.setAttribute('sandbox', 'allow-scripts');
                frame.style.cssText = 'width:1000px;height:640px;border:0';
                document.body.appendChild(frame);
                const bridge = new AppBridge(null, { name: 'reference-host', version: '1.0.0' }, opts.noLinks ? { serverTools: {}, message: { text: {} } } : { serverTools: {}, message: { text: {} }, openLinks: {} });
                bridge.onopenlink = async ({ url }) => { await window.hostOpenLink(url); return {}; };
                bridge.oncalltool = (params) => window.hostCallTool(JSON.stringify(params)).then(JSON.parse);
                bridge.onmessage = async (params) => { await window.hostMessage(JSON.stringify(params)); return {}; };
                bridge.setHostContext({ theme: 'dark', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] });
                const initialized = new Promise((resolve) => { bridge.oninitialized = resolve; });
                await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
                frame.srcdoc = html;
                await initialized;
                await bridge.sendToolInput({ arguments: toolInput });
                await bridge.sendToolResult(toolResult);
              };`,
            resolveDir: __dirname,
          },
          bundle: true,
          format: 'iife',
          platform: 'browser',
          write: false,
        })
      ).outputFiles[0].text;
      const puppeteer = (await import('puppeteer-core')).default;
      browser = await puppeteer.launch({ executablePath: found.executablePath, headless: true, args: process.getuid?.() === 0 ? ['--no-sandbox'] : [] });
      page = await browser.newPage();
      await page.setViewport({ width: 1100, height: 760 });
      await page.exposeFunction('hostCallTool', async (json: string) => {
        const params = JSON.parse(json) as { name: string };
        calledTools.push(params.name);
        const result = (await client.callTool(params)) as CallToolResult;
        const state = result.structuredContent as { view?: string; galleryUrl?: string } | undefined;
        if (fakeGalleryUrl && state && (state.view === 'examples' || state.view === 'design-systems')) state.galleryUrl = fakeGalleryUrl;
        return JSON.stringify(result);
      });
      await page.exposeFunction('hostOpenLink', async (url: string) => {
        openedLinks.push(url);
      });
      await page.exposeFunction('hostMessage', async (json: string) => {
        messages.push(text(JSON.parse(json)));
      });
      await page.setContent(`<!doctype html><html><body><script>${hostJs}</script></body></html>`);
      resource = ((await client.readResource({ uri: PREVIEW_APP_URI })).contents[0] as { text: string }).text;
    });

    after(async () => {
      await browser?.close();
      await client?.close();
    });

    const appFrame = () => page.frames().find((f) => f !== page.mainFrame() && f.parentFrame() === page.mainFrame())!;
    async function show(tool: string, input: Record<string, unknown>, ready: string, opts: { noLinks?: boolean } = {}): Promise<void> {
      const result = await client.callTool({ name: tool, arguments: input });
      await page.evaluate((html, i, r, o) => (window as unknown as { startHost(...a: unknown[]): Promise<void> }).startHost(html, i, r, o), resource, input, result as unknown as Record<string, unknown>, opts);
      await until(async () => !!(await appFrame()?.$(ready).catch(() => null)), ready);
    }
    async function clickAndWaitForMessage(selector: string): Promise<string> {
      const before = messages.length;
      await appFrame().click(selector);
      await until(() => messages.length > before, `a chat message after clicking ${selector}`);
      return messages[messages.length - 1];
    }

    it('gallery: lazy previews, a mode chip, and "Remix this" posts the skill id without copying files', async () => {
      await show('show_open_design_examples', {}, '[data-remix]');
      const app = appFrame();
      await until(async () => !!(await app.$('.od-card-frame iframe, .od-card-frame .od-message:not(:empty)')), 'a card preview');
      await until(async () => (await app.$$('.od-card-frame iframe')).length > 0, 'a loaded preview frame');
      const id = await app.$eval('[data-remix]', (el) => (el as HTMLElement).dataset.remix!);
      const filesBefore = await fs.readdir(path.join(root, '.open-design'));
      const message = await clickAndWaitForMessage('[data-remix]');
      assert.ok(message.includes(`"${id}"`) && message.includes('remix_open_design_example'), message);
      assert.deepStrictEqual(await fs.readdir(path.join(root, '.open-design')), filesBefore, 'the page copied nothing');

      const chip = await app.$$eval('[data-mode-filter]', (els) => (els as HTMLElement[]).map((e) => e.dataset.modeFilter!).find((m) => m));
      if (chip) {
        await app.click(`[data-mode-filter="${chip}"]`);
        await until(async () => (await app.$eval(`[data-mode-filter="${chip}"]`, (el) => el.classList.contains('active')).catch(() => false)) === true, 'the chip to apply');
        const modes = await app.$$eval('.od-card-meta', (els) => els.map((e) => e.textContent));
        assert.ok(modes.every((m) => m === chip), `only ${chip} cards`);
      }
    });

    it('gallery link: absent while the gallery is not live, opens through the host when it is, hidden without link support', async () => {
      await show('show_open_design_examples', {}, '[data-remix]');
      assert.strictEqual(await appFrame().$('#od-gallery'), null);
      fakeGalleryUrl = 'https://gallery.example/kit/examples/';
      try {
        await show('show_open_design_examples', {}, '#od-gallery');
        await appFrame().click('#od-gallery');
        await until(() => openedLinks.includes(fakeGalleryUrl!), 'the host to open the gallery link');
        await show('show_open_design_design_systems', {}, '#od-gallery');
        await show('show_open_design_design_systems', {}, '[data-ds]', { noLinks: true });
        assert.strictEqual(await appFrame().$('#od-gallery'), null);
      } finally {
        fakeGalleryUrl = undefined;
      }
    });

    it('design systems: opening a tile shows its Visualize page; "Use this design system" names the id', async () => {
      await show('show_open_design_design_systems', {}, '[data-ds]');
      const app = appFrame();
      const id = await app.$eval('.od-ds-tile:not(.active)', (el) => (el as HTMLElement).dataset.ds!);
      await app.click(`[data-ds="${id}"]`);
      await until(async () => !!(await app.$('.od-ds-frame iframe')), 'the Visualize frame');
      assert.strictEqual(await app.$eval('.od-ds-frame iframe', (el) => el.getAttribute('sandbox')), '');
      const message = await clickAndWaitForMessage('[data-use]');
      assert.ok(message.includes(`"${id}"`) && message.includes('set_active_design_system'), message);
    });

    it('style tiles: "Use as design system" asks for next: "save-design-system"', async () => {
      await show('show_open_design_artifact', { explorationId: 'tiles-1' }, '[data-save-tile]');
      const message = await clickAndWaitForMessage('[data-save-tile="b"]');
      assert.match(message, /"Cool" \(b\)/);
      assert.match(message, /next: "save-design-system"/);
    });

    it('questions: taps become one answers message, and nothing else is called', async () => {
      await show('show_open_design_questions', { questions: QUESTIONS }, '#od-ask-send');
      const app = appFrame();
      calledTools.length = 0;
      assert.strictEqual(await app.$eval('#od-ask-send', (el) => (el as HTMLButtonElement).disabled), true, 'Send waits for an answer');
      assert.strictEqual(await app.$$eval('[data-q="where"]', (els) => els.length), 3, 'two options and "You pick"');
      await app.click('[data-q="where"][data-option="printed"]');
      await app.click('[data-q="mood"][data-option="dark"]');
      await app.click('[data-q="mood"][data-option="bold"]');
      const message = await clickAndWaitForMessage('#od-ask-send');
      assert.strictEqual(message.split('\n')[0], 'Answers: where = Printed; mood = Dark, Bold');
      assert.match(message, /<!-- od-answers \{"where":"printed","mood":\["dark","bold"\]\} -->/);
      await until(async () => (await app.$eval('#od-ask-status', (el) => el.textContent ?? '')) === 'Sent.', 'the sent state');
      assert.deepStrictEqual(calledTools, [], 'the page called no tool');
    });

    it('artifact: follows an edit in place, without a new tool result, and holds it while commenting', async () => {
      await show('show_open_design_artifact', { entryPath: LANDING }, '#od-preview');
      const app = appFrame();
      const toastText = () => app.$eval('.od-toast', (el) => ((el as HTMLElement).hidden ? '' : el.textContent ?? '')).catch(() => '');
      const file = path.join(root, LANDING);
      // Comment mode on: the edit waits.
      await app.click('[data-mode="comment"]');
      await new Promise((r) => setTimeout(r, 400));
      await fs.writeFile(file, '<!doctype html><html><head><title>Landing page</title></head><body><h1 class="landing">Landing, edited</h1></body></html>');
      await new Promise((r) => setTimeout(r, 4500));
      assert.notStrictEqual(await toastText(), 'Updated to the latest version.');
      // Back to view: it reloads.
      await app.click('[data-mode="view"]');
      await until(async () => (await toastText()) === 'Updated to the latest version.', 'the inline view to follow the edit');
    });

    it('revisionOnly: changes after an edit and a saved comment, and refuses a path outside the workspace', async () => {
      const rev = async () => ((await client.callTool({ name: 'get_open_design_preview_state', arguments: { entryPath: MASTER, revisionOnly: true } })) as CallToolResult).structuredContent?.revision as string;
      const first = await rev();
      assert.match(first, /^[0-9a-f]{16}$/);
      assert.strictEqual(await rev(), first);
      await fs.appendFile(path.join(root, MASTER), '\n<!-- edited -->');
      const second = await rev();
      assert.notStrictEqual(second, first);
      const now = new Date().toISOString();
      const comment = { id: 'rev-1', selector: 'h1', note: 'Bigger', status: 'open', createdAt: now, updatedAt: now };
      await client.callTool({ name: 'save_open_design_comment', arguments: { entryPath: MASTER, comment } });
      const third = await rev();
      assert.notStrictEqual(third, second);
      await client.callTool({ name: 'save_open_design_comment', arguments: { entryPath: MASTER, deleteId: 'rev-1' } });
      const outside = (await client.callTool({ name: 'get_open_design_preview_state', arguments: { entryPath: '../x.html', revisionOnly: true } })) as CallToolResult;
      assert.ok(outside.isError);
    });

    it('artifact: feedback chips post a quick reply', async () => {
      await show('show_open_design_artifact', { entryPath: LANDING }, '[data-feedback]');
      const message = await clickAndWaitForMessage('[data-feedback="change"]');
      assert.match(message, /change something in the Open Design artifact "\.open-design\/launch-landing\/index\.html"/);
    });

    it('campaign: error dot and "Fix this piece", and a page-type tile opens the artifact view', async () => {
      await show('show_open_design_artifact', { entryPath: MASTER, campaign: true }, '[data-fix]');
      const app = appFrame();
      assert.strictEqual(await app.$$eval('.od-dot.bad', (els) => els.length), 1);
      assert.match(await app.$eval('.od-campaign-tile.bad', (el) => el.textContent ?? ''), /overflow/);
      const message = await clickAndWaitForMessage('[data-fix="1"]');
      assert.match(message, /banner-mobile/);
      assert.match(message, /overflow: The headline overflows/);

      await app.click('button[data-open="2"]');
      await until(async () => /Landing page/.test(await app.$eval('.od-title', (el) => el.textContent ?? '').catch(() => '')) && !!(await app.$('#od-preview')), 'the artifact view');
      await app.click('#od-back');
      await until(async () => !!(await app.$('[data-fix]')), 'the campaign view again');
    });
  });
});
