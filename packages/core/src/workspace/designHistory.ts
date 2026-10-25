// A short local record of recent designs and how each looked (openspec
// add-variety-memory), so a new brief can ask for something recognisably
// different. `.open-design/history.json` beside config.json; a cache the
// manifests stay the source of truth for, safe to delete.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { load, type CheerioAPI } from 'cheerio';
import { relativeLuminance, resolveColorValue } from '../generation/colorMix';

export const DESIGN_HISTORY_LIMIT = 50;
export const RECENT_DESIGNS_LIMIT = 5;

export type HeroLayout = 'centred' | 'split' | 'full-bleed-image' | 'none';

/** What a design looked like, read statically from its HTML. Signals that can't be read are left out. */
export interface LookSignature {
  accent?: string;
  displayFont?: string;
  bodyFont?: string;
  theme?: 'light' | 'dark';
  hero?: HeroLayout;
}

export interface DesignHistoryEntry {
  entryPath: string;
  title: string;
  skillId?: string;
  designSystemId?: string;
  collectionId?: string;
  explorationId?: string;
  /** Set for an exploration sketch; sketches are left out of the recent-designs list. */
  directionId?: string;
  /** ISO time of the latest registration. */
  date: string;
  signature: LookSignature;
}

interface HistoryFile {
  version: 1;
  /** Oldest first. */
  entries: DesignHistoryEntry[];
}

export function designHistoryPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.open-design', 'history.json');
}

export async function readDesignHistory(workspaceRoot: string): Promise<DesignHistoryEntry[]> {
  try {
    const raw = JSON.parse(await fs.readFile(designHistoryPath(workspaceRoot), 'utf8')) as Partial<HistoryFile>;
    if (!Array.isArray(raw.entries)) return [];
    return raw.entries.filter((e): e is DesignHistoryEntry => Boolean(e && typeof e.entryPath === 'string' && typeof e.title === 'string' && e.signature && typeof e.signature === 'object'));
  } catch {
    return [];
  }
}

/** Adds the entry, or replaces the one with the same entry path, as the newest; keeps the latest 50. Written atomically. */
export async function upsertDesignHistory(workspaceRoot: string, entry: DesignHistoryEntry): Promise<DesignHistoryEntry[]> {
  const entries = (await readDesignHistory(workspaceRoot)).filter((e) => e.entryPath !== entry.entryPath);
  entries.push(entry);
  const kept = entries.slice(-DESIGN_HISTORY_LIMIT);
  const file = designHistoryPath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ version: 1, entries: kept } satisfies HistoryFile, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, file);
  return kept;
}

/** False only when `.open-design/config.json` says `"variety": false`. */
export async function varietyEnabled(workspaceRoot: string): Promise<boolean> {
  try {
    const config = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.open-design', 'config.json'), 'utf8'));
    return !(config && typeof config === 'object' && config.variety === false);
  } catch {
    return true;
  }
}

// ---- Look signature -------------------------------------------------------

interface CssRule {
  selector: string;
  decls: Map<string, string>;
}

function parseDecls(body: string): Map<string, string> {
  const decls = new Map<string, string>();
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i <= 0) continue;
    const name = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).replace(/!important/i, '').trim();
    if (name && value) decls.set(name, value);
  }
  return decls;
}

/** Flat rules from every <style> block; rules nested in @media come out as plain rules, which is enough here. */
function cssRules($: CheerioAPI): CssRule[] {
  const css = $('style')
    .map((_, el) => $(el).text())
    .get()
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith('@')) continue;
    rules.push({ selector, decls: parseDecls(m[2]) });
  }
  return rules;
}

function selectorMatches(selector: string, test: (one: string) => boolean): boolean {
  return selector.split(',').some((s) => test(s.trim().toLowerCase()));
}

function firstFamily(value: string | undefined, lookup: (name: string) => string | undefined): string | undefined {
  if (!value) return undefined;
  let v = value.trim();
  for (let i = 0; i < 5; i++) {
    const ref = /^var\(\s*--([\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
    if (!ref) break;
    const next = lookup(ref[1]) ?? ref[2];
    if (!next) return undefined;
    v = next.trim();
  }
  const family = v.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
  if (!family || family.startsWith('var(')) return undefined;
  return family;
}

function colorOf(value: string | undefined, lookup: (name: string) => string | undefined): string | undefined {
  if (!value) return undefined;
  // A `background` shorthand may carry an image or position; take its first colour-looking part.
  const candidates = [value, ...value.split(/\s+(?![^(]*\))/)];
  for (const candidate of candidates) {
    const resolved = resolveColorValue(candidate, lookup);
    if (resolved) return resolved;
  }
  return undefined;
}

function heroLayout($: CheerioAPI, rules: CssRule[]): HeroLayout | undefined {
  // cheerio's load() always wraps a fragment in html and body.
  const body = $('body');
  const heroEl = body.find('.hero, [class*="hero"], [id*="hero"]').first();
  const first = heroEl.length ? heroEl : body.find('main > section, body > section, section, header').filter((_, el) => $(el).find('h1, h2').length > 0).first();
  if (!first.length) return body.find('h1').length ? 'centred' : 'none';

  const classes = (first.attr('class') ?? '').split(/\s+/).filter(Boolean);
  const id = first.attr('id');
  const own = rules.filter((r) => selectorMatches(r.selector, (s) => classes.some((c) => s.endsWith(`.${c.toLowerCase()}`)) || (id !== undefined && s.endsWith(`#${id.toLowerCase()}`))));
  const style = parseDecls(first.attr('style') ?? '');
  const backgrounds = [style.get('background'), style.get('background-image'), ...own.flatMap((r) => [r.decls.get('background'), r.decls.get('background-image')])];
  if (first.find('video').length > 0 || backgrounds.some((b) => b && /url\(/i.test(b))) return 'full-bleed-image';

  // Two columns: the hero (or its single wrapper) holds two blocks, one with the heading and one with media or a form.
  let container = first;
  for (let i = 0; i < 2 && container.children().length === 1; i++) container = container.children().first();
  const blocks = container.children().filter((_, el) => !['script', 'style'].includes((el as { tagName?: string }).tagName ?? ''));
  if (blocks.length === 2) {
    const [a, b] = [blocks.eq(0), blocks.eq(1)];
    const media = (x: typeof a): boolean => x.is('img, picture, svg, figure, video, canvas, form') || x.find('img, picture, svg, figure, canvas, form').length > 0;
    const heading = (x: typeof a): boolean => x.is('h1, h2') || x.find('h1, h2').length > 0;
    if ((heading(a) && media(b)) || (heading(b) && media(a))) return 'split';
  }
  return 'centred';
}

/** The look of one page: accent, display and body fonts, light or dark, and hero layout. */
export function lookSignatureFromHtml(html: string): LookSignature {
  const $ = load(html);
  const rules = cssRules($);
  const vars = new Map<string, string>();
  for (const rule of rules) {
    if (!selectorMatches(rule.selector, (s) => s === ':root' || s === 'html')) continue;
    for (const [name, value] of rule.decls) if (name.startsWith('--') && !vars.has(name.slice(2))) vars.set(name.slice(2), value);
  }
  const lookup = (name: string): string | undefined => vars.get(name);
  const ruleValue = (match: (s: string) => boolean, prop: string): string | undefined => {
    for (const rule of rules) if (selectorMatches(rule.selector, match) && rule.decls.has(prop)) return rule.decls.get(prop);
    return undefined;
  };
  const sig: LookSignature = {};

  const accent =
    colorOf(vars.get('accent') ?? vars.get('color-accent') ?? vars.get('primary') ?? vars.get('color-primary'), lookup) ?? buttonBackground($, rules, lookup);
  if (accent) sig.accent = accent;

  // Without a display token, only a page with an h1 says what its display font is.
  const h1 = $('h1').first();
  const displayToken = vars.get('font-display') ?? vars.get('font-heading');
  const display = firstFamily(
    displayToken ?? (h1.length ? parseDecls(h1.attr('style') ?? '').get('font-family') ?? ruleValue((s) => /(^|[\s>])h1$/.test(s), 'font-family') : undefined),
    lookup,
  );
  if (display) sig.displayFont = display;
  const bodyFont = firstFamily(vars.get('font-body') ?? vars.get('font-sans') ?? parseDecls($('body').attr('style') ?? '').get('font-family') ?? ruleValue((s) => s === 'body' || s === 'html', 'font-family'), lookup);
  if (bodyFont) sig.bodyFont = bodyFont;

  const bg = colorOf(
    vars.get('bg') ?? vars.get('background') ?? vars.get('color-bg') ?? parseDecls($('body').attr('style') ?? '').get('background') ?? ruleValue((s) => s === 'body' || s === 'html', 'background') ?? ruleValue((s) => s === 'body' || s === 'html', 'background-color'),
    lookup,
  );
  const lum = bg ? relativeLuminance(bg) : undefined;
  if (lum !== undefined) sig.theme = lum < 0.2 ? 'dark' : 'light';

  const hero = heroLayout($, rules);
  if (hero) sig.hero = hero;
  return sig;
}

/** The most used button background, from inline styles and button rules. */
function buttonBackground($: CheerioAPI, rules: CssRule[], lookup: (name: string) => string | undefined): string | undefined {
  const counts = new Map<string, number>();
  const add = (value: string | undefined, weight = 1): void => {
    const c = colorOf(value, lookup);
    if (c && !/^#(ffffff|000000)$/i.test(c) && !c.startsWith('rgba')) counts.set(c, (counts.get(c) ?? 0) + weight);
  };
  $('button, .btn, .button, a[class*="btn"], a[class*="button"]').each((_, el) => {
    const d = parseDecls($(el).attr('style') ?? '');
    add(d.get('background') ?? d.get('background-color'));
  });
  for (const rule of rules) {
    if (!selectorMatches(rule.selector, (s) => /(^|[\s.>])(button|btn|cta)([\s.:>-]|$)/.test(s) && !s.includes(':hover'))) continue;
    add(rule.decls.get('background') ?? rule.decls.get('background-color'), 2);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [c, n] of counts) if (n > bestCount) [best, bestCount] = [c, n];
  return best;
}

/** Reads the entry's HTML (when it is HTML) and records it in the history. Never throws: a lost entry is harmless. */
export async function recordDesignHistory(
  workspaceRoot: string,
  entry: Omit<DesignHistoryEntry, 'date' | 'signature'> & { date?: string },
): Promise<void> {
  try {
    let signature: LookSignature = {};
    if (/\.html?$/i.test(entry.entryPath)) {
      signature = lookSignatureFromHtml(await fs.readFile(path.resolve(workspaceRoot, entry.entryPath), 'utf8'));
    }
    await upsertDesignHistory(workspaceRoot, { ...entry, date: entry.date ?? new Date().toISOString(), signature });
  } catch {
    // The history is a nudge, never a reason for registration to fail.
  }
}

// ---- Recent designs for a brief ---------------------------------------------

export interface RecentDesign {
  title: string;
  date: string;
  signature: LookSignature;
}

export interface RecentDesignsContext {
  /** Unrelated recent designs, newest first, to look different from. */
  differFrom: RecentDesign[];
  /** Screens of the same collection, newest first, to stay consistent with. */
  consistentWith: RecentDesign[];
}

function hasSignal(sig: LookSignature): boolean {
  return Boolean(sig.accent || sig.displayFont || sig.theme || (sig.hero && sig.hero !== 'none'));
}

/** Picks what a brief should see from the history; undefined when there's nothing to say. */
export function recentDesignsFor(
  history: DesignHistoryEntry[],
  current: { collectionId?: string; entryPath?: string },
  limit = RECENT_DESIGNS_LIMIT,
): RecentDesignsContext | undefined {
  const newestFirst = [...history].reverse().filter((e) => e.entryPath !== current.entryPath && hasSignal(e.signature));
  const toRecent = (e: DesignHistoryEntry): RecentDesign => ({ title: e.title, date: e.date, signature: e.signature });
  const consistentWith = current.collectionId ? newestFirst.filter((e) => e.collectionId === current.collectionId).slice(0, limit).map(toRecent) : [];
  // Within a collection, matching its screens matters more than differing from everything else.
  const differFrom = consistentWith.length > 0 ? [] : newestFirst.filter((e) => !e.directionId && (!current.collectionId || e.collectionId !== current.collectionId)).slice(0, limit).map(toRecent);
  if (differFrom.length === 0 && consistentWith.length === 0) return undefined;
  return { differFrom, consistentWith };
}

/** The history entries a brief should see, honouring the `variety` switch. */
export async function loadRecentDesigns(workspaceRoot: string | undefined, current: { collectionId?: string; entryPath?: string }): Promise<RecentDesignsContext | undefined> {
  if (!workspaceRoot || !(await varietyEnabled(workspaceRoot))) return undefined;
  return recentDesignsFor(await readDesignHistory(workspaceRoot), current);
}

const HERO_TEXT: Record<HeroLayout, string> = {
  centred: 'centred hero',
  split: 'split hero',
  'full-bleed-image': 'full-bleed image hero',
  none: 'no hero',
};

export function describeSignature(sig: LookSignature): string {
  const parts: string[] = [];
  if (sig.theme) parts.push(`${sig.theme} theme`);
  if (sig.hero) parts.push(HERO_TEXT[sig.hero]);
  if (sig.displayFont) parts.push(`display font ${sig.displayFont}`);
  if (sig.accent) parts.push(`accent ${sig.accent}`);
  return parts.join(', ');
}

function line(d: RecentDesign): string {
  return `- "${d.title}" (${d.date.slice(0, 10)}): ${describeSignature(d.signature)}`;
}

/** The recent-designs section of a brief, or '' when there's nothing to list. */
export function composeRecentDesignsSection(ctx: RecentDesignsContext | undefined, hasDesignSystem: boolean): string {
  if (!ctx) return '';
  if (ctx.consistentWith.length > 0) {
    return `## Keep consistent with\n\nThe screens of this collection so far looked like this:\n\n${ctx.consistentWith.map(line).join('\n')}\n\nMatch them: same theme, hero treatment, fonts and accent.`;
  }
  if (ctx.differFrom.length === 0) return '';
  const system = hasDesignSystem ? ' The design system above stays authoritative: keep its tokens and vary only what it leaves open.' : '';
  return `## Recent designs in this workspace\n\n${ctx.differFrom.map(line).join('\n')}\n\nUnless the user asked for the same look, or the design system fixes it, make this one recognisably different in at least two of: theme, hero layout, display font, accent.${system}`;
}
