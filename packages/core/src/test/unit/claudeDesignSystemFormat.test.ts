import * as assert from 'node:assert';
import { toClaudeDesignSystem, type ClaudeTokensJson } from '../../generation/claudeDesignSystem';
import { validateClaudeDesignSystem } from '../../generation/claudeDesignSystemFormat';

const DESIGN_MD = '# Design System Inspired by Dating.com\n\n> A confident, photo-first dating identity.\n\n## Color Palette\n\nOne bold red.\n';
const TOKENS_CSS = `:root {
  --bg: #ffffff;
  --surface: #f5f5f5;
  --fg: #222222;
  --muted: #999999;
  --border: #eeeeee;
  --accent: #d5232f;
  --accent-on: #ffffff;
  --accent-hover: color-mix(in oklab, var(--accent), white 15%);
  --font-display: "Albert Sans", sans-serif;
  --font-body: "Albert Sans", sans-serif;
  --text-base: 18px;
  --radius-sm: 4px;
  --radius-lg: 28px;
  --focus-ring: 0 0 0 3px color-mix(in oklab, var(--accent), transparent 70%);
}
`;

const build = (): Record<string, string> =>
  toClaudeDesignSystem({ name: 'Dating.com-inspired', id: 'user:dating-com-inspired', designMd: DESIGN_MD, tokensCss: TOKENS_CSS, now: '2026-10-22T00:00:00.000Z' }).files;

describe('validateClaudeDesignSystem', () => {
  it('passes a built system, warning about a brand pair below 4.5:1', () => {
    const files = build();
    const result = validateClaudeDesignSystem(files);
    assert.deepStrictEqual(result.errors, []);
    assert.ok(result.warnings.some((w) => w.startsWith('"muted" is 2.85:1 on "bg"')), result.warnings.join('\n'));
    const tokens = JSON.parse(files['project/tokens.json']) as ClaudeTokensJson;
    const muted = tokens.color!.tokens!.find((t) => t.name === 'muted');
    assert.match(muted!.usage!, /Below 4\.5:1 on `bg` \(2\.85:1\), as the brand has it\./, 'the builder flags it in the note');
    assert.match(JSON.stringify(tokens.shadow), /0 0 0 3px rgba\(213, 35, 47, 0\.3\)/);
  });

  it('reports each kind of error', () => {
    const files = build();
    const tokens = JSON.parse(files['project/tokens.json']) as ClaudeTokensJson;
    tokens.color!.tokens!.push({ name: 'hover', value: 'color-mix(in oklab, #000, #fff 50%)' }, { name: 'link', value: '{nowhere}' }, { name: 'bg', value: '#000000' }, { name: 'bad name', value: '#000000' });
    const index = JSON.parse(files['project/design-system.json']);
    delete index.createdOnFiles;
    const broken = {
      ...files,
      'project/tokens.json': JSON.stringify(tokens),
      'project/design-system.json': JSON.stringify(index),
      'project/README.md': `# Title\n\n${files['project/README.md']}`,
      'project/components/Cover/preview.html': files['project/components/Cover/preview.html'].replace(/^<!--[^\n]*-->/, ''),
      'project/tokens.css': ':root {}',
    };
    const { errors } = validateClaudeDesignSystem(broken);
    for (const expected of [/"hover" value .*drops/, /"link" aliases missing colour "nowhere"/, /"bg" is used in both color and color/, /token name "bad name"/, /createdOnFiles/, /must not start with a # title/, /line 1 must be the <!-- @dsCard/, /project\/tokens\.css: the page generates/]) {
      assert.ok(errors.some((e) => expected.test(e)), `no error matching ${expected}\n${errors.join('\n')}`);
    }
  });
});

describe('the cover', () => {
  it('picks the pattern from the tokens: pills for a 28px large radius', () => {
    const cover = build()['project/components/Cover/preview.html'];
    assert.match(cover, /^<!-- @dsCard height=288 -->/);
    assert.match(cover, /pattern {5}pills .*radius-lg is 28px/);
    assert.match(cover, /class="(brand|deep) pill"/);
    assert.doesNotMatch(cover, /<img/);
  });

  it('uses hairline rules for a serif display face and keeps a long name within its zone', () => {
    const css = TOKENS_CSS.replace('--radius-lg: 28px;', '--radius-lg: 8px;').replace('--font-display: "Albert Sans", sans-serif;', '--font-display: Charter, Georgia, serif;');
    const cover = toClaudeDesignSystem({ name: 'An Unusually Long Editorial Name', id: 'x', designMd: DESIGN_MD, tokensCss: css }).files['project/components/Cover/preview.html'];
    assert.match(cover, /pattern {5}four .*hairlines/);
    const size = Number(/\.name \{ margin:0; font-size:(\d+)px/.exec(cover)?.[1]);
    assert.ok(size >= 24 && size <= 120, `size ${size}`);
    // Either two lines that each fit 440px at the serif's 0.55em, or the top-band skeleton.
    const lines = /<h1 class="name">([^<]*(?:<br>[^<]*)?)<\/h1>/.exec(cover)![1].split('<br>');
    if (!/left:0px/.test(cover)) for (const l of lines) assert.ok(l.length * 0.55 * size <= 440, `${l} at ${size}px`);
  });
});
