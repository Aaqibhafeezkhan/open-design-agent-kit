/// <reference lib="dom" />
// The preview MCP App end to end (openspec add-mcp-app-preview): the real
// server over stdio, driven by a scripted MCP client with and without the
// MCP Apps extension, then rendered in a reference host page (ext-apps'
// AppBridge in headless Chromium; skipped when no browser is installed).
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { findBrowser, MCP_APP_MIME_TYPE, MCP_APPS_EXTENSION_ID, PREVIEW_APP_URI, readArtifactComments, writeArtifactManifest } from '@feimacode/open-design-agent-kit-core';

const ENTRY = '.open-design/poster/index.html';
const POSTER = `<!doctype html><html><head><title>Poster</title><link rel="stylesheet" href="poster.css"></head>
<body><h1 class="headline">Coffee, delivered</h1><p class="sub">Fresh beans monthly.</p></body></html>`;

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-mcp-app-e2e-'));
  await fs.mkdir(path.join(root, '.open-design/poster'), { recursive: true });
  await fs.writeFile(path.join(root, ENTRY), POSTER);
  await fs.writeFile(path.join(root, '.open-design/poster/poster.css'), 'body { margin: 0; font-family: sans-serif; } .headline { padding: 40px; }');
  await writeArtifactManifest({ workspaceRoot: root, entryPath: ENTRY, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Coffee poster' } });
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

describe('preview MCP App over MCP', function () {
  this.timeout(60000);
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

    it('lists the resource, links the show tool to it, and marks the page tools app-only', async () => {
      const { resources } = await client.listResources();
      assert.deepStrictEqual(
        resources.map((r) => [r.uri, r.mimeType]),
        [[PREVIEW_APP_URI, MCP_APP_MIME_TYPE]],
      );
      const read = await client.readResource({ uri: PREVIEW_APP_URI });
      const content = read.contents[0] as { text: string; mimeType: string; _meta?: { ui?: { csp?: { resourceDomains?: string[] } } } };
      assert.strictEqual(content.mimeType, MCP_APP_MIME_TYPE);
      assert.match(content.text, /<div id="root"><\/div>/);
      assert.ok(content._meta?.ui?.csp?.resourceDomains?.includes('https://fonts.gstatic.com'));

      const { tools } = await client.listTools();
      const byName = new Map(tools.map((t) => [t.name, t]));
      assert.deepStrictEqual((byName.get('show_open_design_artifact')?._meta as { ui?: unknown })?.ui, { resourceUri: PREVIEW_APP_URI });
      for (const name of ['save_open_design_comment', 'get_open_design_preview_state']) {
        assert.deepStrictEqual((byName.get(name)?._meta as { ui?: { visibility?: string[] } })?.ui?.visibility, ['app'], name);
      }
    });

    it('returns the show target as structured content and text without the browser hint', async () => {
      const result = await client.callTool({ name: 'show_open_design_artifact', arguments: { entryPath: ENTRY } });
      assert.deepStrictEqual(result.structuredContent, { view: 'artifact', entryPath: ENTRY, title: 'Coffee poster' });
      assert.match(text(result), /Showing "Coffee poster"/);
      assert.ok(!text(result).includes('open_open_design_preview'));
    });
  });

  describe('a host without MCP Apps (Claude Code terminal, Codex)', () => {
    let client: Client;
    before(async () => {
      client = await connect(root, false);
    });
    after(() => client?.close());

    it('hides the app-only tools and gets the text result with the browser hint', async () => {
      const names = (await client.listTools()).tools.map((t) => t.name);
      assert.ok(names.includes('show_open_design_artifact'));
      assert.ok(!names.includes('save_open_design_comment'));
      assert.ok(!names.includes('get_open_design_preview_state'));
      const result = await client.callTool({ name: 'show_open_design_artifact', arguments: { entryPath: ENTRY } });
      assert.ok(!result.isError);
      assert.match(text(result), /No open comments/);
      assert.match(text(result), /open_open_design_preview/);
    });
  });

  describe('in a reference host page (real browser)', () => {
    // Imported lazily: only this block needs a browser and esbuild.
    let client: Client;
    let browser: import('puppeteer-core').Browser | undefined;
    let page: import('puppeteer-core').Page;
    const messages: string[] = [];

    before(async function () {
      const found = await findBrowser();
      if (!found.ok) this.skip();
      client = await connect(root, true);
      const esbuild = await import('esbuild');
      // The host: ext-apps' AppBridge over postMessage to a sandboxed frame holding the resource,
      // forwarding the page's tool calls to the real server and recording chat messages.
      const hostJs = (
        await esbuild.build({
          stdin: {
            contents: `
              import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
              window.startHost = async (html, toolInput, toolResult) => {
                const frame = document.createElement('iframe');
                frame.setAttribute('sandbox', 'allow-scripts');
                frame.style.cssText = 'width:1000px;height:640px;border:0';
                document.body.appendChild(frame);
                const bridge = new AppBridge(null, { name: 'reference-host', version: '1.0.0' }, { serverTools: {}, message: { text: {} }, openLinks: {} });
                bridge.oncalltool = (params) => window.hostCallTool(JSON.stringify(params)).then(JSON.parse);
                bridge.onmessage = async (params) => { await window.hostMessage(JSON.stringify(params)); return {}; };
                bridge.setHostContext({ theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] });
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
      await page.exposeFunction('hostCallTool', async (json: string) => JSON.stringify(await client.callTool(JSON.parse(json))));
      await page.exposeFunction('hostMessage', async (json: string) => {
        messages.push(text(JSON.parse(json)));
      });
      await page.setContent(`<!doctype html><html><body><script>${hostJs}</script></body></html>`);

      const resource = (await client.readResource({ uri: PREVIEW_APP_URI })).contents[0] as { text: string };
      const input = { entryPath: ENTRY };
      const result = await client.callTool({ name: 'show_open_design_artifact', arguments: input });
      await page.evaluate((html, i, r) => (window as unknown as { startHost(...a: unknown[]): Promise<void> }).startHost(html, i, r), resource.text, input, result as unknown as Record<string, unknown>);
    });

    after(async () => {
      await browser?.close();
      await client?.close();
    });

    const appFrame = () => page.frames()[1];
    const designFrame = async () => {
      for (let i = 0; i < 100; i++) {
        const f = appFrame()?.childFrames()[0];
        if (f && (await f.$('h1.headline').catch(() => null))) return f;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('the design frame never rendered');
    };

    it('renders the design inline from its standalone export', async () => {
      const frame = await designFrame();
      assert.strictEqual(await frame.$eval('h1.headline', (el) => getComputedStyle(el).paddingTop), '40px', 'the local stylesheet was inlined');
      assert.match(await appFrame().$eval('.od-title', (el) => el.textContent ?? ''), /Coffee poster/);
    });

    it('saves a comment through the app-only tool and hands the open comments to the chat', async () => {
      const app = appFrame();
      await app.click('[data-mode="comment"]');
      const frame = await designFrame();
      // Wait for the bridge to enter Comment mode, then click the headline.
      for (let i = 0; i < 50 && !(await frame.evaluate(() => document.getElementById('od-bridge-pick') !== null)); i++) await new Promise((r) => setTimeout(r, 100));
      await frame.click('h1.headline');
      await app.waitForSelector('#od-comment-text', { timeout: 5000 });
      await app.type('#od-comment-text', 'too dark');
      await app.click('#od-comment-save');

      let saved = await readArtifactComments(root, ENTRY);
      for (let i = 0; i < 50 && saved.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 100));
        saved = await readArtifactComments(root, ENTRY);
      }
      assert.strictEqual(saved.length, 1);
      assert.strictEqual(saved[0].note, 'too dark');
      assert.strictEqual(saved[0].selector.includes('headline'), true);
      assert.strictEqual(saved[0].host, 'mcp-app');
      const listed = text(await client.callTool({ name: 'get_open_design_artifact', arguments: { entryPath: ENTRY } }));
      assert.match(listed, /"note": "too dark"/);

      await app.click('#od-apply');
      for (let i = 0; i < 50 && messages.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
      assert.strictEqual(messages.length, 1);
      assert.match(messages[0], new RegExp(`"${ENTRY.replace(/\./g, '\\.')}"`));
      assert.ok(messages[0].includes(saved[0].id));
      for (let i = 0; i < 50 && (await readArtifactComments(root, ENTRY))[0].status !== 'sent'; i++) await new Promise((r) => setTimeout(r, 100));
      assert.strictEqual((await readArtifactComments(root, ENTRY))[0].status, 'sent');
    });

    it('asks the chat for an export instead of downloading', async () => {
      const before = messages.length;
      await appFrame().click('[data-export="png"]');
      for (let i = 0; i < 50 && messages.length === before; i++) await new Promise((r) => setTimeout(r, 100));
      assert.match(messages[before], /export_open_design_artifact with format "png"/);
    });
  });
});
