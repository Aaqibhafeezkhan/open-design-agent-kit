// Turns what siteExtraction.ts measured on a rendered page into a draft
// token set on the Open Design token contract (openspec
// add-design-system-from-url). Deterministic and pure: the same evidence
// always gives the same draft, so the model doesn't re-guess roles. Every
// value is measured; a contract token with no measurement is left out (its
// contract fallback applies) and listed as unmeasured.
//
// Role sampling and forced hover/active states follow the approach of
// arvindrk/extract-design-system and open-design's brand-extract skill
// (both MIT); the code here is our own.

import { TOKEN_SCHEMA } from '../vendored/designTokenSchema';

/** One sampled element for a colour role. */
export interface RoleSample {
  /** Computed CSS colour as the browser reports it (`rgb(…)` / `rgba(…)`). */
  value: string;
  /** A selector that finds the element the value came from. */
  selector: string;
  /** How many sampled elements share the value. */
  count: number;
  /** The role's crop under the evidence bundle, relative to it. */
  crop?: string;
}

export type ColorRole = 'bg' | 'surface' | 'fg' | 'muted' | 'border' | 'accent' | 'accent-on' | 'accent-hover' | 'accent-active';

export interface TextRoleSample {
  role: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small' | 'caption' | 'button' | 'nav' | 'code';
  selector: string;
  fontFamily: string;
  /** px */
  fontSize: number;
  /** px, or undefined for `normal` */
  lineHeight?: number;
  fontWeight: number;
  /** px */
  letterSpacing?: number;
}

export interface LoadedFont {
  family: string;
  weight: string;
  style: string;
  /** The `src` of the matching @font-face rule, when the stylesheet was readable. */
  source?: string;
}

export interface PageEvidence {
  url: string;
  /** The page's colour roles; a role nothing matched is absent. */
  roles: Partial<Record<ColorRole, RoleSample>>;
  textRoles: TextRoleSample[];
  fonts: LoadedFont[];
  /** Declared custom properties: `:root` and theme-scoped (`[data-theme=dark]`, `.dark`, `@media (prefers-color-scheme: dark)`). */
  customProperties: { root: Record<string, string>; themes: Record<string, Record<string, string>> };
  /** Distinct non-zero border radii in px with how many elements use each; ≥ 999 counts as pill. */
  radii: Array<{ px: number; count: number; kind: 'button' | 'input' | 'card' | 'other' }>;
  /** Padding/gap values snapped to 2px, with counts. */
  spacing: Array<{ px: number; count: number }>;
  /** px */
  containerMax?: number;
  /** Transition durations in ms, and easing functions, with counts. */
  transitions: { durations: Array<{ ms: number; count: number }>; easings: Array<{ value: string; count: number }> };
  /** The card shadow, when cards have one. */
  cardShadow?: string;
}

export interface SiteEvidence {
  pages: PageEvidence[];
  /** Dark-theme colour roles, only when the site has a dark theme. */
  dark?: { trigger: 'prefers-color-scheme' | 'toggle'; roles: Partial<Record<ColorRole, RoleSample>> };
}

export interface DraftTokens {
  /** Contract name → value, `:root` set. */
  tokens: Record<string, string>;
  /** `[data-theme="dark"]` overrides, only when a dark theme was measured. */
  dark?: Record<string, string>;
  /** Contract tokens with no measurement (left to the contract fallback). */
  unmeasured: string[];
  /** Token → where its value came from (selector and crop). */
  sources: Record<string, { selector: string; crop?: string; page: string }>;
}

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * A computed colour as `#rrggbb`, or `#rrggbbaa` when translucent;
 * undefined for fully transparent or unparseable values.
 */
export function cssColorToHex(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(v)) return v;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (!m) return undefined;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
  if (alpha === 0) return undefined;
  const base = `#${hex2(Number(m[1]))}${hex2(Number(m[2]))}${hex2(Number(m[3]))}`;
  return alpha < 1 ? `${base}${hex2(alpha * 255)}` : base;
}

const round = (n: number, places = 2): number => Math.round(n * 10 ** places) / 10 ** places;

/** `"Nunito", Arial, sans-serif` with the first loaded family moved to the front. */
function fontStack(declared: string, loaded: LoadedFont[]): string {
  const families = declared.split(',').map((f) => f.trim()).filter(Boolean);
  const unquote = (f: string): string => f.replace(/^["']|["']$/g, '').toLowerCase();
  const loadedNames = new Set(loaded.map((f) => unquote(f.family)));
  const i = families.findIndex((f) => loadedNames.has(unquote(f)));
  const ordered = i > 0 ? [families[i], ...families.slice(0, i), ...families.slice(i + 1)] : families;
  return ordered.map((f) => (/^["']/.test(f) || !/\s/.test(f) || /^(ui-|system-ui)/.test(f) ? f : `"${f}"`)).join(', ');
}

const TEXT_ABOVE_BASE = ['--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl'];
const TEXT_BELOW_BASE = ['--text-sm', '--text-xs'];
const SPACE_STEPS = ['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-12'];

/**
 * Text sizes onto `--text-xs … --text-4xl`, anchored on body as
 * `--text-base`: sizes above it fill from `--text-4xl` down (the largest is
 * always the top step), sizes below it from `--text-sm` down.
 */
export function mapTypeScale(bodyPx: number, sizes: number[]): Record<string, string> {
  const out: Record<string, string> = { '--text-base': `${round(bodyPx)}px` };
  const distinct = [...new Set(sizes.map((s) => round(s)))];
  const above = distinct.filter((s) => s > bodyPx).sort((a, b) => b - a);
  const below = distinct.filter((s) => s < bodyPx).sort((a, b) => b - a);
  // More sizes than steps: keep the largest, the smallest and an even spread between.
  const pick = (list: number[], n: number): number[] =>
    list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
  const top = pick(above, TEXT_ABOVE_BASE.length);
  top.forEach((px, i) => (out[TEXT_ABOVE_BASE[TEXT_ABOVE_BASE.length - 1 - i]] = `${px}px`));
  pick(below, TEXT_BELOW_BASE.length).forEach((px, i) => (out[TEXT_BELOW_BASE[i]] = `${px}px`));
  return out;
}

function mostCommon<T extends { count: number }>(list: T[]): T | undefined {
  return [...list].sort((a, b) => b.count - a.count)[0];
}

function mergeCounts<K extends string | number>(lists: Array<Array<{ count: number } & Record<string, unknown>>>, key: string): Array<{ key: K; count: number }> {
  const tally = new Map<K, number>();
  for (const list of lists) for (const item of list) tally.set(item[key] as K, (tally.get(item[key] as K) ?? 0) + item.count);
  return [...tally].map(([k, count]) => ({ key: k, count }));
}

function colorTokens(roles: Partial<Record<ColorRole, RoleSample>>, page: string, sources?: DraftTokens['sources']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [role, sample] of Object.entries(roles) as Array<[ColorRole, RoleSample]>) {
    const hex = cssColorToHex(sample.value);
    if (!hex) continue;
    out[`--${role}`] = hex;
    if (sources) sources[`--${role}`] = { selector: sample.selector, crop: sample.crop, page };
  }
  // A hover or active state that doesn't change the colour isn't a measurement of a distinct state.
  for (const state of ['--accent-hover', '--accent-active']) if (out[state] && out[state] === out['--accent']) delete out[state];
  return out;
}

export function evidenceToTokens(evidence: SiteEvidence): DraftTokens {
  const tokens: Record<string, string> = {};
  const sources: DraftTokens['sources'] = {};
  const [first, ...rest] = evidence.pages;
  if (!first) return { tokens, unmeasured: TOKEN_SCHEMA.map((t) => t.name), sources };

  // Colours from the first page (the URL the person gave); later pages fill gaps.
  for (const page of [first, ...rest]) {
    for (const [name, value] of Object.entries(colorTokens(page.roles, page.url, sources))) if (!(name in tokens)) tokens[name] = value;
    for (const name of Object.keys(sources)) if (!(name in tokens)) delete sources[name];
  }

  const textRoles = evidence.pages.flatMap((p) => p.textRoles);
  const fonts = evidence.pages.flatMap((p) => p.fonts);
  const body = first.textRoles.find((r) => r.role === 'body') ?? textRoles.find((r) => r.role === 'body');
  if (body) {
    tokens['--font-body'] = fontStack(body.fontFamily, fonts);
    sources['--font-body'] = { selector: body.selector, page: first.url };
    const sizes = textRoles.filter((r) => r.role !== 'code').map((r) => r.fontSize);
    Object.assign(tokens, mapTypeScale(body.fontSize, sizes));
    if (body.lineHeight) tokens['--leading-body'] = String(round(body.lineHeight / body.fontSize));
  }
  const h1 = textRoles.find((r) => r.role === 'h1') ?? textRoles.find((r) => r.role === 'h2');
  if (h1) {
    tokens['--font-display'] = fontStack(h1.fontFamily, fonts);
    sources['--font-display'] = { selector: h1.selector, page: first.url };
    if (h1.lineHeight) tokens['--leading-tight'] = String(round(h1.lineHeight / h1.fontSize));
    if (h1.letterSpacing !== undefined) tokens['--tracking-display'] = h1.letterSpacing === 0 ? '0' : `${round(h1.letterSpacing / h1.fontSize, 3)}em`;
  }
  const code = textRoles.find((r) => r.role === 'code');
  if (code) tokens['--font-mono'] = fontStack(code.fontFamily, fonts);

  // Radii: buttons → md, inputs → sm, cards → lg; a ≥ 999px radius is the pill.
  const radii = evidence.pages.flatMap((p) => p.radii);
  const byKind = (kind: string): number | undefined => mostCommon(radii.filter((r) => r.kind === kind && r.px < 999))?.px;
  const pill = radii.find((r) => r.px >= 999);
  if (pill) tokens['--radius-pill'] = '9999px';
  for (const [kind, name] of [['input', '--radius-sm'], ['button', '--radius-md'], ['card', '--radius-lg']] as const) {
    const px = byKind(kind);
    if (px !== undefined) tokens[name] = `${px}px`;
  }

  // Spacing: the most used values, each onto the contract step whose default
  // is nearest (12px → --space-3), most used first, one value per step.
  const stepDefaults = SPACE_STEPS.map((name) => [name, Number.parseFloat(TOKEN_SCHEMA.find((t) => t.name === name)?.fallback ?? '')] as const);
  const spacing = mergeCounts<number>(evidence.pages.map((p) => p.spacing), 'px')
    .filter((s) => s.key > 0)
    .sort((a, b) => b.count - a.count || a.key - b.key)
    .slice(0, SPACE_STEPS.length);
  for (const { key: px } of spacing) {
    const free = stepDefaults.filter(([name, d]) => !(name in tokens) && Number.isFinite(d));
    const nearest = free.sort((a, b) => Math.abs(a[1] - px) - Math.abs(b[1] - px))[0];
    if (nearest && Math.abs(nearest[1] - px) <= Math.max(4, nearest[1] * 0.25)) tokens[nearest[0]] = `${px}px`;
  }

  if (first.containerMax) tokens['--container-max'] = `${Math.round(first.containerMax)}px`;
  if (first.cardShadow) tokens['--elev-raised'] = first.cardShadow;

  const durations = mergeCounts<number>(evidence.pages.map((p) => p.transitions.durations), 'ms').filter((d) => d.key > 0);
  if (durations.length > 0) {
    const sorted = durations.map((d) => d.key).sort((a, b) => a - b);
    tokens['--motion-fast'] = `${sorted[0]}ms`;
    // The base duration is the median of the slower ones, so it always differs from the fast one.
    const slower = sorted.filter((ms) => ms > sorted[0]);
    if (slower.length > 0) tokens['--motion-base'] = `${slower[Math.floor((slower.length - 1) / 2)]}ms`;
  }
  const easing = mostCommon(mergeCounts<string>(evidence.pages.map((p) => p.transitions.easings), 'value'));
  if (easing && durations.length > 0) tokens['--ease-standard'] = easing.key;

  let dark: Record<string, string> | undefined;
  if (evidence.dark) {
    const measured = colorTokens(evidence.dark.roles, first.url);
    dark = Object.fromEntries(Object.entries(measured).filter(([name, value]) => tokens[name] !== value));
    if (Object.keys(dark).length === 0) dark = undefined;
  }

  return { tokens, dark, unmeasured: TOKEN_SCHEMA.map((t) => t.name).filter((n) => !(n in tokens)), sources };
}

/** The draft as a tokens.css text, for the model to start from. */
export function draftTokensCss(draft: DraftTokens, header: string): string {
  const lines = (set: Record<string, string>): string => Object.entries(set).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  let css = `/* ${header.replace(/\*\//g, '* /')} */\n:root {\n${lines(draft.tokens)}\n}\n`;
  if (draft.dark) css += `\n[data-theme="dark"] {\n${lines(draft.dark)}\n}\n`;
  return css;
}
