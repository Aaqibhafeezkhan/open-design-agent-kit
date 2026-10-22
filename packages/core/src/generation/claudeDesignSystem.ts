// One-off conversion between an Open Design design system (DESIGN.md +
// tokens.css) and a Claude Design System artifact (a `project/` file tree:
// design-system.json index, list-shaped tokens.json, README.md brand book,
// components/Cover/preview.html). Pure: callers read and write the files.
// Claude has no public API for these, so publishing the exported tree (or
// fetching one to import) is left to an agent's Artifact tool.
//
// Lossy by design, and every loss is reported in `notes`:
//   - Claude's tokens.json rejects `var()` and `color-mix()`; colour `var()`
//     references become `{alias}` tokens, other lengths/shadows are resolved
//     to literals, and color-mix values are skipped.
//   - Claude has no motion family, so `--motion-*` / `--ease-*` are skipped.
// Importing maps arbitrary Claude token names onto the Open Design token
// contract by name heuristics, keeping the original names as well.

import { TOKEN_SCHEMA } from '../vendored/designTokenSchema';
import { isSafeCssValue, resolveTokenValue } from './designSystemTokens';

// ---------- shared ----------

export interface ClaudeToken {
  name: string;
  value: string | Record<string, string>;
  usage?: string;
}

export interface ClaudeTypeStyle {
  name: string;
  fontSize: string;
  lineHeight?: string | number;
  letterSpacing?: string;
  fontWeight?: number | string;
  family?: string;
  usage?: string;
}

export interface ClaudeTokensJson {
  name?: string;
  version?: number;
  meta?: Record<string, unknown>;
  color?: { themes?: Array<{ id: string; name?: string }>; tokens?: ClaudeToken[] };
  type?: {
    fonts?: unknown[];
    families?: Record<string, string>;
    groups?: Array<{ name: string; family?: string; styles?: ClaudeTypeStyle[] }>;
  };
  [family: string]: unknown;
}

const COLOR_FN = /^(rgba?|hsla?|oklch|oklab|lab|lch|color)\(([^()]*)\)$/i;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%)?$/;
const VAR_ONLY = /^var\(\s*--([a-zA-Z0-9_-]+)\s*\)$/;
const CLAUDE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
// Families the importer and exporter both treat as contract-shaped; any
// other `{tokens:[…]}` family in a Claude system is carried as-is.
const TYPE_METRICS_FAMILY = 'typeMetrics';

const TINT_NAME = /soft|light|tint|subtle|faint|muted|bg|background|surface|on[-_.]|ink|text|line|border/i;

/** Rough chroma 0–1 of a plain colour (hex spread, or oklch/lch chroma). */
function chroma(value: string): number {
  const hex = HEX.exec(value)?.[0];
  if (hex) {
    let h = hex.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return Math.max(...rgb) - Math.min(...rgb);
  }
  const fn = /^(oklch|lch)\(\s*[\d.]+%?\s+([\d.]+)/i.exec(value);
  if (fn) return parseFloat(fn[2]) / (fn[1].toLowerCase() === 'lch' ? 150 : 0.4);
  return 0;
}

function mostChromatic(names: string[], values: Map<string, string>): string | undefined {
  let best: string | undefined;
  let bestChroma = 0.15;
  for (const n of names) {
    const c = chroma(values.get(n) ?? '');
    if (c > bestChroma) [best, bestChroma] = [n, c];
  }
  return best;
}

const toPx = (v: string | number | undefined): number | undefined => {
  if (v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const m = /^(-?[\d.]+)(px|rem|em)?$/.exec(v.trim());
  if (!m) return undefined;
  return parseFloat(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1);
};

function isPlainColor(value: string): boolean {
  return HEX.test(value) || COLOR_FN.test(value);
}

function contractDescription(name: string): string | undefined {
  return TOKEN_SCHEMA.find((t) => t.name === `--${name}`)?.description;
}

/** Top-level rule bodies of a stylesheet, recursing into `@media (prefers-color-scheme: dark)`. */
function cssBlocks(css: string): Array<{ selector: string; body: string; darkMedia: boolean }> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ selector: string; body: string; darkMedia: boolean }> = [];
  const walk = (src: string, darkMedia: boolean): void => {
    let depth = 0;
    let start = 0;
    let open = -1;
    let selector = '';
    for (let i = 0; i < src.length; i++) {
      if (src[i] === '{') {
        if (depth === 0) {
          selector = src.slice(start, i).trim();
          open = i + 1;
        }
        depth++;
      } else if (src[i] === '}') {
        depth = Math.max(0, depth - 1);
        if (depth === 0 && open >= 0) {
          const body = src.slice(open, i);
          if (selector.startsWith('@media')) {
            if (/prefers-color-scheme\s*:\s*dark/.test(selector)) walk(body, true);
          } else if (!selector.startsWith('@')) {
            out.push({ selector, body, darkMedia });
          }
          start = i + 1;
          open = -1;
        }
      }
    }
  };
  walk(text, false);
  return out;
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g)) {
    const value = m[2].trim().replace(/\s+/g, ' ');
    if (isSafeCssValue(value)) out.set(m[1], value);
  }
  return out;
}

const isDarkSelector = (selector: string): boolean => /dark/i.test(selector);

/** Rough lightness 0–1 of a plain colour, for naming the first theme. */
function lightness(value: string): number | undefined {
  const hex = HEX.exec(value)?.[0];
  if (hex) {
    let h = hex.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const fn = /^(oklch|oklab|lab|lch)\(\s*([\d.]+)(%?)/i.exec(value);
  if (fn) {
    const n = parseFloat(fn[2]);
    if (fn[3] === '%' || fn[1].toLowerCase().startsWith('l')) return n / 100;
    return n;
  }
  return undefined;
}

// ---------- Open Design → Claude ----------

export interface ToClaudeDesignSystemInput {
  /** Display name; becomes the index `title`. */
  name: string;
  /** Open Design id (bundled directory name or `user:<dir>`), recorded in tokens.json meta. */
  id: string;
  designMd: string;
  tokensCss?: string;
  /** Who the change is recorded for in `lastChange.by`. */
  by?: string;
  /** ISO timestamp; defaults to now. */
  now?: string;
}

export interface ClaudeDesignSystemFiles {
  /** Paths relative to the artifact root (all under `project/`) → file text. */
  files: Record<string, string>;
  /** Everything that did not carry across, one line each. */
  notes: string[];
}

export function toClaudeDesignSystem(input: ToClaudeDesignSystemInput): ClaudeDesignSystemFiles {
  const now = input.now ?? new Date().toISOString();
  const notes: string[] = [];
  const blocks = input.tokensCss ? cssBlocks(input.tokensCss) : [];
  const base = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const block of blocks) {
    const decls = declarations(block.body);
    if (block.selector === ':root' && !block.darkMedia) for (const [k, v] of decls) base.set(k, v);
    else if (block.darkMedia || isDarkSelector(block.selector)) for (const [k, v] of decls) dark.set(k, v);
  }
  if (!input.tokensCss) notes.push('No tokens.css: only the README was exported.');

  const resolvedBase = new Map([...base].map(([k, v]) => [`--${k}`, v]));
  const literal = (name: string, overlay?: Map<string, string>): string | undefined => {
    const set = new Map(resolvedBase);
    if (overlay) for (const [k, v] of overlay) set.set(`--${k}`, v);
    return resolveTokenValue(set, `--${name}`);
  };

  // A token is a colour when its value is a plain colour, or an alias chain ending in one.
  const colorNames = new Set<string>();
  const isColorName = (name: string, seen = new Set<string>()): boolean => {
    const v = base.get(name) ?? dark.get(name);
    if (v === undefined || seen.has(name)) return false;
    if (isPlainColor(v) || /^color-mix\(/i.test(v)) return true;
    const ref = VAR_ONLY.exec(v)?.[1];
    return ref ? isColorName(ref, new Set([...seen, name])) : false;
  };
  for (const name of new Set([...base.keys(), ...dark.keys()])) if (isColorName(name)) colorNames.add(name);

  const toColorValue = (name: string, v: string | undefined): string | undefined => {
    if (v === undefined) return undefined;
    if (isPlainColor(v)) return v.startsWith('#') ? v.toLowerCase() : v;
    const ref = VAR_ONLY.exec(v)?.[1];
    if (ref && colorNames.has(ref)) return `{${ref}}`;
    notes.push(`--${name}: ${v} skipped (Claude tokens cannot hold var() or color-mix()).`);
    return undefined;
  };

  const bg = base.get('bg');
  const firstThemeDark = bg !== undefined && (lightness(bg) ?? 1) < 0.5;
  const themes = firstThemeDark
    ? [{ id: 'dark', name: 'Dark' }]
    : dark.size > 0
      ? [{ id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }]
      : [{ id: 'light', name: 'Light' }];
  if (firstThemeDark && dark.size > 0) notes.push('Dark-mode overrides skipped: the base theme is already dark.');
  const hasDarkTheme = themes.length === 2;

  const colorTokens: ClaudeToken[] = [];
  for (const name of colorNames) {
    if (!CLAUDE_NAME.test(name)) {
      notes.push(`--${name} skipped: name is not valid in Claude tokens.`);
      continue;
    }
    const first = toColorValue(name, base.get(name));
    const second = hasDarkTheme && dark.has(name) ? toColorValue(name, dark.get(name)) : undefined;
    if (first === undefined && second === undefined) continue;
    // A token with no dark override stays a plain string: Claude reuses the first theme's value.
    const value: ClaudeToken['value'] = second !== undefined && first !== undefined && second !== first ? { [themes[0].id]: first, dark: second } : first ?? second!;
    colorTokens.push({ name, value, usage: contractDescription(name) ?? 'Brand-specific colour from Open Design.' });
  }

  const spacing: ClaudeToken[] = [];
  const radius: ClaudeToken[] = [];
  const shadow: ClaudeToken[] = [];
  const typeMetrics: ClaudeToken[] = [];
  const families: Record<string, string> = {};
  const textSizes = new Map<string, string>();

  for (const [name, raw] of base) {
    if (colorNames.has(name)) continue;
    const value = literal(name) ?? raw;
    const usage = contractDescription(name) ?? 'Brand-specific token from Open Design.';
    const fontKey = /^font-(.+)$/.exec(name)?.[1];
    if (fontKey) {
      if (/[;{}<>\\()]/.test(value) || value.length > 200) notes.push(`--${name} skipped: font stack has characters Claude rejects.`);
      else families[fontKey.toLowerCase()] = value;
    } else if (/^text-/.test(name)) {
      textSizes.set(name, value);
    } else if (/^(leading|tracking)-/.test(name)) {
      typeMetrics.push({ name, value, usage });
    } else if (/^(motion|ease|duration)-/.test(name)) {
      notes.push(`--${name} skipped: Claude design systems have no motion family.`);
    } else if (/^(elev|shadow)-|^focus-ring$/.test(name)) {
      if (/var\(|color-mix\(/i.test(value)) {
        notes.push(`--${name}: ${raw} skipped (unresolvable reference).`);
        continue;
      }
      const darkValue = hasDarkTheme && dark.has(name) ? literal(name, dark) : undefined;
      shadow.push({
        name,
        value: darkValue && darkValue !== value && !/var\(|color-mix\(/i.test(darkValue) ? { [themes[0].id]: value, dark: darkValue } : value,
        usage,
      });
    } else if (LENGTH.test(value)) {
      (/radius|rounded/.test(name) ? radius : spacing).push({ name, value, usage });
    } else {
      notes.push(`--${name}: ${raw} skipped (no matching Claude token family).`);
    }
  }

  const body = families.body ? 'body' : Object.keys(families)[0];
  const display = families.display ? 'display' : body;
  const leadingBody = base.get('leading-body');
  const leadingTight = base.get('leading-tight');
  const tracking = base.get('tracking-display');
  const steps = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
  const style = (name: string, isDisplay: boolean): ClaudeTypeStyle | undefined => {
    const fontSize = textSizes.get(name);
    if (!fontSize) return undefined;
    textSizes.delete(name);
    const lineHeight = isDisplay ? leadingTight : leadingBody;
    return {
      name,
      fontSize,
      ...(lineHeight !== undefined ? { lineHeight: /^[\d.]+$/.test(lineHeight) ? Number(lineHeight) : lineHeight } : {}),
      ...(isDisplay && tracking && tracking !== '0' ? { letterSpacing: tracking } : {}),
      usage: contractDescription(name),
    };
  };
  const textStyles = steps.slice(0, 4).map((n) => style(n, false)).filter((s): s is ClaudeTypeStyle => !!s);
  const displayStyles = steps.slice(4).map((n) => style(n, true)).filter((s): s is ClaudeTypeStyle => !!s);
  for (const [name, fontSize] of textSizes) textStyles.push({ name, fontSize });
  textStyles.sort((a, b) => (toPx(a.fontSize) ?? 0) - (toPx(b.fontSize) ?? 0));
  const groups = [
    ...(displayStyles.length ? [{ name: 'Display', family: display, styles: displayStyles }] : []),
    ...(textStyles.length ? [{ name: 'Text', family: body, styles: textStyles }] : []),
  ].filter((g) => g.family);

  const tokens: ClaudeTokensJson = {
    name: input.name,
    version: 1,
    meta: { source: 'open-design', id: input.id, synced: now.slice(0, 10) },
    color: { themes, tokens: colorTokens },
    type: { fonts: [], families, groups },
    spacing: { tokens: spacing },
    radius: { tokens: radius },
    ...(shadow.length ? { shadow: { tokens: shadow } } : {}),
    ...(typeMetrics.length ? { [TYPE_METRICS_FAMILY]: { note: 'Line heights and tracking from the Open Design token contract.', tokens: typeMetrics } } : {}),
  };

  const readme = `${input.designMd.trim()}\n\n## Not synced from Open Design\n\n${
    notes.length ? notes.map((n) => `- ${n}`).join('\n') : '- Everything in tokens.css carried across.'
  }\n- Fonts are named by family only (hosted faces); no font files were copied.\n- No components or assets: Open Design design systems carry tokens and guidance only.\n`;

  const index = {
    v: 3,
    layout: 'files',
    createdOnFiles: { v: 1, at: now },
    title: input.name,
    namespace: namespaceOf(input.name),
    libraries: [],
    sections: {},
    groups: [],
    assetGroups: {},
    blobs: {},
    docs: { sections: [] },
    lastChange: { by: input.by ?? 'Claude', at: now, via: `Open Design · ${input.id}`, note: 'One-off export from Open Design.' },
  };

  return {
    files: {
      'project/README.md': readme,
      'project/tokens.json': `${JSON.stringify(tokens, null, 2)}\n`,
      'project/components/Cover/preview.html': coverHtml(input.name, summaryOf(input.designMd), colorTokens, families, display),
      'project/design-system.json': `${JSON.stringify(index, null, 2)}\n`,
    },
    notes,
  };
}

function namespaceOf(name: string): string {
  const ns = name
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
  return /^[A-Za-z]/.test(ns) ? ns : `DS${ns}`;
}

function summaryOf(designMd: string): string {
  const quote = designMd
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith('>') && !/^>\s*Category:/i.test(l.trim()))
    .map((l) => l.replace(/^\s*>\s?/, ''))
    .join(' ')
    .trim();
  const sentence = /^[^.!?]*[.!?]/.exec(quote)?.[0] ?? quote;
  return sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}…` : sentence;
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The cover per the type's cover brief: colour blocks right of x=480, one dot-grid pattern, the name bottom-left. */
function coverHtml(name: string, tagline: string, colors: ClaudeToken[], families: Record<string, string>, displayKey: string | undefined): string {
  const has = (n: string): boolean => colors.some((t) => t.name === n);
  const pick = (...names: string[]): string | undefined => names.find(has);
  const brand = pick('accent', 'brand', 'primary') ?? colors[0]?.name ?? 'fg';
  const ink = pick('fg', 'ink', 'text') ?? brand;
  const tint = pick('surface-warm', 'border-soft', 'surface', 'muted') ?? ink;
  const signal = pick('success', 'warn', 'danger') ?? brand;
  const ground = pick('bg', 'surface') ?? tint;
  const muted = pick('muted', 'fg-2') ?? ink;
  const fontVar = displayKey ? `var(--font-${displayKey})` : 'system-ui, sans-serif';
  // Size the name so its longest line fits 440px at ~0.6em a letter.
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length), 1);
  const lines = name.length * 0.6 * 64 > 440 ? 2 : 1;
  const perLine = lines === 1 ? name.length : Math.max(longest, Math.ceil(name.length / 2));
  const size = Math.max(40, Math.min(120, Math.floor(440 / (perLine * 0.6))));
  const dots: string[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) dots.push(`<circle class="dot" cx="${196 + col * 24}" cy="${120 + row * 24}" r="3"/>`);
  return `<!-- @dsCard height=288 -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)}</title>
<style>
  html, body { margin:0; height:100%; }
  body { background:var(--${ground}); color:var(--${ink}); font-family:${fontVar}; overflow:hidden; }
  .cover { position:relative; height:288px; overflow:hidden; }
  .art { position:absolute; top:0; left:480px; width:480px; height:288px; overflow:hidden; }
  .art svg { display:block; width:480px; height:288px; }
  .brand { fill:var(--${brand}); }
  .deep { fill:var(--${ink}); }
  .tint { fill:var(--${tint}); }
  .signal { fill:var(--${signal}); }
  .dot { fill:var(--${brand}); }
  .blk { rx:var(--radius-md, 8px); }
  .words { position:absolute; left:var(--space-6, 24px); bottom:var(--space-6, 24px); max-width:440px; }
  .name { margin:0; font-size:${size}px; line-height:.95; font-weight:600; letter-spacing:-.02em; color:var(--${ink}); }
  .tag { margin:var(--space-2, 8px) 0 0 2px; font-size:14px; line-height:20px; color:var(--${muted}); }
</style>
</head>
<body>
<div class="cover">
<div class="art" aria-hidden="true">
<svg viewBox="0 0 480 288" width="480" height="288">
<!--
  blocks      ${brand} 144×264 slab bled off the top · ${tint} 168×176 tint · ${ink} 128×208 off the right edge · ${signal} 64×24 once
  arrangement one tall brand slab with satellites, bottoms on one line space-6 above the edge
  pattern     dot grid at a space-6 pitch over the tint, generated by the Open Design exporter (not brand-specific)
  scales      gutters space-4; pitch space-6; corners radius-md
-->
<rect class="brand blk" x="16" y="-24" width="144" height="264"/>
<rect class="signal blk" x="16" y="248" width="64" height="16"/>
<rect class="tint blk" x="176" y="88" width="168" height="176"/>
<rect class="deep blk" x="360" y="56" width="136" height="208"/>
${dots.join('\n')}
</svg>
</div>
<div class="words">
<h1 class="name">${escapeHtml(name)}</h1>
${tagline ? `<p class="tag">${escapeHtml(tagline)}</p>` : ''}
</div>
</div>
</body>
</html>
`;
}

// ---------- Claude → Open Design ----------

export interface FromClaudeDesignSystemInput {
  /** The index's `title`, or a name the caller chose. */
  title: string;
  tokensJson?: ClaudeTokensJson;
  readme?: string;
}

export interface OpenDesignDesignSystemFiles {
  designMd: string;
  tokensCss: string;
  notes: string[];
}

// Name patterns, best first, used to bind Claude token names onto contract colour slots.
const COLOR_SLOTS: ReadonlyArray<[string, RegExp[]]> = [
  ['accent', [/^accent$/, /^(brand|primary)$/, /^(accent|brand|primary)[-_.]?(500|600|default|base|main)?$/, /^(accent|brand|primary)/]],
  ['accent-on', [/^on[-_.]?(accent|brand|primary)/, /^(accent|brand|primary)[-_.](on|fg|foreground|contrast|text)/]],
  ['bg', [/^bg$/, /^background$/, /^(canvas|page)/, /^(bg|background)[-_.]?(page|base|default|0+|50|100)?$/, /^surface[-_.]?(0+|50|100|base|page)$/]],
  ['surface', [/^surface$/, /^(card|panel)/, /^surface[-_.]?(raised|elevated|1|200|card)$/, /^surface/]],
  ['fg', [/^fg$/, /^(ink|text|foreground)$/, /^(ink|text|fg|foreground)[-_.]?(primary|default|base|strong|900)?$/]],
  ['muted', [/^muted$/, /^(ink|text|fg|foreground)[-_.]?(muted|subtle|secondary|weak|2|600|500)$/, /muted|subtle/]],
  ['border', [/^border$/, /^(line|divider|hairline|stroke|rule)$/, /^(border|line|divider|hairline|stroke|outline)/]],
  ['success', [/success|positive/, /^(green|leaf)/]],
  ['warn', [/warn|caution/, /^(amber|yellow)/]],
  ['danger', [/danger|error|destructive|negative|critical/, /^red/]],
];

/** Picks `count` entries spread evenly across an ascending list (repeating when short). */
function spread<T>(sorted: T[], count: number): T[] {
  if (sorted.length === 0) return [];
  return Array.from({ length: count }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / Math.max(1, count - 1))]);
}

function cssColor(value: string): string | undefined {
  const alias = /^\{([A-Za-z0-9_.-]+)\}$/.exec(value)?.[1];
  if (alias) return `var(--${cssName(alias)})`;
  return isPlainColor(value) ? value : undefined;
}

const cssName = (name: string): string => name.replace(/[^A-Za-z0-9_-]/g, '-');

export function fromClaudeDesignSystem(input: FromClaudeDesignSystemInput): OpenDesignDesignSystemFiles {
  const notes: string[] = [];
  const t = input.tokensJson ?? {};
  const themes = t.color?.themes?.length ? t.color.themes : [{ id: 'light', name: 'Light' }];
  const first = themes[0].id;
  const root = new Map<string, string>();
  const themed = new Map<string, Map<string, string>>();
  const set = (name: string, value: string): void => {
    if (isSafeCssValue(value)) root.set(cssName(name), value);
    else notes.push(`${name}: value rejected as unsafe CSS.`);
  };

  // Colours, as named in Claude, per theme.
  const colorNames: string[] = [];
  const firstValues = new Map<string, string>();
  for (const token of t.color?.tokens ?? []) {
    const values = typeof token.value === 'string' ? { [first]: token.value } : token.value;
    const base = values[first] ?? Object.values(values)[0];
    const css = base !== undefined ? cssColor(base) : undefined;
    if (!css) {
      notes.push(`Colour ${token.name}: ${String(base)} skipped (not a colour value Open Design can use).`);
      continue;
    }
    set(token.name, css);
    colorNames.push(token.name);
    firstValues.set(token.name, base!);
    for (const theme of themes.slice(1)) {
      const v = values[theme.id];
      const themedCss = v !== undefined ? cssColor(v) : undefined;
      if (themedCss && themedCss !== css) {
        if (!themed.has(theme.id)) themed.set(theme.id, new Map());
        themed.get(theme.id)!.set(cssName(token.name), themedCss);
      }
    }
  }

  // Bind the contract's colour slots to the closest-named Claude tokens.
  const bound = new Set<string>();
  const slotNotes: string[] = [];
  for (const [slot, patterns] of COLOR_SLOTS) {
    if (root.has(slot)) {
      bound.add(slot);
      continue;
    }
    let match = patterns.map((p) => colorNames.find((n) => !bound.has(n) && p.test(n.toLowerCase()))).find(Boolean);
    // Brand-named accents ("ember", "acme-500"): the system's own name, else its most chromatic plain colour.
    if (!match && slot === 'accent') {
      const own = input.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0];
      match = colorNames.find((n) => own !== undefined && n.toLowerCase() === own) ?? mostChromatic(colorNames.filter((n) => !bound.has(n) && !TINT_NAME.test(n)), firstValues);
    }
    const accent = /^var\(--(.+)\)$/.exec(root.get('accent') ?? '')?.[1];
    if (!match && slot === 'accent-on' && accent) match = colorNames.find((n) => [`on-${accent}`, `${accent}-on`, `on${accent}`].includes(n.toLowerCase()));
    // Claude systems often call the page colour `surface`; then the canvas is that surface.
    if (!match && slot === 'bg' && root.has('surface')) match = 'surface';
    if (match) {
      root.set(slot, `var(--${cssName(match)})`);
      bound.add(match);
      slotNotes.push(`--${slot} ← ${match}`);
    } else if (['bg', 'surface', 'fg', 'muted', 'border', 'accent'].includes(slot)) {
      notes.push(`No Claude colour matched --${slot}; Open Design will guess it from DESIGN.md.`);
    }
  }
  if (!root.has('surface') && root.has('bg')) root.set('surface', 'var(--bg)');

  // Fonts.
  const fam = t.type?.families ?? {};
  const famKey = (re: RegExp): string | undefined => Object.keys(fam).find((k) => re.test(k.toLowerCase()));
  const bodyKey = famKey(/^body$/) ?? famKey(/body|sans|text|base|ui/) ?? Object.keys(fam)[0];
  const displayKey = famKey(/^display$/) ?? famKey(/display|heading|headline|title|serif/) ?? bodyKey;
  const monoKey = famKey(/mono|code/);
  for (const [k, v] of Object.entries(fam)) set(`font-${k}`, v);
  if (bodyKey && !root.has('font-body')) root.set('font-body', `var(--font-${cssName(bodyKey)})`);
  if (displayKey && !root.has('font-display')) root.set('font-display', `var(--font-${cssName(displayKey)})`);
  if (monoKey && !root.has('font-mono')) root.set('font-mono', `var(--font-${cssName(monoKey)})`);
  if (!bodyKey) notes.push('No font families: Open Design will guess fonts from DESIGN.md.');

  // Type scale → text-xs … text-4xl.
  const styles = (t.type?.groups ?? []).flatMap((g) => g.styles ?? []);
  const steps = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'];
  const named = styles.filter((s) => /^text-/.test(s.name));
  if (named.length) for (const s of named) set(s.name, s.fontSize);
  else {
    const bySize = [...new Map(styles.filter((s) => toPx(s.fontSize) !== undefined).map((s) => [toPx(s.fontSize)!, s])).values()].sort(
      (a, b) => toPx(a.fontSize)! - toPx(b.fontSize)!,
    );
    // Anchor text-base on the body style, then spread the smaller and larger styles around it.
    const bodyAt = Math.max(0, bySize.findIndex((s) => /body|base/i.test(s.name)) >= 0 ? bySize.findIndex((s) => /body|base/i.test(s.name)) : bySize.findIndex((s) => toPx(s.fontSize)! >= 14));
    const body = bySize[bodyAt];
    const below = bySize.slice(0, bodyAt);
    const above = bySize.slice(bodyAt + 1);
    if (body) {
      [...spread(below.length ? below : [body], 2), body, ...spread(above.length ? above : [body], 5)].forEach((s, i) => set(`text-${steps[i]}`, s.fontSize));
    }
    if (bySize.length) slotNotes.push(`type scale ← ${bySize.length} Claude text styles`);
    else notes.push('No text styles: the type scale is missing.');
  }
  const metrics = new Map(((t[TYPE_METRICS_FAMILY] as { tokens?: ClaudeToken[] } | undefined)?.tokens ?? []).map((m) => [m.name, String(m.value)]));
  const ratio = (s: ClaudeTypeStyle | undefined): string | undefined => {
    if (!s || s.lineHeight === undefined) return undefined;
    const lh = s.lineHeight;
    if (typeof lh === 'number' || /^[\d.]+$/.test(String(lh))) return String(lh);
    const px = toPx(String(lh));
    const fs = toPx(s.fontSize);
    return px && fs ? (px / fs).toFixed(2).replace(/\.?0+$/, '') : undefined;
  };
  const sortedStyles = [...styles].sort((a, b) => (toPx(a.fontSize) ?? 0) - (toPx(b.fontSize) ?? 0));
  const bodyStyle = styles.find((s) => /body|base/i.test(s.name)) ?? sortedStyles[Math.floor(sortedStyles.length / 3)];
  const bigStyle = sortedStyles[sortedStyles.length - 1];
  set('leading-body', metrics.get('leading-body') ?? ratio(bodyStyle) ?? '1.5');
  set('leading-tight', metrics.get('leading-tight') ?? ratio(bigStyle) ?? '1.15');
  set('tracking-display', metrics.get('tracking-display') ?? bigStyle?.letterSpacing ?? '0');
  for (const [k, v] of metrics) if (!root.has(k)) set(k, v);

  // Spacing, radius, shadow and any other list-shaped family.
  const familyTokens = (key: string): ClaudeToken[] => ((t[key] as { tokens?: ClaudeToken[] } | undefined)?.tokens ?? []);
  const fill = (key: string, contract: Array<[string, number]>): void => {
    const list = familyTokens(key).filter((tok) => typeof tok.value === 'string');
    for (const tok of list) set(tok.name, tok.value as string);
    const lengths = list.filter((tok) => toPx(tok.value as string) !== undefined).sort((a, b) => toPx(a.value as string)! - toPx(b.value as string)!);
    for (const [slot, target] of contract) {
      if (root.has(slot) || lengths.length === 0) continue;
      const nearest = lengths.reduce((best, tok) => (Math.abs(toPx(tok.value as string)! - target) < Math.abs(toPx(best.value as string)! - target) ? tok : best));
      root.set(slot, `var(--${cssName(nearest.name)})`);
    }
  };
  fill('spacing', [['space-1', 4], ['space-2', 8], ['space-3', 12], ['space-4', 16], ['space-5', 20], ['space-6', 24], ['space-8', 32], ['space-12', 48]]);
  fill('radius', [['radius-sm', 4], ['radius-md', 8], ['radius-lg', 16], ['radius-pill', 9999]]);
  for (const tok of familyTokens('shadow')) {
    const v = typeof tok.value === 'string' ? tok.value : tok.value[first] ?? Object.values(tok.value)[0];
    if (v) set(tok.name, v);
  }
  const firstShadow = familyTokens('shadow')[0];
  if (!root.has('elev-raised') && firstShadow) root.set('elev-raised', `var(--${cssName(firstShadow.name)})`);
  const defaults: Array<[string, string]> = [
    ['section-y-desktop', '96px'], ['section-y-tablet', '64px'], ['section-y-phone', '48px'],
    ['container-max', '1200px'], ['container-gutter-desktop', '32px'], ['container-gutter-tablet', '24px'], ['container-gutter-phone', '16px'],
  ];
  const defaulted = defaults.filter(([k]) => !root.has(k));
  for (const [k, v] of defaulted) root.set(k, v);
  if (defaulted.length) notes.push(`Layout tokens defaulted (Claude has no equivalent): ${defaulted.map(([k]) => `--${k}`).join(', ')}.`);
  for (const key of Object.keys(t)) {
    if (['name', 'version', 'meta', 'color', 'type', 'spacing', 'radius', 'shadow', TYPE_METRICS_FAMILY].includes(key)) continue;
    const list = familyTokens(key);
    if (list.length) notes.push(`Family "${key}" (${list.length} tokens) not carried: no Open Design slot.`);
  }

  const lines = (m: Map<string, string>): string => [...m].map(([k, v]) => `  --${k}: ${v};`).join('\n');
  const source = t.meta?.source === 'open-design' ? `round-tripped from Open Design (${String(t.meta.id ?? 'unknown')})` : 'imported from Claude Design';
  let tokensCss = `/* ${input.title} — ${source}.\n * Generated by Open Design's one-off Claude Design import; edit freely.\n */\n\n:root {\n${lines(root)}\n}\n`;
  for (const [id, m] of themed) tokensCss += `\n[data-theme="${id}"] {\n${lines(m)}\n}\n`;

  return { designMd: designMdFrom(input.title, input.readme ?? '', slotNotes, notes), tokensCss, notes };
}

/** Claude's README minus the sections the page generates, shaped for Open Design's `# Name` + blockquote parser. */
function designMdFrom(title: string, readme: string, mapping: string[], notes: string[]): string {
  let text = readme.replace(/\r\n/g, '\n');
  // Drop the page-generated tail (`---` then "Consuming this system" / "Index") and our own export note.
  text = text.replace(/\n-{3,}\s*\n+## (Consuming this system|Index)[\s\S]*$/, '\n');
  text = text.replace(/\n## Not synced from Open Design\n[\s\S]*?(?=\n## |\s*$)/, '\n');
  text = text.trim();
  const lines = text.split('\n');
  const headingAt = lines.findIndex((l) => l.trim() !== '');
  const hasHeading = headingAt >= 0 && /^#\s/.test(lines[headingAt]);
  const afterHeading = lines.slice(hasHeading ? headingAt + 1 : 0);
  const firstBody = afterHeading.findIndex((l) => l.trim() !== '');
  const hasQuote = firstBody >= 0 && afterHeading[firstBody].trim().startsWith('>');
  let out: string;
  if (hasHeading && hasQuote) out = text;
  else {
    const para = afterHeading.join('\n').split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#')) ?? '';
    const summary = (/^[^.!?]*[.!?]/.exec(para.replace(/\s+/g, ' '))?.[0] ?? para.replace(/\s+/g, ' ')).slice(0, 240);
    const heading = hasHeading ? lines[headingAt] : `# ${title}`;
    const rest = afterHeading.join('\n').trim();
    out = `${heading}\n\n> Category: Imported from Claude Design\n${summary ? `> ${summary}\n` : ''}\n${rest}`.trimEnd();
  }
  const report = [...mapping.map((m) => `- Mapped ${m}`), ...notes.map((n) => `- ${n}`)];
  return `${out}\n\n## Imported from Claude Design\n\n${report.length ? report.join('\n') : '- Tokens carried across by name.'}\n`;
}
