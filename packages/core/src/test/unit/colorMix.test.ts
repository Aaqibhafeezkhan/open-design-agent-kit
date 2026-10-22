import * as assert from 'node:assert';
import { contrastRatio, parseColor, resolveColorValue, resolveColorsIn } from '../../generation/colorMix';

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('resolveColorValue', () => {
  // Pixels Chromium painted for these expressions (headless, sRGB profile).
  const browser: Array<[string, string]> = [
    ['color-mix(in oklab, #58cc02, black 8%)', '#4eb602'],
    ['color-mix(in oklab, #1b365d, black 14%)', '#142a4b'],
    ['color-mix(in oklab, #d5232f, white 20%)', '#e35e5a'],
    ['color-mix(in oklab, #6d4aff, #ffffff 90%)', '#eeefff'],
    ['color-mix(in oklch, oklch(0.5772 0.2324 260), black 10%)', '#045ede'],
    ['color-mix(in oklch, #d5232f, #1b365d)', '#773384'],
  ];
  for (const [expr, expected] of browser) {
    it(`matches the browser within 1/255 for ${expr}`, () => {
      const got = resolveColorValue(expr, () => undefined);
      assert.ok(got?.startsWith('#'), `got ${got}`);
      const diff = channels(got!).map((c, i) => Math.abs(c - channels(expected)[i]));
      assert.ok(Math.max(...diff) <= 1, `${got} vs ${expected}`);
    });
  }

  it('follows var() through the lookup, and a mix with transparent keeps the colour at reduced alpha', () => {
    const lookup = (n: string): string | undefined => ({ accent: '#d5232f', ring: 'var(--accent)' })[n];
    assert.strictEqual(resolveColorValue('color-mix(in oklab, var(--ring), transparent 85%)', lookup), 'rgba(213, 35, 47, 0.15)');
    assert.strictEqual(resolveColorValue('var(--accent)', lookup), '#d5232f');
  });

  it('scales alpha when percentages sum under 100, and refuses what it cannot resolve', () => {
    assert.strictEqual(resolveColorValue('color-mix(in srgb, #ff0000 25%, #0000ff 25%)', () => undefined), 'rgba(128, 0, 128, 0.5)');
    assert.strictEqual(resolveColorValue('color-mix(in oklab, var(--missing), black 8%)', () => undefined), undefined);
    assert.strictEqual(resolveColorValue('color-mix(in hwb, red, blue)', () => undefined), undefined);
  });
});

describe('resolveColorsIn', () => {
  it('resolves colours and lengths inside a box-shadow', () => {
    const lookup = (n: string): string | undefined => ({ accent: '#1b365d', border: '#e8e6dc', w: '1px' })[n];
    assert.strictEqual(resolveColorsIn('0 0 0 var(--w) var(--border)', lookup), '0 0 0 1px #e8e6dc');
    assert.match(resolveColorsIn('0 0 0 3px color-mix(in oklab, var(--accent), transparent 75%)', lookup)!, /^0 0 0 3px rgba\(27, 54, 93, 0\.25\)$/);
  });
});

describe('contrastRatio', () => {
  it('gives the WCAG ratio, and parses the colour forms tokens use', () => {
    assert.strictEqual(Math.round(contrastRatio('#ffffff', '#000000')! * 10) / 10, 21);
    assert.ok(Math.abs(contrastRatio('#6f6f6f', '#ffffff')! - 5.0) < 0.1);
    for (const v of ['#abc', 'rgb(1 2 3)', 'rgba(1, 2, 3, 0.5)', 'hsl(210 40% 50%)', 'oklch(55% 0 0)', 'oklab(0.5 0.1 -0.1)', 'transparent']) assert.ok(parseColor(v), v);
  });
});
