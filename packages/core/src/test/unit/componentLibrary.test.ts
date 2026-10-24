import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ContentIndex } from '../../content/contentIndex';
import { chooseLibrary, detectApp, prepareComponentLibrary, scanComponentCandidates, trimHtmlForInstructions, validateComponentLibraryRecord } from '../../generation/componentLibrary';
import { readArtifact, writeArtifactManifest } from '../../vendored/artifactCreate';

const ASSETS = path.resolve(__dirname, '../../../../content/assets/open-design');
const index = new ContentIndex(ASSETS);
const getDesignSystem = (id: string) => index.getDesignSystem(id);

const PRICING = `<!doctype html><html><head><style>:root{--bg:#fff;--fg:#111;--accent:#2563eb}</style></head><body>
<nav class="top-bar"><a href="#">Home</a></nav>
<section class="hero"><h1>Pricing</h1><button class="btn btn-primary">Start</button></section>
<section class="plans">
  <div class="plan-card"><h2>Free</h2><button class="btn">Pick</button></div>
  <div class="plan-card"><h2>Pro</h2><button class="btn">Pick</button></div>
  <div class="plan-card"><h2>Team</h2><button class="btn">Pick</button></div>
  <div class="plan-card featured"><h2>Enterprise</h2><button class="btn">Talk to us</button></div>
</section>
<svg class="icon"><path class="p"/><path class="p"/></svg>
<script>console.log("hidden")</script>
</body></html>`;

async function workspace(pkg?: unknown, files: Record<string, string> = {}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-ext-complib-'));
  if (pkg !== undefined) await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(pkg));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await fs.writeFile(path.join(root, rel), content);
  }
  return root;
}

async function registerDesign(root: string, entryPath: string, html = PRICING, extra: Record<string, unknown> = {}): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, entryPath)), { recursive: true });
  await fs.writeFile(path.join(root, entryPath), html);
  await writeArtifactManifest({ workspaceRoot: root, entryPath, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Pricing page', ...extra } });
}

const MUI_APP = { dependencies: { react: '^19.0.0', '@mui/material': '^7.0.0' } };

describe('scanComponentCandidates', () => {
  it('finds repeated groups and controls, and skips svg internals', () => {
    const found = scanComponentCandidates([{ entryPath: 'a.html', html: PRICING }]);
    const card = found.find((c) => c.selector === 'div.plan-card');
    assert.ok(card, 'the repeated card');
    assert.strictEqual(card.count, 3, 'the featured card has a different class set');
    assert.ok(found.some((c) => c.selector === 'nav.top-bar'), 'a landmark seen once');
    assert.ok(found.some((c) => c.selector === 'section.hero'), 'a top-level section');
    assert.ok(found.some((c) => c.selector === 'button.btn'));
    assert.ok(!found.some((c) => c.selector === 'path.p'), 'svg internals are skipped');
  });

  it('ranks what several designs share first, and is deterministic', () => {
    const other = '<body><nav class="top-bar"></nav><div class="hero2"></div><div class="hero2"></div><div class="hero2"></div></body>';
    const input = [
      { entryPath: 'a.html', html: PRICING },
      { entryPath: 'b.html', html: other },
    ];
    const found = scanComponentCandidates(input);
    assert.strictEqual(found[0].selector, 'nav.top-bar');
    assert.deepStrictEqual(found[0].artifacts, ['a.html', 'b.html']);
    assert.deepStrictEqual(scanComponentCandidates(input), found);
  });
});

describe('chooseLibrary', () => {
  it('picks MUI for an MUI app and asks when it can\'t tell', async () => {
    const mui = (await detectApp(await workspace(MUI_APP)))!;
    assert.deepStrictEqual(chooseLibrary(mui, 'auto'), { library: 'mui', installed: true });
    const bare = (await detectApp(await workspace({ dependencies: { react: '^19.0.0' } })))!;
    assert.strictEqual((chooseLibrary(bare, 'auto') as { error: string }).error, 'needs-choice');
  });

  it('picks shadcn from components.json, and reports a Vue app', async () => {
    const shadcn = (await detectApp(await workspace({ dependencies: { react: '^19.0.0' } }, { 'components.json': '{}' })))!;
    assert.deepStrictEqual(chooseLibrary(shadcn, 'auto'), { library: 'shadcn', installed: true });
    const vue = (await detectApp(await workspace({ dependencies: { vue: '^3.0.0' } })))!;
    assert.deepStrictEqual(chooseLibrary(vue, 'auto'), { error: 'unsupported-framework', found: ['vue'] });
  });

  it('finds the app above the output folder and the lock file in a monorepo root', async () => {
    const root = await workspace({ private: true }, { 'pnpm-lock.yaml': '', 'apps/web/package.json': JSON.stringify(MUI_APP), 'apps/web/src/.keep': '' });
    const app = (await detectApp(root, 'apps/web/src/components'))!;
    assert.strictEqual(app.appDir, 'apps/web');
    assert.strictEqual(app.packageManager, 'pnpm');
    assert.strictEqual(app.hasSrcDir, true);
  });
});

describe('prepareComponentLibrary', () => {
  it('returns staged instructions and writes nothing', async () => {
    const root = await workspace(MUI_APP);
    await registerDesign(root, '.open-design/pricing/pricing.html', PRICING, { designSystemId: 'flat' });
    const before = await fs.readdir(root, { recursive: true });
    const result = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['.open-design/pricing/pricing.html'], library: 'auto', getDesignSystem });
    assert.ok(result.ok, result.text);
    assert.deepStrictEqual(await fs.readdir(root, { recursive: true }), before);
    assert.match(result.text, /Stage 1/);
    assert.match(result.text, /\.open-design\/pricing\/components\.md/);
    assert.match(result.text, /Stop here until they answer/);
    assert.match(result.text, /"main": "#f2673c"/, 'the flat theme');
    assert.match(result.text, /div\.plan-card` ×3/);
    assert.match(result.text, /ComponentGallery\.tsx/);
    assert.match(result.text, /components\/PricingPage/);
    assert.doesNotMatch(result.text, /console\.log/, 'script bodies are trimmed');
  });

  it('asks for stories when Storybook is present, and for an install when the library is missing', async () => {
    const root = await workspace({ dependencies: { react: '^19.0.0' }, devDependencies: { '@storybook/react': '^8.0.0' } }, { 'yarn.lock': '' });
    await registerDesign(root, 'p.html');
    const result = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['p.html'], library: 'mui', getDesignSystem });
    assert.ok(result.ok, result.text);
    assert.match(result.text, /stories\.tsx/);
    assert.doesNotMatch(result.text, /ComponentGallery/);
    assert.match(result.text, /yarn add @mui\/material @emotion\/react @emotion\/styled/);
    assert.match(result.text, /Ask the user before running/);
  });

  it('themes from the page\'s own :root when there is no design system, and says so when there is neither', async () => {
    const root = await workspace({ dependencies: { react: '^19.0.0' } }, { 'components.json': '{}' });
    await registerDesign(root, 'p.html');
    await registerDesign(root, 'q.html', '<body><button>Go</button></body>');
    const themed = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['p.html'], getDesignSystem });
    assert.ok(themed.ok);
    assert.match(themed.text, /--primary: #2563eb/);
    const bare = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['q.html'], getDesignSystem });
    assert.ok(bare.ok);
    assert.match(bare.text, /There is no theme source/);
    assert.match(bare.text, /extract_open_design_design_system/);
  });

  it('covers every screen of a collection', async () => {
    const root = await workspace(MUI_APP);
    for (const [i, name] of ['one', 'two', 'three'].entries()) {
      await registerDesign(root, `.open-design/${name}/${name}.html`, PRICING, { title: name, collectionId: 'shop', collectionName: 'Shop', screenIndex: i });
    }
    const result = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', collectionId: 'shop', getDesignSystem });
    assert.ok(result.ok, result.text);
    for (const name of ['one', 'two', 'three']) assert.match(result.text, new RegExp(`Entry file: \`\\.open-design/${name}/${name}\\.html\``));
    assert.match(result.text, /3 of 3 designs/);
    assert.match(result.text, /components\/Shop/);
  });

  it('returns the documented errors', async () => {
    const root = await workspace({ dependencies: { vue: '^3.0.0' } });
    await registerDesign(root, 'p.html');
    await fs.writeFile(path.join(root, 'loose.html'), '<p>hi</p>');
    const call = (extra: Record<string, unknown>) =>
      prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['p.html'], getDesignSystem, ...extra });
    const codes = async (extra: Record<string, unknown>) => {
      const r = await call(extra);
      return r.ok ? 'ok' : r.code;
    };
    assert.strictEqual(await codes({ library: 'vuetify' }), 'unsupported-library');
    assert.strictEqual(await codes({ entryPaths: ['loose.html'] }), 'not-registered');
    assert.strictEqual(await codes({}), 'unsupported-framework');
    const noApp = await workspace();
    await registerDesign(noApp, 'p.html');
    const r = await prepareComponentLibrary({ workspaceRoot: noApp, outputDir: '.open-design', entryPaths: ['p.html'], getDesignSystem });
    assert.strictEqual(r.ok ? 'ok' : r.code, 'no-app');
  });

  it('records the set on the manifest, then switches to update mode and never deletes', async () => {
    const root = await workspace(MUI_APP);
    await registerDesign(root, 'p.html', PRICING, { metadata: { format: 'x' } });
    const record = {
      library: 'mui',
      outputDir: 'src/components/Pricing',
      themePath: 'src/components/Pricing/theme.ts',
      components: [
        { name: 'PlanCard', path: 'src/components/Pricing/PlanCard.tsx', sourceSelectors: ['div.plan-card'] },
        { name: 'Testimonial', path: 'src/components/Pricing/Testimonial.tsx', sourceSelectors: ['blockquote.quote'] },
      ],
    };
    const recorded = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['p.html'], record, getDesignSystem, now: () => new Date('2026-10-24T00:00:00Z') });
    assert.ok(recorded.ok, recorded.text);
    const manifest = (await readArtifact({ workspaceRoot: root, entryPath: 'p.html' }))!.manifest!;
    const metadata = manifest.metadata as Record<string, unknown>;
    assert.strictEqual(metadata.format, 'x', 'other metadata is kept');
    assert.deepStrictEqual(metadata.componentLibrary, { ...record, updatedAt: '2026-10-24T00:00:00.000Z' });

    const again = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['p.html'], getDesignSystem });
    assert.ok(again.ok);
    assert.match(again.text, /Update mode/);
    assert.match(again.text, /PlanCard: `src\/components\/Pricing\/PlanCard\.tsx`/);
    assert.match(again.text, /not found in the design any more[\s\S]*Testimonial/);
    assert.match(again.text, /do not delete their files/);
    assert.match(again.text, /Write it to `src\/components\/Pricing\/theme\.ts`/);
  });

  it('rejects a bad record and writes nothing', async () => {
    const root = await workspace(MUI_APP);
    await registerDesign(root, 'p.html');
    const r = await prepareComponentLibrary({ workspaceRoot: root, outputDir: '.open-design', entryPaths: ['p.html'], record: { library: 'mui', outputDir: '../x', themePath: 't.ts', components: [] }, getDesignSystem });
    assert.strictEqual(r.ok ? 'ok' : r.code, 'invalid-record');
    const manifest = (await readArtifact({ workspaceRoot: root, entryPath: 'p.html' }))!.manifest!;
    assert.strictEqual((manifest.metadata as Record<string, unknown> | undefined)?.componentLibrary, undefined);
  });
});

describe('validateComponentLibraryRecord', () => {
  it('caps the record at 4 KB', () => {
    const components = Array.from({ length: 60 }, (_, i) => ({ name: `Component${i}`, path: `src/components/Set/Component${i}.tsx`, sourceSelectors: ['div.something-long-enough'] }));
    const result = validateComponentLibraryRecord({ library: 'shadcn', outputDir: 'src/components/Set', themePath: 'src/components/Set/theme.css', components });
    assert.ok('error' in result && /4 KB/.test(result.error));
  });
});

describe('trimHtmlForInstructions', () => {
  it('trims script bodies and long data URIs', () => {
    const out = trimHtmlForInstructions(`<script>let x = 1;</script><img src="data:image/png;base64,${'A'.repeat(100)}">`);
    assert.strictEqual(out, '<script>/* script trimmed */</script><img src="data:…">');
  });
});
