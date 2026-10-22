// Resolves CSS `color-mix()` values to literal sRGB colours, for targets that
// accept only plain colours (Claude Design's tokens.json rejects color-mix()).
// Follows CSS Color 5 mixing: percentages normalised, alpha premultiplied,
// hue interpolated the shorter way in polar spaces, a powerless hue (zero
// chroma) taking the other colour's. Results are clamped to the sRGB gamut.

interface Rgba {
  /** Gamma-encoded sRGB channels, 0–1 (may stray outside before clamping). */
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const toLinear = (c: number): number => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number): number => (Math.abs(c) <= 0.0031308 ? c * 12.92 : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055));

function rgbToOklab({ r, g, b }: Rgba): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb(L: number, A: number, B: number, a: number): Rgba {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a,
  };
}

const NAMED: Record<string, Rgba> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 1, g: 1, b: 1, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

/** Function arguments split on spaces/commas, with a `/ alpha` tail. */
function fnArgs(body: string): { parts: string[]; alpha?: string } {
  const [main, alpha] = body.split('/');
  return { parts: main.trim().split(/[\s,]+/).filter(Boolean), alpha: alpha?.trim() };
}

const num = (s: string, percentOf = 1): number => (s.endsWith('%') ? (parseFloat(s) / 100) * percentOf : parseFloat(s));
const alphaOf = (s: string | undefined): number => (s === undefined ? 1 : clamp01(num(s)));

/** Parses a plain colour (hex, rgb(), hsl(), oklab(), oklch(), black/white/transparent). */
export function parseColor(value: string): Rgba | undefined {
  const v = value.trim().toLowerCase();
  if (NAMED[v]) return { ...NAMED[v] };
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    const ch = [0, 2, 4, 6].map((i) => (i < full.length ? parseInt(full.slice(i, i + 2), 16) / 255 : 1));
    return { r: ch[0], g: ch[1], b: ch[2], a: ch[3] };
  }
  const fn = /^(rgba?|hsla?|oklab|oklch)\(([^()]*)\)$/.exec(v);
  if (!fn) return undefined;
  const { parts, alpha } = fnArgs(fn[2]);
  // Legacy comma syntax carries alpha as a fourth argument.
  const a = alphaOf(alpha ?? parts[3]);
  if (parts.length < 3 || parts.slice(0, 3).some((p) => Number.isNaN(parseFloat(p)))) return undefined;
  switch (fn[1]) {
    case 'rgb':
    case 'rgba':
      return { r: num(parts[0], 255) / 255, g: num(parts[1], 255) / 255, b: num(parts[2], 255) / 255, a };
    case 'hsl':
    case 'hsla': {
      const h = (((parseFloat(parts[0]) % 360) + 360) % 360) / 360;
      const s = num(parts[1], 100) / 100;
      const l = num(parts[2], 100) / 100;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue = (t: number): number => {
        const x = ((t % 1) + 1) % 1;
        return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
      };
      return { r: hue(h + 1 / 3), g: hue(h), b: hue(h - 1 / 3), a };
    }
    case 'oklab':
      return oklabToRgb(num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4), a);
    case 'oklch': {
      const L = num(parts[0]);
      const C = num(parts[1], 0.4);
      const H = (parseFloat(parts[2]) * Math.PI) / 180;
      return oklabToRgb(L, C * Math.cos(H), C * Math.sin(H), a);
    }
  }
  return undefined;
}

/** Splits on commas that are not inside parentheses. */
function topLevelArgs(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth--;
    else if (body[i] === ',' && depth === 0) {
      out.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(body.slice(start).trim());
  return out;
}

/** A colour argument with an optional percentage, in either order. */
function colorStop(arg: string): { color: string; pct?: number } {
  const m = /^(.*?)\s+(-?[\d.]+)%$/.exec(arg) ?? /^(-?[\d.]+)%\s+(.*)$/.exec(arg);
  if (!m) return { color: arg };
  return /%$/.test(arg) ? { color: m[1].trim(), pct: parseFloat(m[2]) } : { color: m[2].trim(), pct: parseFloat(m[1]) };
}

type Lookup = (name: string) => string | undefined;

/** Resolves `var(--x)`, nested `color-mix()` and plain colours to an Rgba. */
function resolveColor(value: string, lookup: Lookup, depth: number): Rgba | undefined {
  if (depth > 16) return undefined;
  const v = value.trim();
  const ref = /^var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,\s*(.+))?\)$/.exec(v);
  if (ref) {
    const target = lookup(ref[1]);
    if (target !== undefined) return resolveColor(target, lookup, depth + 1);
    return ref[2] ? resolveColor(ref[2], lookup, depth + 1) : undefined;
  }
  if (/^color-mix\(/i.test(v)) return mix(v, lookup, depth + 1);
  return parseColor(v);
}

function mix(value: string, lookup: Lookup, depth: number): Rgba | undefined {
  const body = /^color-mix\(([\s\S]*)\)$/i.exec(value.trim())?.[1];
  if (!body) return undefined;
  const args = topLevelArgs(body);
  if (args.length !== 3) return undefined;
  const space = /^in\s+([a-z-]+)(?:\s+(shorter|longer|increasing|decreasing)\s+hue)?$/i.exec(args[0]);
  if (!space) return undefined;
  const method = space[1].toLowerCase();
  if (!['oklab', 'oklch', 'srgb'].includes(method)) return undefined;
  const s1 = colorStop(args[1]);
  const s2 = colorStop(args[2]);
  const c1 = resolveColor(s1.color, lookup, depth);
  const c2 = resolveColor(s2.color, lookup, depth);
  if (!c1 || !c2) return undefined;

  let p1 = s1.pct;
  let p2 = s2.pct;
  if (p1 === undefined && p2 === undefined) [p1, p2] = [50, 50];
  else if (p1 === undefined) p1 = 100 - p2!;
  else if (p2 === undefined) p2 = 100 - p1;
  const sum = p1 + p2!;
  if (sum <= 0) return undefined;
  const alphaScale = sum < 100 ? sum / 100 : 1;
  const t = p2! / sum;

  const a = c1.a * (1 - t) + c2.a * t;
  const coords = (c: Rgba): number[] => {
    if (method === 'srgb') return [c.r, c.g, c.b];
    const lab = rgbToOklab(c);
    if (method === 'oklab') return lab;
    const C = Math.hypot(lab[1], lab[2]);
    return [lab[0], C, C < 1e-4 ? NaN : ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360];
  };
  const x1 = coords(c1);
  const x2 = coords(c2);
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const isHue = method === 'oklch' && i === 2;
    if (isHue) {
      // A powerless hue takes the other colour's, so a mix with grey keeps its hue.
      let h1 = Number.isNaN(x1[2]) ? x2[2] : x1[2];
      let h2 = Number.isNaN(x2[2]) ? x1[2] : x2[2];
      if (Number.isNaN(h1)) {
        out.push(0);
        continue;
      }
      if (h2 - h1 > 180) h1 += 360;
      else if (h2 - h1 < -180) h2 += 360;
      out.push(h1 * (1 - t) + h2 * t);
    } else {
      // Premultiplied: a transparent stop contributes no colour, only alpha.
      const v = a === 0 ? 0 : (x1[i] * c1.a * (1 - t) + x2[i] * c2.a * t) / a;
      out.push(v);
    }
  }
  const alpha = a * alphaScale;
  if (method === 'srgb') return { r: out[0], g: out[1], b: out[2], a: alpha };
  if (method === 'oklab') return oklabToRgb(out[0], out[1], out[2], alpha);
  const H = (out[2] * Math.PI) / 180;
  return oklabToRgb(out[0], out[1] * Math.cos(H), out[1] * Math.sin(H), alpha);
}

/** Serialises an Rgba as `#rrggbb`, or `rgba()` when not opaque. */
export function formatColor(c: Rgba): string {
  const ch = [c.r, c.g, c.b].map((x) => Math.round(clamp01(x) * 255));
  const a = Math.round(clamp01(c.a) * 1000) / 1000;
  if (a >= 1) return `#${ch.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  return `rgba(${ch.join(', ')}, ${a})`;
}

/**
 * Resolves a colour value to a literal: `color-mix()`, `var()` and plain
 * colours, looking referenced tokens up (by name without `--`) in `lookup`.
 * Returns undefined when any part can't be resolved.
 */
export function resolveColorValue(value: string, lookup: Lookup): string | undefined {
  const c = resolveColor(value, lookup, 0);
  return c ? formatColor(c) : undefined;
}

/** Replaces every `color-mix()` and colour `var()` inside a composite value (a box-shadow). */
export function resolveColorsIn(value: string, lookup: Lookup): string | undefined {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const rest = value.slice(i);
    const start = /^(color-mix|var)\(/i.exec(rest);
    if (!start) {
      out += value[i++];
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < value.length; j++) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')' && --depth === 0) break;
    }
    const expr = value.slice(i, j + 1);
    const resolved = resolveColorValue(expr, lookup);
    if (resolved === undefined) {
      // A var() that is not a colour (a length) is resolved as plain text.
      const ref = /^var\(\s*--([a-zA-Z0-9_-]+)\s*\)$/.exec(expr)?.[1];
      const text = ref ? lookup(ref) : undefined;
      if (text === undefined || /var\(|color-mix\(/i.test(text)) return undefined;
      out += text;
    } else out += resolved;
    i = j + 1;
  }
  return out;
}

/** WCAG 2 relative luminance of a plain colour, composited over white when translucent. */
export function relativeLuminance(value: string): number | undefined {
  const c = parseColor(value);
  if (!c) return undefined;
  const over = (x: number): number => clamp01(x) * c.a + (1 - c.a);
  return 0.2126 * toLinear(over(c.r)) + 0.7152 * toLinear(over(c.g)) + 0.0722 * toLinear(over(c.b));
}

/** WCAG 2 contrast ratio of two plain colours. */
export function contrastRatio(a: string, b: string): number | undefined {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === undefined || lb === undefined) return undefined;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
