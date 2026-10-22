import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyDesignSections,
  auditSystem,
  contrastRatio,
  generateOverlays,
  generateTokensOverride,
  compareFields,
  parseRootTokens,
  suggestSide,
} from '../designSystemConsistency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dsRoot = path.join(__dirname, '..', '..', 'assets', 'open-design', 'design-systems');
const vendored = async (id) => ({
  designMd: await fs.readFile(path.join(dsRoot, id, 'DESIGN.md'), 'utf8'),
  tokensCss: await fs.readFile(path.join(dsRoot, id, 'tokens.css'), 'utf8'),
});

function templateMd({ primary = '#58CC02', surface = '#FFFFFF', text = '#3C3C3C', family = 'Nunito' } = {}) {
  return [
    '# Design System Inspired by Test',
    '',
    '## 1. Visual Theme & Atmosphere',
    '',
    'Playful.',
    '',
    '## 2. Color',
    '',
    `- **Primary:** \`${primary}\` — Token from style foundations.`,
    `- **Surface:** \`${surface}\` — Token from style foundations.`,
    `- **Text:** \`${text}\` — Token from style foundations.`,
    '',
    `- Favor Primary (${primary}) for CTA emphasis.`,
    '',
    '## 3. Typography',
    '',
    `- **Families:** primary=${family}, display=${family}, mono=JetBrains Mono`,
    '',
    '## 6. Components',
    '',
    `- Buttons: primary action uses \`${primary}\`; secondary actions stay neutral.`,
    '',
  ].join('\n');
}

const tokensFor = ({ accent = '#58cc02', surface = '#ffffff', fg = '#3c3c3c', body = 'Nunito, system-ui, sans-serif', on = '#ffffff' } = {}) =>
  `:root {\n  --accent: ${accent};\n  --accent-on: ${on};\n  --meta: ${accent};\n  --surface: ${surface};\n  --fg: ${fg};\n  --font-body: ${body};\n  --font-display: ${body};\n  --font-mono: "JetBrains Mono", monospace;\n}\n[data-theme="dark"] { --accent: #000000; }\n`;

test('a differing primary is a conflict and both values are reported', () => {
  const audit = auditSystem({ designMd: templateMd(), tokensCss: tokensFor({ accent: '#6d4aff' }) });
  assert.equal(audit.color, 'conflict');
  assert.equal(audit.status, 'conflict');
  const primary = audit.fields.find((f) => f.field === 'Primary');
  assert.deepEqual([primary.design, primary.tokens, primary.same], ['#58CC02', '#6d4aff', false]);
});

test('placeholders on either side are named, and the placeholder side loses', () => {
  const designPh = auditSystem({ designMd: templateMd({ primary: '#3b82f6' }), tokensCss: tokensFor({ accent: '#9b5b32' }) });
  assert.equal(designPh.color, 'design-placeholder');
  assert.equal(suggestSide(designPh.color), 'tokens');
  const tokensPh = auditSystem({ designMd: templateMd({ primary: '#9333EA' }), tokensCss: tokensFor({ accent: '#2563eb' }) });
  assert.equal(tokensPh.color, 'tokens-placeholder');
  assert.equal(suggestSide(tokensPh.color), 'design');
  const lonelyInter = auditSystem({ designMd: templateMd(), tokensCss: tokensFor({ body: 'Inter, system-ui, sans-serif' }) });
  assert.equal(lonelyInter.type, 'tokens-placeholder');
  assert.equal(suggestSide('conflict'), 'tokens');
});

test('hex shorthand, case and font quoting are not conflicts; dark-theme blocks are ignored', () => {
  const audit = auditSystem({ designMd: templateMd({ surface: '#FFF' }), tokensCss: tokensFor({ body: '"Nunito", Arial, sans-serif' }) });
  assert.equal(audit.status, 'consistent');
  assert.equal(parseRootTokens(tokensFor()).get('--accent'), '#58cc02');
});

test('a hand-written DESIGN.md without template bullets is left alone', () => {
  const audit = auditSystem({ designMd: '# Kami\n\n## Color\n\nInk on paper, accent `#c2410c`.\n', tokensCss: tokensFor() });
  assert.equal(audit.template, false);
  assert.equal(audit.status, 'consistent');
  assert.deepEqual(audit.fields, []);
});

test('sections replace only the named sections, keeping the vendored heading', () => {
  const md = templateMd();
  const out = applyDesignSections(md, '<!-- generated -->\n\n## Color\n\n- **Primary:** `#60a5fa`\n');
  assert.match(out, /## 2\. Color\n\n- \*\*Primary:\*\* `#60a5fa`\n\n## 3\. Typography/);
  assert.equal(out.split('## 2. Color')[0], md.split('## 2. Color')[0]);
  assert.equal(out.split('## 3. Typography')[1], md.split('## 3. Typography')[1]);
  assert.throws(() => applyDesignSections(md, '## Iconography\n\nx\n', 'test'), /test: DESIGN\.sections\.md names a section DESIGN\.md doesn't have: "Iconography"/);
});

test('tokens truth rewrites the Color section and the sections repeating the old primary', async () => {
  const { designMd, tokensCss } = await vendored('agentic');
  const { override, sections } = generateOverlays({ designMd, tokensCss, decision: { color: 'tokens', type: 'tokens' } });
  assert.equal(override, undefined);
  assert.match(sections, /^<!-- generated from tokens\.css/);
  assert.match(sections, /## Color\n\n- \*\*Primary:\*\* `#60a5fa`/);
  assert.match(sections, /## Components\n[\s\S]*primary action uses `#60a5fa`/);
  assert.doesNotMatch(sections, /#FF5701/i);
  assert.doesNotMatch(sections, /## Visual Theme/);
  const applied = auditSystem({ designMd, tokensCss, sectionsMd: sections });
  assert.equal(applied.status, 'consistent');
});

test('design truth overrides the accent, its derived slots and the fonts', async () => {
  const { designMd, tokensCss } = await vendored('lingo');
  const { override, sections } = generateOverlays({ designMd, tokensCss, decision: { color: 'design', type: 'design', reason: 'playful green' } });
  const tokens = parseRootTokens(override);
  assert.equal(tokens.get('--accent'), '#58cc02');
  assert.equal(tokens.get('--meta'), '#58cc02');
  assert.equal(tokens.get('--focus-ring'), '0 0 0 4px rgba(88, 204, 2, 0.24)');
  assert.match(tokens.get('--font-body'), /^Nunito,/);
  assert.match(override, /\/\* playful green \*\//);
  // A six-step template scale can't fill eight --text-* steps, so the scale line follows tokens.
  assert.match(sections, /\*\*Scale:\*\* 12\/14\/16\/18\/24\/34\/50\/70/);
  assert.equal(auditSystem({ designMd, tokensCss, overrideCss: override, sectionsMd: sections }).status, 'consistent');
});

test('a generated accent below 4.5:1 against --accent-on gets a passing --accent-on', () => {
  const designMd = templateMd({ primary: '#FFC800' });
  const tokensCss = tokensFor({ accent: '#6d4aff', on: '#ffffff' });
  const { fields } = compareFields(designMd, parseRootTokens(tokensCss));
  const override = generateTokensOverride({ tokensCss, fields, decision: { color: 'design', type: 'tokens' } });
  const on = parseRootTokens(override).get('--accent-on');
  assert.equal(on, '#111111');
  assert.ok(contrastRatio('#ffc800', on) >= 4.5);
});

test('design truth keeps the page polarity: a light Surface over dark tokens stays dark', () => {
  const designMd = templateMd({ primary: '#ff5701', surface: '#FFFFFF', text: '#111111' });
  const tokensCss = tokensFor({ accent: '#60a5fa', surface: '#131b2f', fg: '#f8fafc' });
  const { override, sections } = generateOverlays({ designMd, tokensCss, decision: { color: 'design', type: 'tokens' } });
  const tokens = parseRootTokens(override);
  assert.equal(tokens.get('--accent'), '#ff5701');
  assert.equal(tokens.has('--surface'), false);
  assert.match(sections, /\*\*Surface:\*\* `#131b2f`/);
});
