// Claude Desktop previews (openspec inline-preview-in-place and code-tab-browser-pane):
// what register says in a host that shows MCP Apps, and the Browser pane's launch entry.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ContentIndex, launchPortFor } from '@feimacode/open-design-agent-kit-core';
import * as tools from '../../tools';
import type { ToolContext } from '../../tools';
import { createFileActiveDesignSystemStore } from '../../store';

const ENTRY = '.open-design/page/page.html';

async function makeContext(rendersMcpApps: boolean): Promise<ToolContext> {
  const assetsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'od-desktop-assets-'));
  await fs.mkdir(path.join(assetsRoot, 'craft'), { recursive: true });
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'od-desktop-workspace-'));
  await fs.mkdir(path.join(workspaceRoot, path.dirname(ENTRY)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, ENTRY), '<!doctype html><title>Page</title><h1>Page</h1>');
  return { contentIndex: new ContentIndex(assetsRoot), store: createFileActiveDesignSystemStore(workspaceRoot), workspaceRoot, outputDir: '.open-design', assetsRoot, rendersMcpApps };
}

const register = (ctx: ToolContext) => tools.registerArtifact(ctx, { entryPath: ENTRY, kind: 'html', title: 'Page' });

describe('Desktop previews', () => {
  afterEach(() => tools.closePreviews());

  it('register in an MCP Apps host asks for the inline view once, then says the copy updates by itself', async () => {
    const ctx = await makeContext(true);
    const first = await register(ctx);
    assert.match(first, /Call show_open_design_artifact with this entryPath/);
    assert.doesNotMatch(first, /open_open_design_preview/);
    await tools.showArtifact(ctx, { entryPath: ENTRY });
    const second = await register(ctx);
    assert.match(second, /updates by itself; don't show it again/);
    assert.doesNotMatch(second, /open_open_design_preview/);
  });

  it('register elsewhere still suggests the browser preview', async () => {
    assert.match(await register(await makeContext(false)), /open_open_design_preview/);
  });

  it('set_up_open_design_browser_pane writes the launch entry once, keeping other configurations', async () => {
    const ctx = await makeContext(false);
    await fs.mkdir(path.join(ctx.workspaceRoot, '.claude'), { recursive: true });
    const web = { name: 'web', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: 3000 };
    await fs.writeFile(path.join(ctx.workspaceRoot, '.claude', 'launch.json'), JSON.stringify({ version: '0.0.1', configurations: [web] }));
    const first = await tools.setUpBrowserPane(ctx, '9.9.9');
    assert.match(first, /Updated .*launch\.json with the open-design-preview configuration/);
    assert.match(first, /Tell the user once/);
    const config = JSON.parse(await fs.readFile(path.join(ctx.workspaceRoot, '.claude', 'launch.json'), 'utf8'));
    assert.deepStrictEqual(config.configurations[0], web);
    assert.strictEqual(config.configurations[1].name, 'open-design-preview');
    assert.strictEqual(config.configurations[1].port, launchPortFor(ctx.workspaceRoot));
    assert.ok(config.configurations[1].runtimeArgs.includes('@feimacode/open-design-agent-kit@9.9.9'));
    const again = await tools.setUpBrowserPane(ctx, '9.9.9');
    assert.match(again, /already has the open-design-preview configuration/);
    assert.doesNotMatch(again, /Tell the user once/);
  });

  it('refuses a malformed launch.json without changing it', async () => {
    const ctx = await makeContext(false);
    await fs.mkdir(path.join(ctx.workspaceRoot, '.claude'), { recursive: true });
    await fs.writeFile(path.join(ctx.workspaceRoot, '.claude', 'launch.json'), '{ nope');
    assert.match(await tools.setUpBrowserPane(ctx, '9.9.9'), /Couldn't set up the Browser pane/);
    assert.strictEqual(await fs.readFile(path.join(ctx.workspaceRoot, '.claude', 'launch.json'), 'utf8'), '{ nope');
  });
});
