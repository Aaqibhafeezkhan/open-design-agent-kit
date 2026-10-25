import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  composeRecentDesignsSection,
  DESIGN_HISTORY_LIMIT,
  lookSignatureFromHtml,
  loadRecentDesigns,
  readDesignHistory,
  recentDesignsFor,
  recordDesignHistory,
  upsertDesignHistory,
  type DesignHistoryEntry,
} from '../../workspace/designHistory';
import { composeInstructions } from '../../generation/composeInstructions';

const TOKEN_PAGE = `<!doctype html><html><head><style>
:root { --bg: #0e0f12; --fg: #f4f4f5; --accent: #ff5a1f; --font-display: 'Fraunces', serif; --font-body: "Inter", system-ui, sans-serif; }
body { background: var(--bg); font-family: var(--font-body); }
.hero { display: grid; grid-template-columns: 1fr 1fr; }
</style></head><body>
<section class="hero"><div><h1>Ship faster</h1><p>Copy.</p><a class="btn">Start</a></div><figure><img src="shot.png" alt=""></figure></section>
</body></html>`;

const PLAIN_PAGE = `<!doctype html><html><head><style>
body { background-color: #fafaf7; font-family: Georgia, serif; }
.cta { background: #2463eb; color: white; }
</style></head><body><main><section style="text-align:center"><h2>Hello</h2><button class="cta">Go</button></section></main></body></html>`;

const IMAGE_HERO = `<html><head><style>.hero{background:url(bg.jpg) center/cover;min-height:100vh}</style></head><body><header class="hero"><h1 style="font-family:'Playfair Display'">Night</h1></header></body></html>`;

async function tmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'od-history-'));
}

function entry(n: number, extra: Partial<DesignHistoryEntry> = {}): DesignHistoryEntry {
  return { entryPath: `.open-design/d${n}/d${n}.html`, title: `Design ${n}`, date: `2026-10-${String(1 + (n % 28)).padStart(2, '0')}T00:00:00.000Z`, signature: { theme: 'dark', accent: '#ff5a1f' }, ...extra };
}

describe('design history and variety (openspec add-variety-memory)', () => {
  it('reads a look signature from the token contract', () => {
    assert.deepStrictEqual(lookSignatureFromHtml(TOKEN_PAGE), { accent: '#ff5a1f', displayFont: 'Fraunces', bodyFont: 'Inter', theme: 'dark', hero: 'split' });
  });

  it('falls back to body, button and h1 styles, and leaves out the display font with no h1', () => {
    assert.deepStrictEqual(lookSignatureFromHtml(PLAIN_PAGE), { accent: '#2463eb', bodyFont: 'Georgia', theme: 'light', hero: 'centred' });
    assert.deepStrictEqual(lookSignatureFromHtml(IMAGE_HERO), { displayFont: 'Playfair Display', hero: 'full-bleed-image' });
    assert.deepStrictEqual(lookSignatureFromHtml('<p>Just text</p>'), { hero: 'none' });
  });

  it('adds an entry, updates it on re-registration and caps at 50', async () => {
    const root = await tmp();
    await upsertDesignHistory(root, entry(1));
    await upsertDesignHistory(root, entry(2));
    await upsertDesignHistory(root, { ...entry(1), title: 'Design 1, edited' });
    const history = await readDesignHistory(root);
    assert.deepStrictEqual(history.map((e) => e.title), ['Design 2', 'Design 1, edited']);
    for (let i = 3; i <= DESIGN_HISTORY_LIMIT + 2; i++) await upsertDesignHistory(root, entry(i));
    const capped = await readDesignHistory(root);
    assert.strictEqual(capped.length, DESIGN_HISTORY_LIMIT);
    assert.ok(!capped.some((e) => e.title === 'Design 2'), 'the oldest entry is dropped');
    assert.deepStrictEqual((await fs.readdir(path.join(root, '.open-design'))).filter((n) => n.endsWith('.tmp')), []);
  });

  it('records a registered page with its signature and no HTML', async () => {
    const root = await tmp();
    await fs.mkdir(path.join(root, '.open-design', 'a'), { recursive: true });
    await fs.writeFile(path.join(root, '.open-design', 'a', 'a.html'), TOKEN_PAGE);
    await recordDesignHistory(root, { entryPath: '.open-design/a/a.html', title: 'A', skillId: 'od:prototype:landing-page' });
    const [recorded] = await readDesignHistory(root);
    assert.strictEqual(recorded.signature.displayFont, 'Fraunces');
    assert.ok(!JSON.stringify(recorded).includes('Ship faster'));
    await recordDesignHistory(root, { entryPath: '.open-design/missing.html', title: 'Missing' });
    assert.strictEqual((await readDesignHistory(root)).length, 1, 'an unreadable page is skipped, not thrown');
  });

  it('lists unrelated designs to differ from, collection screens to match, and leaves sketches out', () => {
    const history = [entry(1), entry(2, { collectionId: 'onboarding' }), entry(3, { explorationId: 'e', directionId: 'bold' }), entry(4, { collectionId: 'onboarding' }), entry(5)];
    const unrelated = recentDesignsFor(history, {})!;
    assert.deepStrictEqual(unrelated.differFrom.map((d) => d.title), ['Design 5', 'Design 4', 'Design 2', 'Design 1']);
    const screen = recentDesignsFor(history, { collectionId: 'onboarding' })!;
    assert.deepStrictEqual(screen.consistentWith.map((d) => d.title), ['Design 4', 'Design 2']);
    assert.deepStrictEqual(screen.differFrom, []);
    assert.strictEqual(recentDesignsFor([], {}), undefined);
    assert.strictEqual(recentDesignsFor(history, {}, 2)!.differFrom.length, 2);
  });

  it('puts the rule in the brief, and nothing for an empty history or with variety off', async () => {
    const ctx = recentDesignsFor([entry(1), entry(2)], {});
    const instructions = composeInstructions({ skillName: 's', skillBody: 'b', brief: 'x', suggestedEntryPath: 'a.html', recentDesigns: ctx });
    assert.match(instructions, /## Recent designs in this workspace\n\n- "Design 2" \(2026-10-03\): dark theme, accent #ff5a1f/);
    assert.match(instructions, /recognisably different in at least two of: theme, hero layout, display font, accent/);
    assert.match(composeRecentDesignsSection(ctx, true), /keep its tokens and vary only what it leaves open/);
    assert.match(composeRecentDesignsSection(recentDesignsFor([entry(1, { collectionId: 'c' })], { collectionId: 'c' }), false), /## Keep consistent with/);

    const root = await tmp();
    assert.strictEqual(await loadRecentDesigns(root, {}), undefined);
    await upsertDesignHistory(root, entry(1));
    assert.ok(await loadRecentDesigns(root, {}));
    await fs.writeFile(path.join(root, '.open-design', 'config.json'), JSON.stringify({ variety: false }));
    assert.strictEqual(await loadRecentDesigns(root, {}), undefined);
  });
});
