// What a standalone page will lose when it is published as a Claude
// artifact: the viewer serves one page of at most 16 MB, loads scripts only
// from a few CDNs and stylesheets only from Google Fonts, and blocks every
// other remote request. Scans the exported file; never fetches anything.
// openspec: add-claude-artifact-provider.
import { htmlRawTextRanges, isOffsetInRanges } from './htmlReferences';

/**
 * The artifact viewer's allowed hosts, by kind of load. Keep in step with
 * Claude's artifact rules: this is the one place they live.
 */
export const ARTIFACT_ALLOWED_HOSTS = {
  /** host, or host + path prefix */
  scripts: ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net/npm/', 'unpkg.com', 'cdn.tailwindcss.com', 'code.jquery.com'],
  stylesheets: ['fonts.googleapis.com'],
  fonts: ['fonts.gstatic.com'],
} as const;

/** Warn from here (decimal MB, so the 16 MB limit is never overshot by rounding). */
export const ARTIFACT_NEAR_LIMIT_BYTES = 12_000_000;
export const ARTIFACT_MAX_BYTES = 16_000_000;

export type ArtifactPreflightCode = 'artifact-blocked-host' | 'artifact-near-limit' | 'artifact-too-large';

/** How a remote URL is used, which decides whether its host is allowed and what breaks. */
export type RemoteRefKind = 'script' | 'stylesheet' | 'font' | 'image' | 'media' | 'frame' | 'css-asset' | 'fetch' | 'other';

export interface ArtifactPreflightFinding {
  code: ArtifactPreflightCode;
  message: string;
  url?: string;
  kind?: RemoteRefKind;
}

export interface ArtifactPreflightResult {
  bytes: number;
  findings: ArtifactPreflightFinding[];
  /** artifact-too-large: the page can't be published. */
  blocking: boolean;
}

export interface ArtifactPreflightInput {
  html: string;
  /** Byte size of the file; computed from `html` when absent. */
  bytes?: number;
  /** URLs embedded in the page (embedAssets): neither they nor their prefixes are reported. */
  embeddedUrls?: string[];
  /** Remote URLs the bundler left in place, added as kind `other` when the scan didn't place them. */
  externalDependencies?: string[];
  /** Bytes of the page taken by the sync bundle (openspec add-artifact-sync), named in the size findings. */
  syncBytes?: number;
}

const BREAKS: Record<RemoteRefKind, string> = {
  script: "the script won't run",
  stylesheet: "its styles won't apply",
  font: "the font won't load, so text falls back to another font",
  image: "the image won't show",
  media: "the video or audio won't play",
  frame: "the embedded page won't show",
  'css-asset': "the background image or font it points at won't load",
  fetch: 'a script will fail to load it (a texture, model, data file or API call)',
  other: "it won't load",
};

const KIND_NOUN: Record<RemoteRefKind, string> = {
  script: 'a script',
  stylesheet: 'a stylesheet',
  font: 'a font',
  image: 'an image',
  media: 'a video or audio file',
  frame: 'an embedded page',
  'css-asset': 'a file used by CSS',
  fetch: 'a file a script loads',
  other: 'a remote file',
};

// SVG and XML namespace URIs are identifiers, never requests.
const NAMESPACE_HOSTS = new Set(['www.w3.org', 'w3.org', 'www.w3.org.', 'purl.org', 'ns.adobe.com']);

function parseRemote(raw: string): URL | undefined {
  const value = raw.trim().replace(/&amp;/g, '&');
  if (!/^(https?:)?\/\//i.test(value)) return undefined;
  try {
    return new URL(value.startsWith('//') ? `https:${value}` : value);
  } catch {
    return undefined;
  }
}

function hostMatches(url: URL, entries: readonly string[]): boolean {
  if (url.protocol !== 'https:') return false;
  return entries.some((entry) => {
    const slash = entry.indexOf('/');
    if (slash < 0) return url.hostname === entry;
    return url.hostname === entry.slice(0, slash) && url.pathname.startsWith(entry.slice(slash));
  });
}

/** Whether the artifact viewer lets a load of this kind through. */
export function isAllowedInArtifact(url: URL, kind: RemoteRefKind): boolean {
  const { scripts, stylesheets, fonts } = ARTIFACT_ALLOWED_HOSTS;
  switch (kind) {
    case 'script':
      return hostMatches(url, scripts);
    case 'stylesheet':
      return hostMatches(url, stylesheets);
    case 'font':
    case 'css-asset':
      return hostMatches(url, fonts);
    case 'fetch':
    case 'other':
      // A URL string in a script on a script CDN is an import; anything else is a blocked request.
      return hostMatches(url, scripts) || hostMatches(url, stylesheets) || hostMatches(url, fonts);
    default:
      return false;
  }
}

interface FoundRef {
  url: string;
  kind: RemoteRefKind;
}

const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function attributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const body = tag.replace(/^<[^\s>/]+/, '').replace(/\/?>$/, '');
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(body))) attrs.set(m[1]!.toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

const TAG_KINDS: Record<string, Array<[string, RemoteRefKind]>> = {
  script: [['src', 'script']],
  img: [['src', 'image'], ['srcset', 'image']],
  source: [['src', 'media'], ['srcset', 'image']],
  video: [['src', 'media'], ['poster', 'image']],
  audio: [['src', 'media']],
  track: [['src', 'media']],
  iframe: [['src', 'frame']],
  embed: [['src', 'frame']],
  object: [['data', 'frame']],
  image: [['href', 'image'], ['xlink:href', 'image']],
  use: [['href', 'image'], ['xlink:href', 'image']],
  input: [['src', 'image']],
};

function linkKind(rel: string): RemoteRefKind | undefined {
  const rels = rel.toLowerCase().split(/\s+/);
  if (rels.includes('stylesheet')) return 'stylesheet';
  if (rels.includes('modulepreload')) return 'script';
  if (rels.includes('icon') || rels.includes('apple-touch-icon')) return 'image';
  if (rels.includes('preload') || rels.includes('prefetch')) return 'other';
  // preconnect, dns-prefetch, canonical, alternate…: no load the page depends on.
  return undefined;
}

const CSS_URL_RE = /url\(\s*(['"]?)([^)'"]*?)\1\s*\)/gi;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?(['"])([^'"]*?)\1/gi;

function scanCss(css: string, out: FoundRef[]): void {
  let m;
  CSS_IMPORT_RE.lastIndex = 0;
  const imported = new Set<string>();
  while ((m = CSS_IMPORT_RE.exec(css))) {
    imported.add(m[2]!);
    out.push({ url: m[2]!, kind: 'stylesheet' });
  }
  CSS_URL_RE.lastIndex = 0;
  while ((m = CSS_URL_RE.exec(css))) if (!imported.has(m[2]!)) out.push({ url: m[2]!, kind: 'css-asset' });
}

// A URL that starts a string literal ('…', "…" or `…`): comments and prose are left alone.
const SCRIPT_URL_RE = /(['"`])((?:https?:)?\/\/[^'"`\s\\]+)/g;
const IMPORT_RE = /(?:\bimport\s*\(\s*|\bfrom\s*|\bimport\s+)(['"])((?:https?:)?\/\/[^'"]+)\1/g;

function scanScript(body: string, out: FoundRef[]): void {
  const imports = new Set<string>();
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(body))) {
    imports.add(m[2]!);
    out.push({ url: m[2]!, kind: 'script' });
  }
  SCRIPT_URL_RE.lastIndex = 0;
  while ((m = SCRIPT_URL_RE.exec(body))) {
    const url = m[2]!.replace(/\$\{.*$/, '');
    if (!imports.has(url)) out.push({ url, kind: 'fetch' });
  }
}

function collectUrlsFromJson(value: unknown, out: FoundRef[], kind: RemoteRefKind): void {
  if (typeof value === 'string') {
    if (parseRemote(value)) out.push({ url: value, kind });
  } else if (Array.isArray(value)) {
    for (const v of value) collectUrlsFromJson(v, out, kind);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectUrlsFromJson(v, out, kind);
  }
}

// Data blocks that drive what a page loads. Others (ld+json, plain data) aren't requests.
const LOADING_DATA_TYPES = new Set(['application/od-scene+json', 'application/od-assets+json']);

/** Every remote reference in the page, with how it is used. */
export function findRemoteReferences(html: string): FoundRef[] {
  const out: FoundRef[] = [];
  const raw = htmlRawTextRanges(html);

  // <script> blocks: src, importmaps, data blocks, code.
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = scriptRe.exec(html))) {
    if (isOffsetInRanges(m.index, raw)) continue;
    const open = m[0].slice(0, m[0].indexOf('>') + 1);
    const attrs = attributes(open);
    const type = (attrs.get('type') ?? '').trim().toLowerCase();
    const body = m[1] ?? '';
    if (attrs.has('src')) out.push({ url: attrs.get('src')!, kind: 'script' });
    if (type === 'importmap') {
      try {
        collectUrlsFromJson(JSON.parse(body), out, 'script');
      } catch {
        // A broken importmap fails in any viewer; the check reports it.
      }
    } else if (LOADING_DATA_TYPES.has(type)) {
      try {
        collectUrlsFromJson(JSON.parse(body), out, 'fetch');
      } catch {
        // Not JSON: nothing to read.
      }
    } else if (type === '' || type === 'module' || type.includes('javascript') || type.includes('ecmascript')) {
      scanScript(body, out);
    }
  }

  // <style> blocks and style="" attributes.
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  while ((m = styleRe.exec(html))) if (!isOffsetInRanges(m.index, raw)) scanCss(m[1] ?? '', out);

  // Tags with loading attributes.
  const tagRe = /<([a-zA-Z][a-zA-Z0-9:-]*)\b[^<>]*>/g;
  while ((m = tagRe.exec(html))) {
    if (isOffsetInRanges(m.index, raw)) continue;
    const name = m[1]!.toLowerCase();
    const attrs = attributes(m[0]);
    const style = attrs.get('style');
    if (style) scanCss(style, out);
    if (name === 'link') {
      const kind = linkKind(attrs.get('rel') ?? '');
      const href = attrs.get('href');
      if (kind && href) out.push({ url: href, kind });
      continue;
    }
    for (const [attr, kind] of TAG_KINDS[name] ?? []) {
      const value = attrs.get(attr);
      if (!value) continue;
      if (attr === 'srcset') {
        for (const candidate of value.split(',')) {
          const url = candidate.trim().split(/\s+/)[0];
          if (url) out.push({ url, kind });
        }
      } else out.push({ url: value, kind });
    }
  }
  return out;
}

/** The artifact preflight (Artifact Preflight requirement). */
export function artifactPreflight(input: ArtifactPreflightInput): ArtifactPreflightResult {
  const bytes = input.bytes ?? Buffer.byteLength(input.html, 'utf8');
  const findings: ArtifactPreflightFinding[] = [];
  const mb = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`;
  const syncShare = input.syncBytes ? ` The sync bundle (the design's working files) takes ${mb(input.syncBytes)} of it.` : '';
  if (bytes > ARTIFACT_MAX_BYTES) {
    findings.push({
      code: 'artifact-too-large',
      message: `The page is ${mb(bytes)}; a Claude artifact can be at most ${mb(ARTIFACT_MAX_BYTES)}. Use smaller images or fewer embedded assets, or publish it as a site instead.${syncShare}`,
    });
  } else if (bytes >= ARTIFACT_NEAR_LIMIT_BYTES) {
    findings.push({
      code: 'artifact-near-limit',
      message: `The page is ${mb(bytes)}, close to the ${mb(ARTIFACT_MAX_BYTES)} artifact limit: a few more images or assets will push it over.${syncShare}`,
    });
  }

  const embedded = input.embeddedUrls ?? [];
  const covered = (url: string) => embedded.some((e) => e === url || e.startsWith(url));
  const seen = new Set<string>();
  const refs = findRemoteReferences(input.html);
  for (const dep of input.externalDependencies ?? []) if (!refs.some((r) => r.url === dep)) refs.push({ url: dep, kind: 'other' });
  for (const ref of refs) {
    const url = parseRemote(ref.url);
    if (!url || NAMESPACE_HOSTS.has(url.hostname)) continue;
    if (isAllowedInArtifact(url, ref.kind) || covered(ref.url) || covered(url.href)) continue;
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    findings.push({
      code: 'artifact-blocked-host',
      url: url.href,
      kind: ref.kind,
      message: `${url.href} (${KIND_NOUN[ref.kind]} from ${url.hostname}) is blocked in the artifact viewer: ${BREAKS[ref.kind]}.`,
    });
  }
  return { bytes, findings, blocking: findings.some((f) => f.code === 'artifact-too-large') };
}
