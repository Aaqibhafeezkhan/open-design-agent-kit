// Consistency between a bundled design system's two vendored files
// (openspec reconcile-design-system-sources). Upstream's template DESIGN.md
// states machine-made values ("- **Primary:** `#58CC02` — Token from style
// foundations.") that often disagree with the same system's tokens.css. This
// module compares the two, suggests which side is the truth, and generates
// the overlays that make them agree: a tokens.override.css when DESIGN.md is
// the truth, a DESIGN.sections.md when tokens.css is. Pure functions only;
// audit-design-system-consistency.mjs and check-content-sync.mjs do the I/O.

export const TOKENS_OVERRIDE_FILE = 'tokens.override.css';
export const DESIGN_SECTIONS_FILE = 'DESIGN.sections.md';
export const SOURCES_FILE = 'design-system-sources.json';
export const AUDIT_COMMAND = 'npm run audit-design-systems --workspace=@feimacode/open-design-agent-kit-content';
export const GENERATED_SECTIONS_HEADER = '<!-- generated from tokens.css by audit-design-system-consistency.mjs; do not edit -->';
export const GENERATED_OVERRIDE_HEADER = '/* generated from DESIGN.md by audit-design-system-consistency.mjs; do not edit. */';

// Placeholder values, listed rather than inferred so a system that really
// uses one of them can be decided by hand and isn't flagged again:
// - #2563eb: the accent upstream's tokens.css generator falls back to (Tailwind blue-600);
//   the 8 original hand-written overrides were all fixing it.
// - #3b82f6: the Primary upstream's DESIGN.md template falls back to (Tailwind blue-500);
//   15 template DESIGN.md files carry it.
// - Inter: the body font 48 of 57 template tokens.css files use whatever the
//   DESIGN.md says, so a lone Inter against a different named family is the
//   generator default, not a choice.
export const PLACEHOLDER_COLORS = ['#2563eb', '#3b82f6'];
export const PLACEHOLDER_FONT = 'inter';

// Template colour bullet → contract token.
export const COLOR_FIELDS = [
  ['Primary', '--accent'],
  ['Success', '--success'],
  ['Warning', '--warn'],
  ['Danger', '--danger'],
  ['Background', '--bg'],
  ['Surface', '--surface'],
  ['Text', '--fg'],
];
// Template `**Families:**` key → contract token.
export const FAMILY_FIELDS = [
  ['primary', '--font-body'],
  ['display', '--font-display'],
  ['mono', '--font-mono'],
];
const TEXT_STEPS = ['--text-xs', '--text-sm', '--text-base', '--text-lg', '--text-xl', '--text-2xl', '--text-3xl', '--text-4xl'];

// ── Parsing ──────────────────────────────────────────────────────────────

/** `#abc` / `#AABBCC` → `#aabbcc`; anything else → its trimmed lowercase text. */
export function normalizeColor(value) {
  const v = String(value).trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return v;
}

/** First family of a font stack, unquoted and lowercased: `"Nunito", Arial` → `nunito`. */
export function firstFamily(stack) {
  return String(stack).split(',')[0].trim().replace(/^["']|["']$/g, '').trim().toLowerCase();
}

/**
 * Declarations of every top-level plain `:root { … }` block, later winning
 * (same rule as core's parseTokensCss: theme variants are not the base set).
 * A file with no top-level `:root` block falls back to every declaration.
 */
export function parseRootTokens(css) {
  const text = String(css ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
  const rootBodies = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = -1;
  let selector = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) {
        selector = text.slice(selectorStart, i).trim();
        bodyStart = i + 1;
      }
      depth++;
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (selector === ':root' && bodyStart >= 0) rootBodies.push(text.slice(bodyStart, i));
        selectorStart = i + 1;
        bodyStart = -1;
      }
    }
  }
  const source = rootBodies.length > 0 ? rootBodies.join('\n') : text;
  const out = new Map();
  for (const m of source.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g)) out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return out;
}

/** Vendored tokens with an override applied on top. */
export function resolveTokens(tokensCss, overrideCss) {
  const tokens = parseRootTokens(tokensCss);
  if (overrideCss) for (const [k, v] of parseRootTokens(overrideCss)) tokens.set(k, v);
  return tokens;
}

/** A token's value with plain `var(--x)` references substituted from the same set. */
export function tokenValue(tokens, name, depth = 0) {
  const value = tokens.get(name);
  if (value === undefined || depth > 8) return value;
  return value.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^()]*))?\)/g, (whole, ref, fallback) =>
    ref === name ? (fallback?.trim() ?? whole) : (tokenValue(tokens, ref, depth + 1) ?? fallback?.trim() ?? whole),
  );
}

function pxNumber(value) {
  const m = /^(-?\d+(?:\.\d+)?)(px|rem)?$/.exec(String(value ?? '').trim());
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
  return Math.round(n * 100) / 100;
}

/** `12/14/16` → [12, 14, 16]; prose ("8pt baseline grid") → undefined. */
function parseNumberList(text) {
  const t = String(text).trim();
  if (!/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)+$/.test(t)) return undefined;
  return t.split('/').map((s) => Number(s.trim()));
}

/** Split a Markdown document into its preamble and `## ` sections. */
export function splitSections(markdown) {
  const lines = String(markdown).split('\n');
  const sections = [];
  const preamble = [];
  let current;
  let fence = false;
  for (const line of lines) {
    if (/^(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^## /.test(line)) {
      current = { heading: line, title: sectionTitle(line), lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

/** `## 2. Color` → `color`; `## Spacing & Grid` → `spacing & grid`. */
export function sectionTitle(headingLine) {
  return headingLine.replace(/^##\s+/, '').replace(/^\d+[.)]\s*/, '').trim().toLowerCase();
}

function joinSections({ preamble, sections }) {
  return [...preamble, ...sections.flatMap((s) => [s.heading, ...s.lines])].join('\n');
}

/**
 * Replace each section the overlay names (matched by heading text without
 * its leading number) with the overlay's body, keeping the vendored heading
 * line and every other section verbatim. Throws on a heading the vendored
 * document doesn't have.
 */
export function applyDesignSections(designMd, sectionsMd, label = 'design system') {
  const base = splitSections(designMd);
  const overlay = splitSections(String(sectionsMd).replace(/^\s*<!--[\s\S]*?-->\s*\n?/, ''));
  for (const section of overlay.sections) {
    const target = base.sections.find((s) => s.title === section.title);
    if (!target) throw new Error(`${label}: ${DESIGN_SECTIONS_FILE} names a section DESIGN.md doesn't have: "${section.heading.replace(/^##\s+/, '')}"`);
    const body = [...section.lines];
    while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
    const hadTrailingBlank = target.lines.length > 0 && target.lines[target.lines.length - 1].trim() === '';
    target.lines = hadTrailingBlank ? [...body, ''] : body;
  }
  return joinSections(base);
}

/**
 * The template values a DESIGN.md states. `template` is false for a
 * hand-written DESIGN.md (no "Token from style foundations" bullets), which
 * the audit leaves alone.
 */
export function parseTemplateDesignMd(designMd) {
  const text = String(designMd);
  const template = /Token from style foundations/.test(text);
  const colors = {};
  for (const m of text.matchAll(/^- \*\*([A-Za-z]+):\*\*\s*`([^`]+)`/gm)) {
    if (COLOR_FIELDS.some(([label]) => label === m[1]) || m[1] === 'Secondary' || m[1] === 'Neutral') colors[m[1]] = m[2].trim();
  }
  const families = {};
  const familiesLine = /^- \*\*Families:\*\*\s*(.+)$/m.exec(text)?.[1];
  if (familiesLine) for (const m of familiesLine.matchAll(/(\w+)=([^,]+)/g)) families[m[1].toLowerCase()] = m[2].trim();
  const scaleText = /^- \*\*Scale:\*\*\s*(.+)$/m.exec(text)?.[1];
  const spacingText = /^- \*\*Spacing scale:\*\*\s*(.+)$/m.exec(text)?.[1];
  return {
    template,
    colors,
    families,
    scale: scaleText ? parseNumberList(scaleText) : undefined,
    spacing: spacingText ? parseNumberList(spacingText) : undefined,
  };
}

function tokenScale(tokens) {
  const steps = TEXT_STEPS.map((name) => pxNumber(tokenValue(tokens, name)));
  return steps.every((n) => n !== undefined) ? steps : undefined;
}

function tokenSpacing(tokens) {
  const steps = [...tokens.keys()]
    .map((name) => /^--space-(\d+)$/.exec(name))
    .filter(Boolean)
    .map((m) => [Number(m[1]), pxNumber(tokenValue(tokens, m[0]))])
    .filter(([, px]) => px !== undefined && px > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([, px]) => px);
  return steps.length > 0 ? steps : undefined;
}

// ── Comparison ───────────────────────────────────────────────────────────

/**
 * Every audited field of one system, with both sides' values. `same` is
 * whether they agree; fields one side doesn't state are left out.
 * `group` is `color` or `type`, the two halves a decision covers.
 */
export function compareFields(designMd, tokens) {
  const parsed = parseTemplateDesignMd(designMd);
  if (!parsed.template) return { template: false, fields: [] };
  const fields = [];
  for (const [label, name] of COLOR_FIELDS) {
    const design = parsed.colors[label];
    const tok = tokenValue(tokens, name);
    if (design === undefined || tok === undefined) continue;
    fields.push({ group: 'color', field: label, token: name, design, tokens: tok, same: normalizeColor(design) === normalizeColor(tok) });
  }
  for (const [key, name] of FAMILY_FIELDS) {
    const design = parsed.families[key];
    const tok = tokenValue(tokens, name);
    if (design === undefined || tok === undefined) continue;
    fields.push({ group: 'type', field: `family.${key}`, token: name, design, tokens: tok, same: firstFamily(design) === firstFamily(tok) });
  }
  const scale = tokenScale(tokens);
  if (parsed.scale && scale) {
    fields.push({ group: 'type', field: 'scale', token: '--text-*', design: parsed.scale.join('/'), tokens: scale.join('/'), same: parsed.scale.join('/') === scale.join('/') });
  }
  const spacing = tokenSpacing(tokens);
  if (parsed.spacing && spacing) {
    fields.push({ group: 'type', field: 'spacing', token: '--space-*', design: parsed.spacing.join('/'), tokens: spacing.join('/'), same: parsed.spacing.join('/') === spacing.join('/') });
  }
  return { template: true, fields };
}

function classifyGroup(fields, group) {
  const differing = fields.filter((f) => f.group === group && !f.same);
  if (differing.length === 0) return 'consistent';
  const lead = group === 'color' ? fields.find((f) => f.field === 'Primary') : fields.find((f) => f.field === 'family.primary');
  if (lead && !lead.same) {
    const isPlaceholder = (v) => (group === 'color' ? PLACEHOLDER_COLORS.includes(normalizeColor(v)) : firstFamily(v) === PLACEHOLDER_FONT);
    const designPh = isPlaceholder(lead.design);
    const tokensPh = isPlaceholder(lead.tokens);
    if (designPh && !tokensPh) return 'design-placeholder';
    if (tokensPh && !designPh) return 'tokens-placeholder';
    if (designPh && tokensPh) return 'design-placeholder';
  }
  return 'conflict';
}

const STATUS_RANK = { consistent: 0, 'design-placeholder': 1, 'tokens-placeholder': 1, conflict: 2 };

/** `{ template, fields, color, type, status }` for one system's vendored files (plus override, if given). */
export function auditSystem({ designMd, tokensCss, overrideCss, sectionsMd }) {
  const md = sectionsMd ? applyDesignSections(designMd, sectionsMd) : designMd;
  const { template, fields } = compareFields(md, resolveTokens(tokensCss, overrideCss));
  const color = classifyGroup(fields, 'color');
  const type = classifyGroup(fields, 'type');
  const status = STATUS_RANK[color] >= STATUS_RANK[type] ? color : type;
  return { template, fields, color, type, status };
}

/** The suggested truth for one group: the placeholder side loses, otherwise tokens (what renders today). */
export function suggestSide(groupStatus) {
  return groupStatus === 'tokens-placeholder' ? 'design' : 'tokens';
}

// ── Generation ───────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(normalizeColor(hex));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined;
}

function relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio of two hex colours, or undefined when either isn't hex. */
export function contrastRatio(a, b) {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return undefined;
  const [hi, lo] = [relativeLuminance(ra), relativeLuminance(rb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const NEAR_BLACK = '#111111';
const WHITE = '#ffffff';

function isDark(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? relativeLuminance(rgb) < 0.18 : undefined;
}

const SERIF_FAMILY = /(?<!sans )serif|playfair|gelasio|lora|merriweather|garamond|baskerville|georgia|times/i;
const SERIF_FALLBACK = ['Georgia', '"Times New Roman"', 'serif'];

/**
 * `"Playfair Display"` stays quoted, `Nunito` bare; the vendored stack's
 * fallbacks follow, except that a serif family over a sans stack (or the
 * reverse) gets fallbacks of its own kind.
 */
function fontStack(family, vendoredStack) {
  const name = family.replace(/^["']|["']$/g, '').trim();
  const head = /\s/.test(name) ? `"${name}"` : name;
  let rest = String(vendoredStack ?? '')
    .split(',')
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);
  const wantsSerif = SERIF_FAMILY.test(name);
  const hasSerif = rest.some((s) => /^serif$/i.test(s));
  if (wantsSerif && !hasSerif && !rest.some((s) => /monospace/i.test(s))) rest = SERIF_FALLBACK;
  else if (!wantsSerif && hasSerif) rest = ['system-ui', 'sans-serif'];
  return [head, ...(rest.length > 0 ? rest : ['system-ui', 'sans-serif'])].join(', ');
}

/**
 * The value every audited field ends up with under a decision, and which
 * side has to change to get there. A colour that would flip the light/dark
 * polarity of the page (Surface, Background, Text against the tokens) stays
 * with tokens even under a `design` decision, since the prose around it
 * describes the rendered page. A scale or spacing list stays with tokens
 * unless the template has all eight `--text-*` steps.
 */
export function plannedValues(fields, decision) {
  const plan = [];
  for (const f of fields) {
    if (f.same) continue;
    let side = f.group === 'color' ? decision.color : decision.type;
    if (side === 'design' && ['Surface', 'Background', 'Text'].includes(f.field)) {
      const flips = isDark(f.design) !== isDark(f.tokens);
      if (flips) side = 'tokens';
    }
    if (side === 'design' && f.field === 'scale' && f.design.split('/').length !== TEXT_STEPS.length) side = 'tokens';
    if (side === 'design' && f.field === 'spacing') side = 'tokens';
    plan.push({ ...f, side, value: side === 'design' ? f.design : f.tokens });
  }
  return plan;
}

/**
 * The tokens.override.css for the fields a decision moves onto DESIGN.md's
 * values, or undefined when tokens.css needs no change. `reason` is written
 * into the header comment.
 */
export function generateTokensOverride({ tokensCss, fields, decision, reason }) {
  const tokens = parseRootTokens(tokensCss);
  const plan = plannedValues(fields, decision).filter((p) => p.side === 'design');
  if (plan.length === 0) return undefined;
  const out = new Map();
  const notes = [];
  for (const p of plan) {
    if (p.group === 'color') {
      const value = normalizeColor(p.design);
      out.set(p.token, value);
      if (p.token === '--accent') {
        const old = normalizeColor(tokenValue(tokens, '--accent'));
        const oldRgb = hexToRgb(old);
        const newRgb = hexToRgb(value);
        for (const [name, raw] of tokens) {
          if (name === '--accent') continue;
          if (normalizeColor(raw) === old) out.set(name, value);
          else if (oldRgb && newRgb) {
            const rgba = new RegExp(`rgba?\\(\\s*${oldRgb[0]}\\s*,\\s*${oldRgb[1]}\\s*,\\s*${oldRgb[2]}\\s*([,)])`, 'g');
            if (rgba.test(raw)) out.set(name, raw.replace(rgba, (_m, end) => `${raw.includes('rgba(') ? 'rgba' : 'rgb'}(${newRgb[0]}, ${newRgb[1]}, ${newRgb[2]}${end}`));
          }
        }
        for (const [name, pct] of [['--accent-hover', 8], ['--accent-active', 14]]) {
          if (tokens.has(name) && !/var\(--accent\)/.test(tokens.get(name))) out.set(name, `color-mix(in oklab, var(--accent), black ${pct}%)`);
        }
        const on = tokenValue(new Map([...tokens, ...out]), '--accent-on') ?? WHITE;
        const ratio = contrastRatio(value, on);
        if (ratio !== undefined && ratio < 4.5) {
          const best = contrastRatio(value, WHITE) >= contrastRatio(value, NEAR_BLACK) ? WHITE : NEAR_BLACK;
          if (normalizeColor(best) !== normalizeColor(on)) {
            out.set('--accent-on', best);
            notes.push(`--accent-on set to ${best}: ${on} on ${value} is ${ratio.toFixed(2)}:1, below 4.5:1.`);
          }
        }
      }
    } else if (p.field.startsWith('family.')) {
      out.set(p.token, fontStack(p.design, tokens.get(p.token)));
    } else if (p.field === 'scale') {
      p.design.split('/').forEach((n, i) => out.set(TEXT_STEPS[i], `${n}px`));
    }
  }
  // Only declarations that differ from upstream, so the redundant-override check never trips on our own output.
  for (const [name, value] of [...out]) if (tokens.get(name)?.toLowerCase() === value.toLowerCase()) out.delete(name);
  if (out.size === 0) return undefined;
  const header = [GENERATED_OVERRIDE_HEADER];
  if (reason) header.push(`/* ${reason.replace(/\*\//g, '* /')} */`);
  for (const n of notes) header.push(`/* ${n} */`);
  return `${header.join('\n')}\n:root {\n${[...out].map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
}

function replaceBulletValue(line, label, value) {
  return line.replace(new RegExp(`^(- \\*\\*${label}:\\*\\*\\s*)\`[^\`]+\``), `$1\`${value}\``);
}

/**
 * The DESIGN.sections.md for the fields a decision moves onto tokens.css's
 * values, or undefined when DESIGN.md needs no change. Sections keep the
 * template's own wording with the values swapped: Color, Typography and
 * Spacing & Grid, plus any other section that repeats the old Primary hex.
 */
export function generateDesignSections({ designMd, fields, decision }) {
  const plan = plannedValues(fields, decision).filter((p) => p.side === 'tokens');
  if (plan.length === 0) return undefined;
  const { sections } = splitSections(designMd);
  const byField = new Map(plan.map((p) => [p.field, p]));
  const changed = new Set();
  const colorValue = (label) => {
    const p = byField.get(label);
    return p ? normalizeColor(p.value) : undefined;
  };
  for (const section of sections) {
    const before = section.lines.join('\n');
    if (section.title === 'color') {
      section.lines = section.lines.map((line) => {
        let out = line;
        for (const [label] of COLOR_FIELDS) {
          const v = colorValue(label);
          if (!v) continue;
          out = replaceBulletValue(out, label, v);
          out = out.replace(new RegExp(`\\b${label} \\(#[0-9A-Fa-f]{3,8}\\)`, 'g'), `${label} (${v})`);
        }
        const surface = colorValue('Surface');
        if (surface) out = replaceBulletValue(out, 'Neutral', surface);
        return out;
      });
    } else if (section.title === 'typography') {
      section.lines = section.lines.map((line) => {
        let out = line;
        const famLine = /^(- \*\*Families:\*\*\s*)(.+)$/.exec(out);
        if (famLine) {
          out = famLine[1] + famLine[2].replace(/(\w+)=([^,]+)/g, (whole, key, val) => {
            const p = byField.get(`family.${key.toLowerCase()}`);
            return p ? `${key}=${p.value.split(',')[0].trim().replace(/^["']|["']$/g, '')}` : `${key}=${val}`;
          });
        }
        const scale = byField.get('scale');
        if (scale) out = out.replace(/^(- \*\*Scale:\*\*\s*).+$/, `$1${scale.value}`);
        return out;
      });
    } else if (section.title.startsWith('spacing')) {
      const spacing = byField.get('spacing');
      if (spacing) section.lines = section.lines.map((line) => line.replace(/^(- \*\*Spacing scale:\*\*\s*).+$/, `$1${spacing.value}`));
    } else {
      const primary = byField.get('Primary');
      if (primary) {
        const old = new RegExp(primary.design.replace(/[^#0-9A-Za-z]/g, ''), 'gi');
        section.lines = section.lines.map((line) => line.replace(old, normalizeColor(primary.value)));
      }
    }
    if (section.lines.join('\n') !== before) changed.add(section);
  }
  if (changed.size === 0) return undefined;
  const parts = [...changed].map((s) => {
    const body = [...s.lines];
    while (body.length > 0 && body[0].trim() === '') body.shift();
    while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
    return `## ${s.heading.replace(/^##\s+/, '').replace(/^\d+[.)]\s*/, '')}\n\n${body.join('\n')}\n`;
  });
  return `${GENERATED_SECTIONS_HEADER}\n\n${parts.join('\n')}`;
}

/** Both overlays for one system under a decision (either may be undefined). */
export function generateOverlays({ designMd, tokensCss, decision }) {
  const { fields } = compareFields(designMd, parseRootTokens(tokensCss));
  return {
    override: generateTokensOverride({ tokensCss, fields, decision, reason: decision.reason }),
    sections: generateDesignSections({ designMd, fields, decision }),
  };
}
