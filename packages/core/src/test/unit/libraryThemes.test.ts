import * as assert from 'node:assert';
import * as path from 'node:path';
import { ContentIndex } from '../../content/contentIndex';
import { resolveDesignSystemDetailTokens } from '../../generation/designSystemPreview';
import { buildLibraryTheme, hasThemeTokens, lengthToPx } from '../../generation/libraryThemes';

const ASSETS = path.resolve(__dirname, '../../../../content/assets/open-design');

async function tokensFor(id: string): Promise<Map<string, string>> {
  const detail = await new ContentIndex(ASSETS).getDesignSystem(id);
  assert.ok(detail, `bundled design system ${id}`);
  return resolveDesignSystemDetailTokens(detail).tokens;
}

describe('buildLibraryTheme', () => {
  it('maps a light system onto MUI, with the overlay override winning over tokens.css', async () => {
    const theme = buildLibraryTheme(await tokensFor('flat'), 'mui');
    assert.strictEqual(theme.mode, 'light');
    const palette = theme.mui!.palette as Record<string, Record<string, string>>;
    // tokens.css ships #2563eb; flat's tokens.override.css sets the brand accent.
    assert.strictEqual(palette.primary.main, '#f2673c');
    assert.strictEqual(palette.primary.contrastText, '#111111');
    assert.strictEqual(palette.background.default, '#f5f8ff');
    assert.strictEqual(palette.error.main, '#dc2626');
    assert.strictEqual(theme.mui!.shape?.borderRadius, 16);
    assert.strictEqual(theme.mui!.spacing, 4);
    assert.strictEqual((theme.mui!.typography.h1 as Record<string, string>).fontSize, '76px');
    assert.match(theme.code, /createTheme\(/);
  });

  it('detects a dark theme from --bg', async () => {
    const theme = buildLibraryTheme(await tokensFor('agentic'), 'mui');
    assert.strictEqual(theme.mode, 'dark');
    assert.strictEqual((theme.mui!.palette as Record<string, unknown>).mode, 'dark');
  });

  it('maps onto shadcn variables, putting the muted text colour on --muted-foreground', async () => {
    const tokens = await tokensFor('flat');
    const theme = buildLibraryTheme(tokens, 'shadcn');
    const vars = theme.cssVars!;
    assert.strictEqual(vars['--primary'], '#f2673c');
    assert.strictEqual(vars['--background'], '#f5f8ff');
    assert.strictEqual(vars['--destructive'], '#dc2626');
    assert.strictEqual(vars['--radius'], '16px');
    assert.strictEqual(vars['--muted-foreground'], tokens.get('--muted'));
    for (const name of ['--foreground', '--card', '--popover', '--primary-foreground', '--muted', '--border', '--input', '--ring']) {
      assert.ok(vars[name], `${name} is set`);
    }
    assert.match(theme.cssVarsHsl!['--primary'], /^\d+(\.\d)? \d+(\.\d)?% \d+(\.\d)?%$/);
  });

  it('lists tokens without a slot, with a suggestion', async () => {
    const theme = buildLibraryTheme(await tokensFor('flat'), 'shadcn');
    const motion = theme.unmapped.find((u) => u.token === '--motion-base');
    assert.ok(motion, '--motion-base is unmapped');
    assert.match(motion.suggestion, /transition/i);
    assert.ok(!theme.unmapped.some((u) => u.token === '--accent'), 'a mapped token is not listed');
  });

  it('resolves color-mix() references to literal colours', () => {
    const tokens = new Map([
      ['--bg', '#ffffff'],
      ['--fg', '#111111'],
      ['--accent', '#2563eb'],
      ['--accent-hover', 'color-mix(in oklab, var(--accent), black 8%)'],
    ]);
    const palette = buildLibraryTheme(tokens, 'mui').mui!.palette as Record<string, Record<string, string>>;
    assert.match(palette.primary.dark, /^#[0-9a-f]{6}$/);
    assert.notStrictEqual(palette.primary.dark, '#2563eb');
  });

  it('is deterministic', async () => {
    const tokens = await tokensFor('flat');
    assert.deepStrictEqual(buildLibraryTheme(tokens, 'mui'), buildLibraryTheme(tokens, 'mui'));
    assert.deepStrictEqual(buildLibraryTheme(tokens, 'shadcn'), buildLibraryTheme(tokens, 'shadcn'));
  });
});

describe('hasThemeTokens', () => {
  it('needs --bg, --fg and --accent', () => {
    assert.strictEqual(hasThemeTokens(new Map([['--bg', '#fff'], ['--fg', '#000'], ['--accent', '#f00']])), true);
    assert.strictEqual(hasThemeTokens(new Map([['--brand', '#f00']])), false);
  });
});

describe('lengthToPx', () => {
  it('reads px and rem, and nothing else', () => {
    assert.strictEqual(lengthToPx('12px'), 12);
    assert.strictEqual(lengthToPx('0.5rem'), 8);
    assert.strictEqual(lengthToPx('clamp(1rem, 2vw, 2rem)'), undefined);
  });
});
