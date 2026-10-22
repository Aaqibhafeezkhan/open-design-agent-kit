// The Claude Design System artifact format, as a validator. Written against
// the Design System type's contract 0.2.47 (its SKILL.md and
// artifact-type/reference/format.md, craft.md and cover.md); re-read those on
// each type release and update the rules here, in this one module.

import { contrastRatio } from './colorMix';

export const CLAUDE_TOKEN_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const THEME_ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// A colour function with plain numeric arguments (no nested function).
const COLOR_FN = /^(rgba?|hsla?|oklch|oklab|lab|lch|color)\(([^()]*)\)$/i;
const ALIAS = /^\{([^{}]+)\}$/;
const LENGTH = /^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%)?$/;
const PLAIN_CSS = /^[A-Za-z0-9 #%(),./+_-]{1,200}$/;

const KB = 1024;
const MB = 1024 * KB;
/** Per-path size caps (bytes), first match wins. */
const SIZE_CAPS: Array<[RegExp, number]> = [
  [/^project\/README\.md$/, 200 * KB],
  [/^project\/tokens\.json$/, 512 * KB],
  [/^project\/components\/[^/]+\/preview\.html$/, 256 * KB],
  [/^project\/components\/[^/]+\/README\.md$/, 64 * KB],
  [/./, 15 * MB],
];
/** Paths the page generates itself; a system never writes them. */
const GENERATED = [/^project\/tokens\.css$/, /^project\/manifest\.json$/, /^project\/api\//];

export interface ClaudeValidation {
  errors: string[];
  warnings: string[];
}

export interface ContrastFinding {
  token: string;
  ground: string;
  theme: string;
  ratio: number;
}

type TokenEntry = { name?: unknown; value?: unknown; usage?: unknown };
type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const byteLength = (s: string): number => Buffer.byteLength(s, 'utf8');

/** A colour value the page keeps: hex, a numeric colour function, or an alias. Named colours drop. */
export function isClaudeColorValue(value: string): boolean {
  return HEX.test(value) || COLOR_FN.test(value) || ALIAS.test(value);
}

/** Token names a usage note says its colour reads on: "… on `bg` and `surface`." */
export function groundsOf(usage: unknown): string[] {
  if (typeof usage !== 'string') return [];
  const m = /\bon ((?:`[^`]+`(?:,\s*|\s+and\s+|\s+or\s+)?)+)/.exec(usage);
  return m ? [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]) : [];
}

/** Each colour's literal value per theme, following aliases (a missing theme inherits the first's). */
function colorTable(tokens: Json): { themes: string[]; values: Map<string, Map<string, string>> } {
  const color = isObject(tokens.color) ? tokens.color : {};
  const themes = Array.isArray(color.themes) ? color.themes.map((t) => (isObject(t) ? String(t.id) : '')).filter(Boolean) : [];
  const list = Array.isArray(color.tokens) ? (color.tokens as TokenEntry[]) : [];
  const raw = new Map<string, unknown>(list.map((t) => [String(t.name), t.value]));
  const values = new Map<string, Map<string, string>>();
  const valueIn = (name: string, theme: string, depth = 0): string | undefined => {
    if (depth > 16) return undefined;
    const v = raw.get(name);
    const s = typeof v === 'string' ? v : isObject(v) ? ((v[theme] ?? v[themes[0]]) as string | undefined) : undefined;
    if (typeof s !== 'string') return undefined;
    const alias = ALIAS.exec(s)?.[1];
    return alias ? valueIn(alias, theme, depth + 1) : s;
  };
  for (const name of raw.keys()) {
    const perTheme = new Map<string, string>();
    for (const theme of themes) {
      const v = valueIn(name, theme);
      if (v !== undefined) perTheme.set(theme, v);
    }
    values.set(name, perTheme);
  }
  return { themes, values };
}

/** Text colours below 4.5:1 on a ground their usage note names, in any theme. */
export function contrastFindings(tokens: Json): ContrastFinding[] {
  const { themes, values } = colorTable(tokens);
  const list = isObject(tokens.color) && Array.isArray(tokens.color.tokens) ? (tokens.color.tokens as TokenEntry[]) : [];
  const out: ContrastFinding[] = [];
  for (const t of list) {
    const name = String(t.name);
    for (const ground of groundsOf(t.usage)) {
      for (const theme of themes) {
        const fg = values.get(name)?.get(theme);
        const bg = values.get(ground)?.get(theme);
        if (!fg || !bg) continue;
        const ratio = contrastRatio(fg, bg);
        if (ratio !== undefined && ratio < 4.5) out.push({ token: name, ground, theme, ratio: Math.round(ratio * 100) / 100 });
      }
    }
  }
  return out;
}

function validateIndex(text: string | undefined, errors: string[]): void {
  if (text === undefined) {
    errors.push('project/design-system.json is missing.');
    return;
  }
  let index: unknown;
  try {
    index = JSON.parse(text);
  } catch {
    errors.push('project/design-system.json is not valid JSON.');
    return;
  }
  if (!isObject(index)) return void errors.push('project/design-system.json is not an object.');
  const need = (ok: boolean, what: string): void => {
    if (!ok) errors.push(`design-system.json: ${what}.`);
  };
  need(index.v === 3, '"v" must be 3');
  need(index.layout === 'files', '"layout" must be "files"');
  const marker = index.createdOnFiles ?? index.convertedFrom;
  need(isObject(marker) && (index.convertedFrom !== undefined || (marker.v === 1 && typeof marker.at === 'string')), 'needs a createdOnFiles {v: 1, at} marker');
  need(typeof index.title === 'string' && index.title.trim() !== '', '"title" must name the system');
  need(typeof index.namespace === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(index.namespace), '"namespace" must be a JS identifier');
  need(Array.isArray(index.libraries), '"libraries" must be a list');
  need(isObject(index.sections), '"sections" must be an object');
  need(Array.isArray(index.groups), '"groups" must be a list');
  need(isObject(index.assetGroups), '"assetGroups" must be an object');
  need(isObject(index.blobs), '"blobs" must be an object');
  need(isObject(index.docs) && Array.isArray(index.docs.sections), '"docs" must hold a "sections" list');
  const lc = index.lastChange;
  if (lc !== undefined) {
    need(isObject(lc) && typeof lc.by === 'string' && lc.by.length > 0 && lc.by.length <= 200, 'lastChange.by must be 1–200 characters');
    need(isObject(lc) && typeof lc.at === 'string' && !Number.isNaN(Date.parse(lc.at)), 'lastChange.at must be an ISO-8601 time');
    need(!isObject(lc) || lc.via === undefined || (typeof lc.via === 'string' && lc.via.length <= 120), 'lastChange.via must be at most 120 characters');
    need(!isObject(lc) || lc.note === undefined || (typeof lc.note === 'string' && lc.note.length <= 280), 'lastChange.note must be at most 280 characters');
  }
}

function validateTokens(text: string | undefined, errors: string[], warnings: string[]): void {
  if (text === undefined) return;
  let tokens: unknown;
  try {
    tokens = JSON.parse(text);
  } catch {
    errors.push('project/tokens.json is not valid JSON.');
    return;
  }
  if (!isObject(tokens)) return void errors.push('project/tokens.json is not an object.');

  const seen = new Map<string, string>();
  const families = Object.entries(tokens).filter(([key, v]) => key !== 'type' && isObject(v) && 'tokens' in v);
  for (const [key, v] of Object.entries(tokens)) {
    if (key === 'type' || !isObject(v)) continue;
    if ('tokens' in v && !Array.isArray(v.tokens)) errors.push(`tokens.json: "${key}.tokens" must be a list (a name-to-value map is not read).`);
  }
  if (families.filter(([k]) => !['color', 'spacing', 'radius', 'shadow'].includes(k)).length > 12) errors.push('tokens.json: more than 12 extra token families.');

  const color = isObject(tokens.color) ? tokens.color : undefined;
  const themes = color && Array.isArray(color.themes) ? color.themes : [];
  const themeIds = themes.map((t) => (isObject(t) ? t.id : undefined));
  if (color) {
    if (themeIds.length === 0) errors.push('tokens.json: color.themes needs at least one theme.');
    if (themeIds.length > 8) errors.push('tokens.json: more than 8 colour themes.');
    for (const id of themeIds) if (typeof id !== 'string' || !THEME_ID.test(id)) errors.push(`tokens.json: theme id ${JSON.stringify(id)} is not valid.`);
  }
  const colorNames = new Set(color && Array.isArray(color.tokens) ? (color.tokens as TokenEntry[]).map((t) => String(t.name)) : []);

  for (const [family, v] of families) {
    const list = (v as { tokens: unknown }).tokens;
    if (!Array.isArray(list)) continue;
    if (family === 'color' ? list.length > 600 : list.length > 60) errors.push(`tokens.json: "${family}" has ${list.length} tokens, over its cap.`);
    for (const entry of list as TokenEntry[]) {
      const name = entry.name;
      if (typeof name !== 'string' || !CLAUDE_TOKEN_NAME.test(name)) {
        errors.push(`tokens.json: ${family} token name ${JSON.stringify(name)} is not valid.`);
        continue;
      }
      if (seen.has(name)) errors.push(`tokens.json: "${name}" is used in both ${seen.get(name)} and ${family} (the second drops).`);
      seen.set(name, family);
      if (typeof entry.usage === 'string' && entry.usage.length > 1000) errors.push(`tokens.json: "${name}" usage is over 1000 characters.`);
      const perTheme: Array<[string, unknown]> = isObject(entry.value) ? Object.entries(entry.value) : [[String(themeIds[0] ?? ''), entry.value]];
      if (isObject(entry.value)) {
        for (const [theme] of perTheme) if (!themeIds.includes(theme)) errors.push(`tokens.json: "${name}" has a value for unknown theme "${theme}".`);
      }
      for (const [, value] of perTheme) {
        if (typeof value !== 'string' && typeof value !== 'number') {
          errors.push(`tokens.json: "${name}" has no usable value.`);
          continue;
        }
        const s = String(value);
        if (family === 'color') {
          const alias = ALIAS.exec(s)?.[1];
          if (alias !== undefined) {
            if (alias === name) errors.push(`tokens.json: "${name}" is an alias of itself.`);
            else if (!colorNames.has(alias)) errors.push(`tokens.json: "${name}" aliases missing colour "${alias}".`);
          } else if (!isClaudeColorValue(s)) errors.push(`tokens.json: colour "${name}" value ${JSON.stringify(s)} drops (no var(), color-mix(), url() or named colours).`);
        } else if (family === 'spacing' || family === 'radius') {
          if (!LENGTH.test(s)) errors.push(`tokens.json: ${family} "${name}" value ${JSON.stringify(s)} is not a length.`);
        } else if (family === 'shadow') {
          if (/var\(|url\(|color-mix\(/i.test(s) || s.length > 400) errors.push(`tokens.json: shadow "${name}" value ${JSON.stringify(s)} drops.`);
        } else if (/var\(|url\(/i.test(s) || !PLAIN_CSS.test(s)) {
          errors.push(`tokens.json: ${family} "${name}" value ${JSON.stringify(s)} is not a plain CSS value.`);
        }
      }
    }
  }
  // Alias cycles.
  if (color && Array.isArray(color.tokens)) {
    const aliasOf = new Map<string, string>();
    for (const t of color.tokens as TokenEntry[]) if (typeof t.value === 'string') {
      const a = ALIAS.exec(t.value)?.[1];
      if (a) aliasOf.set(String(t.name), a);
    }
    for (const start of aliasOf.keys()) {
      let cur: string | undefined = start;
      for (let depth = 1; cur !== undefined; depth++) {
        cur = aliasOf.get(cur);
        if (cur === start || (cur !== undefined && depth >= 16)) {
          errors.push(`tokens.json: "${start}" is part of an alias cycle or a chain over 16 deep.`);
          break;
        }
      }
    }
  }

  const type = tokens.type;
  if (type !== undefined) {
    if (!isObject(type)) errors.push('tokens.json: "type" must be an object.');
    else {
      const fams = isObject(type.families) ? type.families : {};
      if (Object.keys(fams).length > 12) errors.push('tokens.json: more than 12 type families.');
      for (const [key, stack] of Object.entries(fams)) {
        if (!THEME_ID.test(key)) errors.push(`tokens.json: type family key "${key}" is not valid.`);
        if (typeof stack !== 'string' || stack.length > 200 || /[;{}<>\\()]/.test(stack) || (stack.match(/"/g) ?? []).length % 2 === 1) errors.push(`tokens.json: type family "${key}" stack drops.`);
      }
      const groups = Array.isArray(type.groups) ? type.groups : [];
      if (groups.length > 12) errors.push('tokens.json: more than 12 type groups.');
      let styles = 0;
      for (const g of groups) {
        if (!isObject(g) || !Array.isArray(g.styles)) continue;
        for (const st of g.styles) {
          styles++;
          if (!isObject(st) || typeof st.name !== 'string' || !CLAUDE_TOKEN_NAME.test(st.name)) errors.push(`tokens.json: a type style in "${String(isObject(g) ? g.name : '')}" has no valid name.`);
          else if (!(typeof st.fontSize === 'number' || (typeof st.fontSize === 'string' && LENGTH.test(st.fontSize)))) errors.push(`tokens.json: type style "${st.name}" fontSize drops.`);
        }
      }
      if (styles > 80) errors.push('tokens.json: more than 80 type styles.');
    }
  }

  for (const f of contrastFindings(tokens)) {
    warnings.push(`"${f.token}" is ${f.ratio}:1 on "${f.ground}" in ${f.theme} (below 4.5:1).`);
  }
}

function validateCover(files: Record<string, string>, errors: string[]): void {
  const cover = files['project/components/Cover/preview.html'];
  if (cover === undefined) return void errors.push('project/components/Cover/preview.html (the cover) is missing.');
  const marker = /^<!-- @dsCard\b([^>]*)-->/.exec(cover);
  const height = marker ? Number(/height=(\d+)/.exec(marker[1])?.[1]) : NaN;
  if (!marker) errors.push('The cover\'s line 1 must be the <!-- @dsCard height=N --> marker.');
  else if (!(height >= 240 && height <= 360)) errors.push(`The cover's height must be 240–360 (it is ${marker[1].trim() || 'unset'}).`);
  if (/<img\b/i.test(cover)) errors.push('The cover may not use images.');
  for (const p of Object.keys(files)) {
    if (p.startsWith('project/components/Cover/') && p !== 'project/components/Cover/preview.html') errors.push(`${p}: the Cover folder must hold only preview.html.`);
  }
}

/** Checks a Claude Design System file tree (paths under `project/` → text) against the type's format. */
export function validateClaudeDesignSystem(files: Record<string, string>): ClaudeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [p, text] of Object.entries(files)) {
    if (!p.startsWith('project/') || p.includes('..') || p.split('/').some((seg) => seg.startsWith('.'))) errors.push(`${p}: every path must be under project/, with no ".." or dot-files.`);
    if (GENERATED.some((re) => re.test(p))) errors.push(`${p}: the page generates this file; it must not be written.`);
    const cap = SIZE_CAPS.find(([re]) => re.test(p))![1];
    if (byteLength(text) > cap) errors.push(`${p}: ${byteLength(text)} bytes is over its ${cap}-byte cap.`);
  }
  validateIndex(files['project/design-system.json'], errors);
  const readme = files['project/README.md'];
  if (readme === undefined) errors.push('project/README.md is missing.');
  else if (/^#\s/.test(readme.trimStart())) errors.push('README.md must not start with a # title (the page shows the system\'s name).');
  validateTokens(files['project/tokens.json'], errors, warnings);
  validateCover(files, errors);
  return { errors, warnings };
}

