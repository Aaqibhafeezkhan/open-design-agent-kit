import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ContentIndex } from '../../content/contentIndex';
import {
  DESIGN_INDUSTRIES,
  DESIGN_MOODS,
  DESIGN_SURFACES,
  computeDesignSystemFacets,
  matchesAllWords,
  type DesignProfile,
} from '../../content/designSystemMatching';

const ASSETS = path.resolve(__dirname, '../../../../content/assets/open-design');

function tokens(css: string) {
  return { body: '# X\n', tokensCss: `:root {\n${css}\n}` };
}

describe('designSystemMatching', () => {
  const index = new ContentIndex(ASSETS);

  describe('computeDesignSystemFacets', () => {
    it('reads theme, accent, display type and shape from tokens', () => {
      const f = computeDesignSystemFacets(tokens("--bg: #0b0b0f; --accent: #ff6b35; --font-display: 'Playfair Display', Georgia, serif; --radius-md: 2px;"));
      assert.strictEqual(f.theme, 'dark');
      assert.strictEqual(f.accentFamily, 'orange');
      assert.strictEqual(f.display, 'serif');
      assert.strictEqual(f.displayFont, 'Playfair Display');
      assert.strictEqual(f.shape, 'sharp');
    });

    it('treats a sans stack ending in sans-serif as sans, and a mono first family as mono', () => {
      assert.strictEqual(computeDesignSystemFacets(tokens('--bg: #fff; --accent: #111; --font-display: Inter, system-ui, sans-serif; --radius-md: 12px;')).display, 'sans');
      assert.strictEqual(computeDesignSystemFacets(tokens("--bg: #fff; --accent: #111; --font-display: 'JetBrains Mono', monospace;")).display, 'mono');
    });

    it('resolves var() and reads oklch, and calls a gray accent neutral', () => {
      const f = computeDesignSystemFacets(tokens('--paper: oklch(98% 0.004 95); --bg: var(--paper); --accent: #777777; --font-display: Inter; --radius-md: 0.75rem;'));
      assert.strictEqual(f.theme, 'light');
      assert.strictEqual(f.accentFamily, 'neutral');
      assert.strictEqual(f.shape, 'round');
    });

    it('applies the overlay token override on top of tokens.css', () => {
      const f = computeDesignSystemFacets({ ...tokens('--bg: #fff; --accent: #2563eb; --font-display: Inter;'), tokensOverrideCss: ':root { --accent: #16a34a; }' });
      assert.strictEqual(f.accentFamily, 'green');
    });

    it('takes theme from tokens even when the prose says dark', async () => {
      const ds = await index.getDesignSystem('dashboard');
      assert.ok(ds);
      assert.match(ds.body, /dark/i);
      assert.strictEqual(computeDesignSystemFacets(ds).theme, 'light');
    });
  });

  describe('descriptors', () => {
    it('ship a vocabulary identical to the tool vocabularies', async () => {
      const doc = JSON.parse(await fs.readFile(path.join(ASSETS, 'design-system-descriptors.json'), 'utf8'));
      assert.deepStrictEqual(doc.vocabulary.moods, [...DESIGN_MOODS]);
      assert.deepStrictEqual(doc.vocabulary.industries, [...DESIGN_INDUSTRIES]);
      assert.deepStrictEqual(doc.vocabulary.surfaces, [...DESIGN_SURFACES]);
    });

    it("match the VS Code tool's schema enums", async () => {
      const pkg = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../../../vscode/package.json'), 'utf8'));
      const tool = pkg.contributes.languageModelTools.find((t: { name: string }) => t.name === 'recommend_open_design_design_systems');
      assert.deepStrictEqual(tool.inputSchema.properties.moods.items.enum, [...DESIGN_MOODS]);
      assert.deepStrictEqual(tool.inputSchema.properties.industries.items.enum, [...DESIGN_INDUSTRIES]);
      assert.deepStrictEqual(tool.inputSchema.properties.surface.enum, [...DESIGN_SURFACES]);
    });
  });

  describe('recommendDesignSystems', () => {
    it('gives the same answer for the same profile', async () => {
      const profile = { industries: ['saas'], moods: ['minimal'] };
      const a = await index.recommendDesignSystems(profile);
      const b = await index.recommendDesignSystems(profile);
      assert.deepStrictEqual(a.recommendations.map((r) => r.id), b.recommendations.map((r) => r.id));
    });

    it('returns 3 to 5 results with a reason each', async () => {
      const r = await index.recommendDesignSystems({ moods: ['bold'] }, 10);
      assert.ok(r.recommendations.length >= 3 && r.recommendations.length <= 5);
      for (const rec of r.recommendations) assert.ok(rec.reason.length > 0);
    });

    it('keeps to the asked theme', async () => {
      const r = await index.recommendDesignSystems({ industries: ['wellness'], moods: ['calm', 'warm'], theme: 'light' });
      for (const rec of r.recommendations) assert.strictEqual(rec.facets.theme, 'light');
      assert.match(r.recommendations[0].reason, /calm|warm|wellness/);
    });

    it('starts from default and asks every question for an empty profile', async () => {
      const r = await index.recommendDesignSystems(undefined);
      assert.strictEqual(r.recommendations[0].id, 'default');
      assert.strictEqual(r.confidence, 'low');
      assert.deepStrictEqual(r.questions?.map((q) => q.id), ['purpose', 'feel', 'theme', 'likeBrand']);
    });

    it("doesn't ask what the profile already says", async () => {
      const r = await index.recommendDesignSystems({ theme: 'dark' });
      assert.ok(r.questions, 'thin profile asks');
      assert.ok(!r.questions.some((q) => q.id === 'theme'));
    });

    it('keeps dating-app brands out of a romantic shortlist unless named', async () => {
      const r = await index.recommendDesignSystems({ industries: ['dating'], moods: ['romantic'] });
      assert.ok(!r.recommendations.slice(0, 2).some((x) => x.kind === 'brand'), r.recommendations.map((x) => x.id).join(', '));
    });

    it('ranks genres above unnamed brands', async () => {
      const r = await index.recommendDesignSystems({ industries: ['finance'], moods: ['premium'] });
      assert.strictEqual(r.recommendations[0].kind, 'genre');
      assert.ok(!r.recommendations.some((x) => x.id === 'stripe'));
    });

    it('puts a named brand first', async () => {
      const r = await index.recommendDesignSystems({ likeBrands: ['Stripe'] });
      assert.strictEqual(r.recommendations[0].id, 'stripe');
      assert.strictEqual(r.confidence, 'high');
    });

    it('drops avoided ids and moods, and reports values outside the vocabulary', async () => {
      const r = await index.recommendDesignSystems({ moods: ['minimal', 'loud'], avoid: ['minimal', 'playful'], theme: 'purple' });
      assert.ok(!r.recommendations.some((x) => x.id === 'minimal'));
      assert.deepStrictEqual(r.ignored, ['theme: purple', 'moods: loud']);
    });

    it('does not change the active design system', async () => {
      // ContentIndex has no store; the tool layer must not set one either (covered in the server's tool tests).
      const r = await index.recommendDesignSystems({ moods: ['retro'] });
      assert.ok(r.recommendations.length >= 3);
    });

    // A small eval set: each brief has acceptable answers, and one of them must be in the top 3.
    const EVAL: Array<{ name: string; profile: DesignProfile; acceptable: string[] }> = [
      { name: 'yoga studio', profile: { industries: ['wellness'], moods: ['calm', 'warm'], theme: 'light' }, acceptable: ['friendly', 'cafe', 'warm-editorial', 'neumorphism', 'clean'] },
      { name: 'coffee shop deck (brief only)', profile: { brief: 'a pitch deck for a coffee shop' }, acceptable: ['cafe', 'terracotta', 'warm-editorial', 'friendly'] },
      { name: 'dark dev tool', profile: { industries: ['developer'], moods: ['technical'], theme: 'dark' }, acceptable: ['matrix', 'hud', 'mono', 'mission-control', 'agentic'] },
      { name: 'quarterly report', profile: { moods: ['editorial'], surface: 'document', brief: 'quarterly report' }, acceptable: ['editorial', 'kami', 'paper', 'publication', 'warm-editorial'] },
      { name: 'premium finance', profile: { industries: ['finance'], moods: ['premium'] }, acceptable: ['elegant', 'luxury', 'premium', 'sleek', 'power'] },
      { name: 'kids learning app', profile: { industries: ['education'], moods: ['playful'], surface: 'mobile' }, acceptable: ['lingo', 'claymorphism', 'doodle'] },
      { name: 'internal dashboard', profile: { industries: ['dashboard', 'enterprise'], moods: ['technical'] }, acceptable: ['ant', 'enterprise', 'default', 'dashboard', 'stitch', 'roku'] },
      { name: 'retro game', profile: { industries: ['gaming'], moods: ['retro', 'playful'] }, acceptable: ['pacman', 'tetris', 'sega'] },
      { name: 'luxury fashion', profile: { brief: 'luxury fashion store landing page' }, acceptable: ['luxury', 'elegant', 'premium', 'refined', 'square'] },
      { name: 'bold festival poster', profile: { brief: 'poster for a summer music festival', moods: ['bold'] }, acceptable: ['totality-festival', 'bold', 'energetic', 'expressive', 'colorful', 'vibrant'] },
      { name: 'minimal saas', profile: { industries: ['saas'], moods: ['minimal'], theme: 'light' }, acceptable: ['minimal', 'clean', 'simple', 'default', 'spacious', 'shadcn'] },
      { name: 'agency portfolio', profile: { industries: ['creative'], moods: ['artistic', 'bold'] }, acceptable: ['artistic', 'brutalism', 'creative', 'expressive', 'atelier-zero'] },
      { name: 'like Notion', profile: { likeBrands: ['Notion'] }, acceptable: ['notion'] },
      { name: 'spotify phone screen', profile: { likeBrands: ['spotify-ios'], surface: 'mobile' }, acceptable: ['spotify-ios'] },
      { name: 'dating coach app', profile: { brief: 'Social Coach: a dating advisor app', surface: 'mobile' }, acceptable: ['claymorphism', 'lingo', 'luxury', 'elegant', 'friendly'] },
      { name: 'like Feeld', profile: { likeBrands: ['Feeld'], moods: ['romantic'] }, acceptable: ['feeld-ios'] },
      { name: 'corporate deck', profile: { industries: ['enterprise'], moods: ['corporate'], surface: 'slides' }, acceptable: ['corporate', 'professional', 'enterprise', 'ant'] },
    ];
    for (const c of EVAL) {
      it(`eval: ${c.name}`, async () => {
        const r = await index.recommendDesignSystems(c.profile);
        const top3 = r.recommendations.slice(0, 3).map((x) => x.id);
        assert.ok(top3.some((id) => c.acceptable.includes(id)), `top 3 ${top3.join(', ')} has none of ${c.acceptable.join(', ')}`);
      });
    }
  });

  describe('multi-word search', () => {
    it('matches when every word is somewhere', () => {
      assert.ok(matchesAllWords(['warm cream canvas', 'Editorial & Print'], 'warm editorial'));
      assert.ok(!matchesAllWords(['warm cream canvas'], 'warm editorial'));
    });

    it('finds design systems across fields and descriptors', async () => {
      const ids = (await index.listDesignSystems('warm editorial')).map((d) => d.id);
      assert.ok(ids.includes('warm-editorial'));
      assert.ok((await index.listDesignSystems('warm fintech')).length > 0);
    });
  });
});
