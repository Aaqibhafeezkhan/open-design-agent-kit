// Links to the public gallery (openspec link-public-gallery): only while
// gallery-site.json says live, a filtered hub from the pickers, and a bundled
// design system's page on register.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ContentIndex, galleryHubUrl, loadGallerySite } from '@feimacode/open-design-agent-kit-core';
import * as tools from '../../tools';
import type { ToolContext } from '../../tools';
import { createFileActiveDesignSystemStore } from '../../store';

const SITE = 'https://gallery.example/kit/';

async function makeContext(live: boolean | undefined, rendersMcpApps = true): Promise<ToolContext> {
  const assetsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'od-gallery-assets-'));
  await fs.mkdir(path.join(assetsRoot, 'design-systems', 'acme'), { recursive: true });
  await fs.writeFile(path.join(assetsRoot, 'design-systems', 'acme', 'DESIGN.md'), '# Acme\n\nTokens here.');
  await fs.writeFile(path.join(assetsRoot, 'design-systems', 'acme', 'manifest.json'), JSON.stringify({ id: 'acme', name: 'Acme', category: 'SaaS', description: 'A SaaS brand.' }));
  await fs.mkdir(path.join(assetsRoot, 'examples', 'holo-hero'), { recursive: true });
  await fs.writeFile(path.join(assetsRoot, 'examples', 'holo-hero', 'SKILL.md'), ['---', 'name: holo-hero', 'description: A holographic hero.', 'od:', '  mode: prototype', '---', '', 'Body.'].join('\n'));
  await fs.writeFile(path.join(assetsRoot, 'examples', 'holo-hero', 'example.html'), '<!doctype html><h1>Holo</h1>');
  await fs.mkdir(path.join(assetsRoot, 'craft'), { recursive: true });
  if (live !== undefined) await fs.writeFile(path.join(assetsRoot, 'gallery-site.json'), JSON.stringify({ url: SITE, live }));
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'od-gallery-workspace-'));
  return { contentIndex: new ContentIndex(assetsRoot), store: createFileActiveDesignSystemStore(workspaceRoot), workspaceRoot, outputDir: '.open-design', assetsRoot, rendersMcpApps };
}

async function registerPage(ctx: ToolContext, designSystemId?: string): Promise<string> {
  await fs.mkdir(path.join(ctx.workspaceRoot, '.open-design', 'page'), { recursive: true });
  await fs.writeFile(path.join(ctx.workspaceRoot, '.open-design', 'page', 'page.html'), '<!doctype html><h1>Page</h1>');
  return tools.registerArtifact(ctx, { entryPath: '.open-design/page/page.html', kind: 'html', title: 'Page', ...(designSystemId ? { designSystemId } : {}) });
}

describe('gallery links', () => {
  it('hub URLs carry a query as the #q= filter', () => {
    const site = { url: SITE, live: true };
    assert.strictEqual(galleryHubUrl(site, 'examples', 'café'), `${SITE}examples/#q=caf%C3%A9`);
    assert.strictEqual(galleryHubUrl(site, 'design-systems'), `${SITE}design-systems/`);
  });

  it('an invalid gallery-site.json gives no settings', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-gallery-site-'));
    await fs.writeFile(path.join(root, 'gallery-site.json'), JSON.stringify({ url: 'gallery.example', live: true }));
    assert.strictEqual(await loadGallerySite(root), undefined);
  });

  for (const live of [false, undefined]) {
    it(`gives no links when the gallery is ${live === false ? 'not live' : 'not configured'}`, async () => {
      const ctx = await makeContext(live);
      const examples = await tools.showExamples(ctx, { query: 'holo' });
      assert.doesNotMatch(examples.text, /gallery/i);
      assert.strictEqual((examples.structuredContent as Record<string, unknown>).gallery, undefined);
      const systems = await tools.showDesignSystems(ctx, {});
      assert.strictEqual((systems.structuredContent as Record<string, unknown>).gallery, undefined);
      assert.doesNotMatch(await registerPage(ctx, 'acme'), /galleryUrl/);
    });
  }

  it('the pickers return the matching hub while live, filtered by the query', async () => {
    const ctx = await makeContext(true);
    const examples = await tools.showExamples(ctx, { query: 'holo' });
    assert.deepStrictEqual((examples.structuredContent as Record<string, unknown>).gallery, { url: `${SITE}examples/#q=holo` });
    assert.match(examples.text, /If the user is browsing/);
    const shortlist = await tools.showDesignSystems(ctx, { ids: ['acme'] });
    assert.deepStrictEqual((shortlist.structuredContent as Record<string, unknown>).gallery, { url: `${SITE}design-systems/` });
    const fallback = await tools.showDesignSystems(await makeContext(true, false), { query: 'acme' });
    assert.ok(fallback.text.includes(`${SITE}design-systems/#q=acme`));
  });

  it('register links a bundled design system, passed or active, and nothing else', async () => {
    const ctx = await makeContext(true);
    const passed = await registerPage(ctx, 'acme');
    assert.ok(passed.includes(`"galleryUrl":"${SITE}design-systems/acme/"`), passed);
    assert.match(passed, /first time you use this design system/);
    assert.doesNotMatch(await registerPage(ctx), /galleryUrl/);
    await ctx.store.set('acme');
    assert.ok((await registerPage(ctx)).includes(`${SITE}design-systems/acme/`));
    assert.doesNotMatch(await registerPage(ctx, 'nope'), /galleryUrl/);
  });
});
