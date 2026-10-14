// Pure, fetch/fs-free extraction logic for turning one Meliwat/awesome-ios-design-md
// app entry (`design-md/<category>/<app>/DESIGN.md` + README.md) into a REVIEW
// SCAFFOLD for a new local "Mobile Apps" design-system package — not final
// content. See packages/content/local/README.md for the scaffold -> review ->
// move-into-local/design-systems/ workflow this feeds.
//
// Unlike typeui (structured-but-unreliable frontmatter), these files have no
// frontmatter, but their prose is regular: all 200 share the same nine
// numbered sections, §2 lists colours as `- **Role Name** (`#hex`): role
// description`, §3 has a hierarchy table, and §9 restates the key colours in
// a "Quick Color Reference" list. Measured against all 200 on 2026-10-13:
// accent found 100%, bg 99%, fg 98%, border 97%, muted 96%, surface 83%;
// §9 agreed with the extracted accent 186/192. A hand check of a random
// sample found ~86% of values right. The misses were systemic, and each one
// is flagged in the notes below rather than guessed silently:
//   - light-mode "Surface Gray" is usually the grouped/section background,
//     while the actual cards are white;
//   - "Text Secondary" sometimes means body text when a "Text Muted" exists;
//   - apps whose colour means data (Oura, Apple Fitness, Calm) list several
//     equal accents under "Primary", so the first one isn't always the UI accent;
//   - gradient canvases and rgba "glass" surfaces have no single hex.
// Role *names* vary a lot (brand-named canvases like "Hinge Cream", inline
// `#A light / #B dark` pairs, the hex inside the bold name, the mode stated
// only in a subsection heading), which is what most of the parsing below is for.

export const MOBILE_CATEGORY = 'Mobile Apps';
export const SOURCE_REPO_URL = 'https://github.com/Meliwat/awesome-ios-design-md';
export const SOURCE_COPYRIGHT = 'Copyright (c) 2026 Muhammed Eliwat';
export const SOURCE_LICENSE = 'MIT';
const ID_SUFFIX = '-ios';

// ---------- colour helpers ----------

const HEX_RE = /#([0-9a-fA-F]{6})\b/g;
const hexAll = (s) => [...s.matchAll(HEX_RE)].map((m) => '#' + m[1].toUpperCase());

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance of a #rrggbb hex, 0 (black) to 1 (white). */
export function luminance(hex) {
  const c = rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** HSV saturation, 0 (grey) to 1. */
export function saturation(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
}

const isDark = (hex) => luminance(hex) < 0.2;

// ---------- markdown helpers ----------

/** Body of the `## <n>. …` section, without its heading. */
export function section(md, n) {
  const re = new RegExp(`^## ${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## \\d+\\.|(?![\\s\\S]))`, 'm');
  return md.match(re)?.[1] ?? '';
}

function subsections(body) {
  const out = [];
  let cur = { heading: '', lines: [] };
  for (const line of body.split('\n')) {
    if (line.startsWith('### ')) {
      out.push(cur);
      cur = { heading: line.slice(4).trim(), lines: [] };
    } else cur.lines.push(line);
  }
  out.push(cur);
  return out;
}

/** 'dark' / 'light' when the text names exactly one of them, else null. */
export function modeOf(text) {
  const t = text.toLowerCase();
  const d = /\bdark\b/.test(t);
  const l = /\blight\b/.test(t);
  if (d && !l) return 'dark';
  if (l && !d) return 'light';
  return null;
}

// ---------- §2 colour entries ----------

// Names that are never a base role even when they mention one (a pressed
// canvas, a code-block background, a chat bubble …).
const EXCLUDE = /\bcode\b|pressed|hover|tint|wash|scrim|overlay|selection|bubble|input|disabled|placeholder|\bon[- ]|gradient|highlight|shadow|glow|focus/i;

/** Every `- **Name** (`#hex`): description` line in §2, with its mode and any inline light/dark pair. */
export function parseColorEntries(md) {
  const entries = [];
  for (const sub of subsections(section(md, 2))) {
    const subMode = modeOf(sub.heading);
    for (const line of sub.lines) {
      const m = line.match(/^\s*- \*\*(.+?)\*\*:?\s*(.*)$/);
      if (!m) continue;
      const [, rawName, rest] = m;
      const hexes = hexAll(rawName + ' ' + rest);
      if (!hexes.length) continue;
      const name = rawName.replace(/\(?`?#[0-9a-fA-F]{6,8}`?\)?/g, '').replace(/\s+/g, ' ').trim();
      const byMode = {};
      for (const pm of (rawName + ' ' + rest).matchAll(/#([0-9a-fA-F]{6})`?\s*\(?(light|dark)\b/gi)) {
        byMode[pm[2].toLowerCase()] ??= '#' + pm[1].toUpperCase();
      }
      const desc = rest.replace(/^\(?`?#[^)]*\)?:?\s*/, '');
      const clause = desc.split(/\s[—–]\s|\.\s|;|,/)[0];
      entries.push({ name, hex: hexes[0], byMode, sub: sub.heading, mode: modeOf(name) ?? subMode, desc, clause });
    }
  }
  return entries;
}

const hexFor = (e, mode) => e.byMode[mode] ?? e.hex;

const NAME = {
  bg: /\b(canvas|background|wallpaper)\b/i,
  surface:
    /^(?:(?:dark|light)\s+)?(?:surface(?:\s*1)?|card(?: surface| white)?|elevated surface|surface (?:gray|grey|raised))(?:\s*\((?:dark|light)[^)]*\))?$/i,
  fg: /text primary|primary text|label primary|^ink$|^(?:dark|light )?text(?: \((?:dark|light)\))?$|^body text/i,
  muted: /text secondary|secondary text|label secondary|text muted|muted text|^secondary (?:gray|grey)$/i,
  border: /divider|separator|hairline|\bborder\b|\brule\b/i,
};
const CLAUSE = {
  bg: /\b(canvas|screen background|app background|every screen)\b/i,
  surface: /^(?:the )?(?:cards?\b|card fill|card backgrounds?|elevated surfaces?)/i,
  fg: /\b(primary text|primary body text|body text|primary ink)\b/i,
  muted: /\b(secondary text|metadata|secondary labels?)\b/i,
  border: /\b(dividers?|hairlines?|separators?)\b/i,
};

function roleOf(e, nameOnly = false) {
  if (EXCLUDE.test(e.name)) return null;
  for (const r of Object.keys(NAME)) if (NAME[r].test(e.name)) return r;
  if (nameOnly) return null;
  for (const r of Object.keys(CLAUSE)) if (CLAUSE[r].test(e.clause)) return r;
  return null;
}

/** Which mode the app treats as canonical, and why. */
export function primaryMode(md, entries = parseColorEntries(md)) {
  const s2 = section(md, 2);
  for (const h of s2.split('\n').filter((l) => l.startsWith('### '))) {
    if (/no light mode|dark-only|permanently dark/i.test(h)) return { mode: 'dark', why: 'heading' };
    const m = modeOf(h.replace(/dark-first/i, 'dark'));
    if (!m) continue;
    const other = m === 'dark' ? 'light' : 'dark';
    if (/not used|unused/i.test(h)) return { mode: other, why: 'heading' };
    if (/default|the only|\b(light|dark)[ -]only\b|primary|canonical|native|first/i.test(h)) return { mode: m, why: 'heading' };
    if (/limited|rarely|fallback|optional|only\b/i.test(h)) return { mode: other, why: 'heading' };
  }
  const bare = entries.find((e) => roleOf(e) === 'bg' && !e.mode && !Object.keys(e.byMode).length);
  if (bare) return { mode: isDark(bare.hex) ? 'dark' : 'light', why: 'unqualified canvas' };
  const prose = (section(md, 1) + s2).toLowerCase();
  if (/dark-first|dark-only|dark-native|dark only|effectively dark|true-dark|dark by default|permanently dark|always dark/.test(prose)) {
    return { mode: 'dark', why: 'prose' };
  }
  return { mode: 'light', why: 'default' };
}

function pickRole(entries, role, mode) {
  let best = null;
  let bestScore = -1;
  for (const e of entries) {
    const strength = roleOf(e, true) === role ? 2 : roleOf(e) === role ? 1 : 0;
    if (!strength) continue;
    const modeFit = e.byMode[mode] || e.mode === mode ? 2 : !e.mode ? 1 : 0;
    if (!modeFit) continue;
    let score = modeFit * 10 + strength;
    // Systemic misreads from the dry run: prefer a card-described surface over
    // a grouped-background "Surface Gray", and an explicitly muted/metadata
    // text over a "Text Secondary" that is really body copy.
    // A chat wallpaper is a canvas only when nothing is called the app canvas.
    if (role === 'bg' && /wallpaper/i.test(e.name)) score -= 1;
    if (role === 'surface' && strength === 2 && /\bcards?\b/i.test(e.clause)) score += 3;
    if (role === 'surface' && /\b(gray|grey)\b/i.test(e.name)) score -= 1;
    if (role === 'muted' && /tertiary|quaternary/i.test(e.name)) continue;
    if (role === 'muted' && /^(?:text muted|muted text)(?: \((?:dark|light)\))?$/i.test(e.name) && !/disabled/i.test(e.clause)) score += 3;
    if (role === 'muted' && /^body\b/i.test(e.clause)) score -= 5;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best ? { hex: hexFor(best, mode), name: best.name, sub: best.sub } : null;
}

function pickAccent(entries, mode) {
  const ok = (e) => !/pressed|hover|tint|wash|end\b|logo|disabled|on-|scrim/i.test(e.name);
  const primary = entries.filter((e) => /^primary/i.test(e.sub) && ok(e));
  const cta = entries.find(
    (e) => ok(e) && saturation(hexFor(e, mode)) > 0.25 && /primary (button|cta|action)|\bcta\b|interactive|primary action|chrome accent/i.test(e.name + ' ' + e.clause),
  );
  const out = (e, why) => ({ hex: hexFor(e, mode), name: e.name, sub: e.sub, why });
  // "Booking Blue: brand surfaces" then "CTA Blue: primary action": the stated primary action wins.
  const action = primary.find((e) => /^(?:the )?primary (?:action|cta|button)/i.test(e.clause));
  if (action && action !== primary[0]) return out(action, 'primary subsection, the entry named as the primary action');
  if (primary[0]) {
    const neutral = saturation(hexFor(primary[0], mode)) < 0.15;
    if (neutral && cta) return out(cta, 'neutral primary, used the CTA colour');
    // Several equal "primary" hues (data-coloured apps): a dedicated chrome/CTA accent wins.
    if (!neutral && cta && cta !== primary[0] && !primary.includes(cta) && /chrome accent|single .*accent/i.test(cta.clause + ' ' + cta.desc)) {
      return out(cta, 'dedicated chrome accent');
    }
    return out(primary[0], neutral ? 'monochrome primary' : 'primary subsection');
  }
  if (cta) return out(cta, 'CTA colour');
  const chroma = entries.find((e) => ok(e) && saturation(e.hex) > 0.35 && !/error|red|warning|success|destructive/i.test(e.name));
  return chroma ? out(chroma, 'first chromatic colour') : null;
}

function pickSemantic(entries, re) {
  const e = entries.find((x) => re.test(x.name) && !/pressed|tint|\bbg\b|background|wash/i.test(x.name));
  return e ? { hex: e.hex, name: e.name } : null;
}

// ---------- §3 typography, §4 radii, §5 layout ----------

const FALLBACK_SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

/**
 * Fonts named in §3's "Font Family" list: the display/primary face, a
 * separate body face when one is given, and the free (usually Google Fonts)
 * substitute that 47 of the 200 files recommend for proprietary faces.
 */
export function parseFonts(md) {
  const s3 = section(md, 3);
  const ff = s3.match(/### Font Family[^\n]*\n([\s\S]*?)(?=\n### |$)/)?.[1] ?? s3;
  const items = ff
    .split('\n')
    .map((l) => l.match(/^\s*- \*\*([^*]+)\*\*:?\s*(.*)$/))
    .filter(Boolean)
    .map(([, label, rest]) => ({ label, name: rest.match(/`([^`]+)`/)?.[1]?.trim() || rest.split(/[(,—–;.]/)[0].trim() || null }));
  const find = (re) => items.find((i) => re.test(i.label) && !/fallback|cjk|non-latin|numer|mono/i.test(i.label))?.name ?? null;
  const substitute = find(/substitute|google fonts/i);
  const display = find(/^(primary|display|brand|ui|title|headline)/i) ?? items.find((i) => !/substitute|google|fallback|cjk|non-latin|numer|mono|weight/i.test(i.label))?.name ?? null;
  const body = find(/^body/i) ?? display;
  return { display, body, substitute: substitute && !/^(SF Pro|-apple-system|system)/i.test(substitute) ? substitute.split(/[,/]/)[0].trim() : null };
}

/** The primary UI font family named in §3's "Font Family" list. */
export function parsePrimaryFont(md) {
  return parseFonts(md).display;
}

/** Sizes (pt) from §3's hierarchy table, plus the Body row's size and line height when present. */
export function parseTypeScale(md) {
  const rows = section(md, 3)
    .split('\n')
    .filter((l) => /^\|/.test(l) && !/^\|\s*:?-/.test(l));
  if (rows.length < 2) return null;
  const header = rows[0].split('|').map((c) => c.trim().toLowerCase());
  const sizeCol = header.findIndex((c) => c.startsWith('size'));
  const leadCol = header.findIndex((c) => c.startsWith('line'));
  if (sizeCol < 0) return null;
  const sizes = [];
  let body = null;
  let bodyLeading = null;
  for (const r of rows.slice(1)) {
    const cells = r.split('|').map((c) => c.trim());
    const n = parseFloat(cells[sizeCol]);
    if (!Number.isFinite(n)) continue;
    sizes.push(n);
    if (body == null && /^\**body\b/i.test(cells[1])) {
      body = n;
      const lh = parseFloat(cells[leadCol]);
      if (leadCol >= 0 && Number.isFinite(lh)) bodyLeading = lh > 3 ? +(lh / n).toFixed(2) : lh;
    }
  }
  if (!sizes.length) return null;
  return { sizes: [...new Set(sizes)].sort((a, b) => a - b), body, bodyLeading };
}

/** Radii from §4 component specs ("Corner radius: 12pt", "12pt radius"), excluding pills and hairline bars under 4pt. */
export function parseRadii(md) {
  const s4 = section(md, 4);
  const r = [...s4.matchAll(/radius:?\s*(\d+(?:\.\d+)?)\s*pt/gi), ...s4.matchAll(/(\d+(?:\.\d+)?)\s*pt\s+(?:corner\s+)?radius/gi)]
    .map((m) => +m[1])
    .filter((v) => v >= 4 && v < 100);
  if (!r.length) return null;
  r.sort((a, b) => a - b);
  return { min: r[0], median: r[Math.floor(r.length / 2)], max: r[r.length - 1] };
}

/** Horizontal screen margin from §5 ("Standard margin: 16pt horizontal", "Thread side insets: 12pt"), ignoring paddings inside components. */
export function parseScreenMargin(md) {
  for (const line of section(md, 5).split('\n')) {
    if (!/margin|gutter|side inset|screen inset|horizontal inset|content inset|edge inset/i.test(line)) continue;
    if (/bubble|padding|button|inner|between|gap/i.test(line.split(/[:—]/)[0])) continue;
    const m = line.match(/(\d+)\s*pt/);
    // Outside 8–28pt it's a safe-area or hairline value, not a screen margin.
    if (m && +m[1] >= 8 && +m[1] <= 28) return +m[1];
  }
  return null;
}

/** Maps an iOS point ramp onto the web contract's --text-* tiers (1pt ≈ 1 CSS px). */
export function mapTypeScale(scale) {
  const sizes = scale?.sizes ?? [];
  const base = scale?.body ?? (sizes.includes(17) ? 17 : sizes.includes(16) ? 16 : 16);
  const below = sizes.filter((s) => s < base);
  const above = sizes.filter((s) => s > base);
  const at = (arr, f, fallback) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(f * arr.length))] : fallback);
  const max = sizes.length ? sizes[sizes.length - 1] : 34;
  return {
    '--text-xs': below[0] ?? Math.max(11, base - 4),
    '--text-sm': below[below.length - 1] ?? Math.max(12, base - 2),
    '--text-base': base,
    '--text-md': base,
    '--text-lg': at(above, 0, base + 2),
    '--text-xl': at(above, 1 / 3, base + 6),
    '--text-2xl': at(above, 2 / 3, base + 12),
    '--text-3xl': max,
    '--text-4xl': Math.round(max * 1.3),
  };
}

/**
 * The text colour §4 gives the button filled with `accentHex` ("Background:
 * `#FF3464`" followed within a few lines by "Text: `#FFFFFF`"), or null.
 */
export function parseAccentOn(md, accentHex) {
  if (!accentHex) return null;
  const lines = section(md, 4).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/background|fill/i.test(lines[i]) || !lines[i].toUpperCase().includes(accentHex.toUpperCase())) continue;
    for (const next of lines.slice(i + 1, i + 5)) {
      const m = next.match(/\b(?:text|label|icon|glyph)[^:]*:(.*)$/i);
      if (m) {
        // "Text: `#4F97FF` (text) / `#FFFFFF` (filled)": skip the accent's own hex.
        const hex = hexAll(m[1]).find((h) => h !== accentHex.toUpperCase());
        if (hex) return hex;
        const word = m[1].match(/\b(white|black)\b/i)?.[1];
        if (word) return word.toLowerCase() === 'white' ? '#FFFFFF' : '#000000';
      }
      if (/^\s*$/.test(next) || /^\*\*|^#/.test(next.trim())) break;
    }
  }
  return null;
}

// ---------- §9 quick reference ----------

/** The `- Label: `#hex`` lines of §9's Quick Color Reference. */
export function parseQuickReference(md) {
  const q = section(md, 9).match(/### Quick Color Reference[^\n]*\n([\s\S]*?)(?=\n### |$)/i)?.[1] ?? '';
  return q
    .split('\n')
    .filter((l) => /^\s*-/.test(l) && /#[0-9a-fA-F]{6}/.test(l))
    .map((l) => {
      const hexes = hexAll(l);
      const label = l.replace(/^\s*-\s*/, '').split(/:\s*`?#/)[0].replace(/\*\*/g, '').trim();
      const pair = /light\s*\/\s*.*dark/i.test(l) && hexes.length >= 2 ? { light: hexes[0], dark: hexes[1] } : null;
      return { label, hexes, pair };
    });
}

const QR_LABEL = {
  accent: /primary|brand|accent|cta|action|interactive/i,
  bg: /canvas|background/i,
  surface: /surface|card/i,
  fg: /primary text|text primary|^text\b|ink/i,
  muted: /secondary text|text secondary|muted/i,
  border: /divider|separator|border|hairline/i,
};

/** 'agree' | 'elsewhere' | 'disagree' | 'unlisted' | 'n/a' — how §9 restates this role's value. */
export function quickReferenceAgreement(qr, role, hex, mode, name) {
  if (!hex) return 'n/a';
  // §9 usually names the accent by brand ("Spotify Green (action)"), so its first word counts too.
  const brandWord = role === 'accent' && name ? name.split(' ')[0].toLowerCase() : null;
  const pool = qr.filter((q) => QR_LABEL[role].test(q.label) || (brandWord && q.label.toLowerCase().includes(brandWord)));
  const elsewhere = qr.some((q) => q.hexes.includes(hex));
  if (!pool.length) return elsewhere ? 'elsewhere' : 'unlisted';
  for (const q of pool) {
    const m = modeOf(q.label);
    if (q.pair && q.pair[mode] === hex) return 'agree';
    if (!q.pair && (m === null || m === mode) && q.hexes[0] === hex) return 'agree';
  }
  return elsewhere ? 'elsewhere' : 'disagree';
}

// ---------- whole-file extraction ----------

const ROLES = ['accent', 'bg', 'surface', 'fg', 'muted', 'border'];

/** Everything the scaffold needs from one DESIGN.md, with per-role provenance and §9 agreement. */
export function extractIosTokens(md) {
  const entries = parseColorEntries(md);
  const { mode, why: modeWhy } = primaryMode(md, entries);
  const roles = { accent: pickAccent(entries, mode) };
  for (const r of ['bg', 'surface', 'fg', 'muted', 'border']) roles[r] = pickRole(entries, r, mode);
  const qr = parseQuickReference(md);
  const agreement = Object.fromEntries(ROLES.map((r) => [r, quickReferenceAgreement(qr, r, roles[r]?.hex, mode, roles[r]?.name)]));
  return {
    mode,
    modeWhy,
    roles,
    accentOn: parseAccentOn(md, roles.accent?.hex),
    semantic: {
      success: pickSemantic(entries, /success|income|positive|received|online/i),
      warn: pickSemantic(entries, /warning|amber|caution|pending/i),
      danger: pickSemantic(entries, /error|destructive|danger|declined|failure/i),
    },
    hasLightAndDark: entries.some((e) => e.mode === 'light' || e.byMode.light) && entries.some((e) => e.mode === 'dark' || e.byMode.dark),
    font: parsePrimaryFont(md),
    fonts: parseFonts(md),
    typeScale: parseTypeScale(md),
    radii: parseRadii(md),
    screenMargin: parseScreenMargin(md),
    quickReferenceSize: qr.length,
    agreement,
  };
}

// ---------- candidates ----------

export const iosDesignSystemId = (app) => `${app}${ID_SUFFIX}`;

/**
 * Classifies every source app against what's vendored upstream and already
 * ported locally. `sameBrandUpstream` lists apps whose bare slug is an
 * existing (web) upstream system — still portable under the `-ios` id, but
 * worth knowing the two will sit side by side.
 */
export function classifyIosCandidates(apps, upstreamIds, localIds) {
  const result = { ported: [], candidate: [], sameBrandUpstream: [] };
  for (const app of [...apps].sort()) {
    const id = iosDesignSystemId(app);
    if (localIds.has(id) || upstreamIds.has(id)) result.ported.push(app);
    else result.candidate.push(app);
    if (upstreamIds.has(app)) result.sameBrandUpstream.push(app);
  }
  return result;
}

// ---------- scaffold ----------

function titleCase(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The app's display name from its README heading ("# Spotify — iOS design spec"), else from the slug. */
export function parseAppName(readmeMd, app) {
  return readmeMd?.match(/^#\s+(.+?)\s+[—–-]\s+iOS design spec/m)?.[1]?.trim() || titleCase(app);
}

/** The README's one-line summary (the first paragraph under the heading). */
export function parseSummary(readmeMd) {
  const lines = (readmeMd ?? '').split('\n');
  const i = lines.findIndex((l) => l.startsWith('# '));
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (t) return t.startsWith('#') ? '' : t;
  }
  return '';
}

const plainSummary = (s) => {
  const t = s.replace(/`/g, '').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const TODO = (text) => `/* TODO: ${text} */`;
const px = (n) => `${n}px`;

const isSystemFont = (font) => !font || /^(SF Pro|San Francisco|-apple-system|system)/i.test(font);

/** The named face, then the file's free substitute (what a browser can actually load), then the system stack. */
function fontStack(font, substitute) {
  if (isSystemFont(font)) return FALLBACK_SANS;
  return [`"${font}"`, substitute && substitute !== font ? `"${substitute}"` : null, FALLBACK_SANS].filter(Boolean).join(', ');
}

/**
 * Builds the review scaffold for one app. The tokens are extracted, not
 * asserted: every role that came from a weak rule, or that §9 doesn't
 * restate, gets an inline TODO and a NOTES.md checklist item.
 */
export function extractIosDesignSystemScaffold({ category, app, designMd, readmeMd }, upstreamIds, localIds) {
  const id = iosDesignSystemId(app);
  const name = `${parseAppName(readmeMd, app)} (iOS)`;
  const sourceUrl = `${SOURCE_REPO_URL}/tree/main/design-md/${category}/${app}`;
  const x = extractIosTokens(designMd);
  const notes = [];
  const collision = localIds.has(id) ? 'local' : upstreamIds.has(id) ? 'upstream' : null;
  if (collision) notes.push(`COLLISION: "${id}" already exists ${collision === 'local' ? 'under local/design-systems/' : 'upstream'} — re-scaffolding needs --force.`);
  if (upstreamIds.has(app)) {
    notes.push(`Upstream already has a web "${app}" system. Both will be listed; make sure this one's summary says it's the iOS app.`);
  }

  const lines = {};
  const noQuickReference = x.quickReferenceSize === 0;
  if (noQuickReference) {
    const found = ROLES.filter((role) => x.roles[role]).map((role) => `--${role} ${x.roles[role].hex} «${x.roles[role].name}»`);
    notes.push(`No §9 Quick Color Reference to cross-check against, so none of these is verified: ${found.join(', ')}.`);
  }
  for (const role of ROLES) {
    const r = x.roles[role];
    const agree = x.agreement[role];
    if (!r) {
      notes.push(`--${role}: nothing found in §2 — choose it by hand from the DESIGN.md.`);
      continue;
    }
    const where = `«${r.name}»${r.sub ? ` under "${r.sub}"` : ''}`;
    const trusted = agree === 'agree';
    lines[role] = { hex: r.hex, comment: trusted ? '' : ` ${TODO(`from ${where}; §9 ${agree} — confirm`)}` };
    if (!trusted && !noQuickReference) notes.push(`--${role} = ${r.hex} from ${where}; §9 Quick Color Reference ${agree === 'unlisted' ? 'does not list this role' : agree === 'elsewhere' ? 'lists this hex under another role' : agree === 'disagree' ? 'gives a different value' : 'is missing'}.`);
  }
  const acc = x.roles.accent;
  if (acc && !acc.why.startsWith('primary subsection')) notes.push(`--accent came from the ${acc.why} rule («${acc.name}»). Check §1/§4 for the colour the app actually uses for its primary action.`);
  if (acc && saturation(acc.hex) < 0.15) notes.push(`--accent ${acc.hex} is neutral — fine for a monochrome brand, but confirm, and check --accent-on contrast.`);
  if (x.roles.surface && x.mode === 'light' && /gray|grey/i.test(x.roles.surface.name)) {
    notes.push(`--surface is «${x.roles.surface.name}», which in light mode is often the grouped background with white cards on top. Check §4's card specs.`);
  }
  if (/gradient/i.test(section(designMd, 2)) || /rgba\(/.test(section(designMd, 2))) {
    notes.push('§2 uses gradients and/or rgba colours. Tokens only carry the flat fallbacks; make sure they are the right ones.');
  }
  notes.push(`Primary mode: ${x.mode} (${x.modeWhy}).${x.hasLightAndDark ? ' The app also has the other mode; tokens.css only carries this one.' : ''}`);

  const bg = lines.bg?.hex ?? (x.mode === 'dark' ? '#000000' : '#FFFFFF');
  const fg = lines.fg?.hex ?? (x.mode === 'dark' ? '#FFFFFF' : '#000000');
  const accentHex = lines.accent?.hex ?? '#FF00FF';
  const byContrast = contrastRatio(accentHex, '#FFFFFF') >= contrastRatio(accentHex, '#000000') ? '#FFFFFF' : '#000000';
  const accentOn = x.accentOn ?? byContrast;
  const ratio = (a, b) => contrastRatio(a, b).toFixed(2);
  if (contrastRatio(fg, bg) < 4.5) notes.push(`--fg on --bg is only ${ratio(fg, bg)}:1.`);
  if (!x.accentOn) notes.push(`--accent-on chosen as ${accentOn} by contrast (${ratio(accentHex, accentOn)}:1): §4 gives no text colour for the accent-filled button. Check the primary button spec.`);

  const { display, body: bodyFont, substitute } = x.fonts;
  const font = display;
  if (!font) notes.push('No primary font found in §3.');
  else if (!substitute && !isSystemFont(font) && !/^(Inter|Roboto|Poppins|Lato|Manrope|Nunito|Sora|Archivo|Plus Jakarta Sans|Space Grotesk|Source Serif|Google Sans)/i.test(font)) {
    notes.push(`Primary font "${font}" is likely proprietary and §3 names no free substitute, so the system stack is what will render. Consider adding a close open face to the stack.`);
  }
  const t = mapTypeScale(x.typeScale);
  if (!x.typeScale?.body) notes.push('§3 has no Body row; --text-base was guessed.');
  const r = x.radii ?? { min: 8, median: 12, max: 20 };
  if (!x.radii) notes.push('No "Corner radius: Npt" values in §4; radii are defaults.');
  const margin = x.screenMargin ?? 16;

  const sem = (k, fallback) => x.semantic[k]?.hex ?? fallback;
  const line = (token, role, fallback) => `  ${token}: ${lines[role]?.hex ?? fallback};${lines[role]?.comment ?? ` ${TODO('not found — see NOTES.md')}`}`;

  const tokensCss = `/* ─────────────────────────────────────────────────────────────────────────
 * design-systems/${id}/tokens.css — SCAFFOLD, NOT FINAL. See NOTES.md.
 *
 * ${plainSummary(parseSummary(readmeMd)) || name}
 *
 * Extracted from awesome-ios-design-md (${SOURCE_LICENSE}, ${SOURCE_COPYRIGHT}).
 * Primary mode: ${x.mode}. Sizes are iOS points mapped 1:1 to CSS px.
 * ─────────────────────────────────────────────────────────────────── */

:root {
  /* Surface */
${line('--bg', 'bg', bg)}
${line('--surface', 'surface', `color-mix(in oklab, var(--bg), var(--fg) 6%)`)}
  --surface-warm: color-mix(in oklab, var(--surface), var(--fg) 6%);

  /* Foreground */
${line('--fg', 'fg', fg)}
  --fg-2: color-mix(in oklab, var(--fg), var(--bg) 15%);
${line('--muted', 'muted', 'color-mix(in oklab, var(--fg), var(--bg) 45%)')}
  --meta: color-mix(in oklab, var(--muted), var(--bg) 25%);

  /* Border */
${line('--border', 'border', 'color-mix(in oklab, var(--fg), var(--bg) 88%)')}
  --border-soft: color-mix(in oklab, var(--border), var(--bg) 50%);

  /* Accent */
${line('--accent', 'accent', accentHex)}
  --accent-on: ${accentOn};
  --accent-hover: color-mix(in oklab, var(--accent), black 8%);
  --accent-active: color-mix(in oklab, var(--accent), black 14%);

  /* Semantic */
  --success: ${sem('success', '#34C759')};
  --warn: ${sem('warn', '#FF9500')};
  --danger: ${sem('danger', '#FF3B30')};

  /* Typography — fonts */
  --font-display: ${fontStack(display, substitute)};
  --font-body: ${fontStack(bodyFont, isSystemFont(bodyFont) ? null : substitute)};
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;

  /* Typography — type scale (from §3's hierarchy table) */
${Object.entries(t)
  .map(([k, v]) => `  ${k}: ${px(v)};`)
  .join('\n')}

  /* Typography — leading & tracking */
  --leading-body: ${x.typeScale?.bodyLeading ?? 1.4};
  --leading-tight: 1.15;
  --tracking-display: -0.01em;

  /* Radius (from §4's corner radii) */
  --radius-sm: ${px(r.min)};
  --radius-md: ${px(r.median)};
  --radius-lg: ${px(r.max)};
  --radius-pill: 9999px;

  /* Layout — a phone screen; desktop/tablet values only matter if a page is
   * stretched beyond one. */
  --section-y-desktop: 64px;
  --section-y-tablet: 40px;
  --section-y-phone: 24px;
  --container-max: 430px;
  --container-gutter-desktop: ${px(margin)};
  --container-gutter-tablet: ${px(margin)};
  --container-gutter-phone: ${px(margin)};
}
`;

  const summary = plainSummary(parseSummary(readmeMd));
  const body = designMd.slice(designMd.search(/^## 1\./m));
  const designMdOut = `# Design System Inspired by ${parseAppName(readmeMd, app)} (iOS)

> Category: ${MOBILE_CATEGORY}
> ${summary || 'TODO: one-line summary.'}

This is a native mobile app system: screens are phone-sized, sizes are iOS
points (1pt ≈ 1 CSS px), and components follow Apple's HIG (tab bars,
navigation bars, sheets, 44pt hit targets). \`tokens.css\` carries the
${x.mode} palette${x.hasLightAndDark ? '; the other mode is described in §2' : ''}.

${body.trimEnd()}

---

Adapted from [awesome-ios-design-md](${sourceUrl}), ${SOURCE_COPYRIGHT}, ${SOURCE_LICENSE} License.
`;

  const manifest = {
    schemaVersion: 'od-design-system-project/v1',
    id,
    name,
    category: MOBILE_CATEGORY,
    description: summary || 'TODO',
    source: {
      type: 'inspired',
      origin: `Adapted from Meliwat/awesome-ios-design-md (${SOURCE_LICENSE}, ${SOURCE_COPYRIGHT})`,
      url: sourceUrl,
    },
    files: {
      design: 'DESIGN.md',
      tokens: 'tokens.css',
    },
    craft: {
      applies: [],
      suggested: ['color', 'accessibility-baseline'],
      exemptions: [],
    },
  };

  return { id, manifest, tokensCss, designMd: designMdOut, notes, collision, extraction: x };
}

// ---------- whole-catalog report ----------

/** The dry-run summary: per-role coverage and §9 agreement across many extractions. */
export function summarizeExtractions(extractions) {
  const n = extractions.length;
  const count = (f) => extractions.filter(f).length;
  const roles = Object.fromEntries(
    ROLES.map((role) => [
      role,
      {
        found: count((x) => x.roles[role]),
        agree: count((x) => x.agreement[role] === 'agree'),
        elsewhere: count((x) => x.agreement[role] === 'elsewhere'),
        disagree: count((x) => x.agreement[role] === 'disagree'),
        unlisted: count((x) => x.agreement[role] === 'unlisted'),
      },
    ]),
  );
  return {
    total: n,
    dark: count((x) => x.mode === 'dark'),
    roles,
    font: count((x) => x.font),
    typeTable: count((x) => x.typeScale),
    bodySize: count((x) => x.typeScale?.body),
    radii: count((x) => x.radii),
    fgContrastOk: count((x) => x.roles.bg && x.roles.fg && contrastRatio(x.roles.bg.hex, x.roles.fg.hex) >= 4.5),
    clean: count(
      (x) =>
        ROLES.every((r) => x.roles[r]) &&
        contrastRatio(x.roles.bg.hex, x.roles.fg.hex) >= 4.5 &&
        x.font &&
        ['accent', 'bg', 'fg'].every((r) => x.agreement[r] === 'agree' || x.agreement[r] === 'unlisted'),
    ),
  };
}
