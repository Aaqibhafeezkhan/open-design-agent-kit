// Embeds the remote files a 3D page declares (HDRIs, textures, glTF models)
// into a standalone export, so the page works where other sites are blocked:
// a Claude artifact, or offline. The files go into one base64 JSON block; an
// inline runtime turns each into a blob: URL before the page's scripts run
// and hands those out for the original URLs (fetch, XHR and <img>), since the
// artifact viewer blocks the CDN and also blocks fetch() of data: URIs.
// openspec: embed-3d-assets-for-artifacts.
import { filesFor, POLY_HAVEN_API, POLY_HAVEN_USER_AGENT, type PolyHavenResolution, type PolyHavenType } from '../assets/polyHaven';
import { ARTIFACT_MAX_BYTES, ARTIFACT_NEAR_LIMIT_BYTES } from './artifactPreflight';

export type AssetResolution = '1k' | '2k' | '4k';
export const ASSET_RESOLUTIONS: readonly AssetResolution[] = ['1k', '2k', '4k'];

export interface DeclaredAsset {
  url: string;
  source?: string;
  id?: string;
}

export interface EmbeddedAsset {
  /** The URL the page requests; the runtime answers it from the page. */
  url: string;
  bytes: number;
  /** Where the bytes came from, when that differs (a lower resolution). */
  fetchedFrom?: string;
}

export interface NotEmbeddedAsset {
  url: string;
  reason: string;
}

export interface EmbedAssetsResult {
  html: string;
  embedded: EmbeddedAsset[];
  notEmbedded: NotEmbeddedAsset[];
  /** Byte size of the resulting page. */
  totalBytes: number;
  warnings: string[];
  /** Set when the page would be over 16 MB: the export fails with it. */
  tooLarge?: string;
}

export type BinaryFetch = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer>; json(): Promise<unknown> }>;

export interface EmbedAssetsOptions {
  /** Poly Haven textures and HDRIs are fetched at this resolution at most. Default 1k. */
  maxResolution?: AssetResolution;
  fetchImpl?: BinaryFetch;
}

export const EMBEDDED_ASSETS_TYPE = 'application/od-embedded-assets+json';
const EMBEDDED_ASSETS_ID = 'od-embedded-assets';
/** Data blocks a page declares its remote assets in: the 3d-scene spec and the 3d-object asset block. */
const DECLARING_TYPES = new Set(['application/od-scene+json', 'application/od-assets+json']);
const TIMEOUT_MS = 30_000;

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The remote assets a page declares: `assets[]` in its scene spec, or the entries of its asset block. */
export function declaredRemoteAssets(html: string): DeclaredAsset[] {
  const out: DeclaredAsset[] = [];
  const seen = new Set<string>();
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1] ?? '')?.[1]?.toLowerCase();
    if (!type || !DECLARING_TYPES.has(type)) continue;
    let data: unknown;
    try {
      data = JSON.parse(m[2] ?? '');
    } catch {
      continue;
    }
    const list = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as { assets?: unknown }).assets : undefined;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const entry = typeof item === 'string' ? { url: item } : item && typeof item === 'object' ? (item as Record<string, unknown>) : undefined;
      if (!entry || !isHttpsUrl(entry.url) || seen.has(entry.url)) continue;
      seen.add(entry.url);
      out.push({
        url: entry.url,
        source: typeof entry.source === 'string' ? entry.source : undefined,
        id: typeof entry.id === 'string' ? entry.id : undefined,
      });
    }
  }
  return out;
}

const MIME_BY_EXT: Record<string, string> = {
  hdr: 'image/vnd.radiance',
  exr: 'image/x-exr',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  ktx2: 'image/ktx2',
  gltf: 'model/gltf+json',
  glb: 'model/gltf-binary',
  bin: 'application/octet-stream',
  json: 'application/json',
};

function mimeFor(url: string): string {
  const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/** Poly Haven CDN layout: /HDRIs/<format>/<res>/…, /Textures/<format>/<res>/<id>/…, /Models/<format>/<res>/<id>/…. */
export function polyHavenKind(url: string): { type: PolyHavenType; resolution: string } | undefined {
  const parsed = new URL(url);
  if (parsed.hostname !== 'dl.polyhaven.org') return undefined;
  const m = /\/(HDRIs|Textures|Models)\/[^/]+\/(\d+k)\//.exec(parsed.pathname);
  if (!m) return undefined;
  const type: PolyHavenType = m[1] === 'HDRIs' ? 'hdri' : m[1] === 'Textures' ? 'texture' : 'model';
  return { type, resolution: m[2]! };
}

const resNumber = (r: string) => Number.parseInt(r, 10) || 0;

interface PlannedFile {
  /** What the page requests. */
  url: string;
  /** What to download for it. */
  from: string;
}

class Downloader {
  constructor(private readonly fetchImpl: BinaryFetch) {}

  private async request(url: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(url, { headers: { 'User-Agent': POLY_HAVEN_USER_AGENT }, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      throw new Error(err instanceof Error ? (err.name === 'AbortError' ? 'timed out' : err.message) : String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  async bytes(url: string): Promise<Buffer> {
    return Buffer.from(await (await this.request(url)).arrayBuffer());
  }

  async json(url: string): Promise<unknown> {
    return (await this.request(url)).json();
  }
}

/** The files to embed for one Poly Haven asset, from its API file list; undefined when the API can't place it. */
async function planPolyHaven(asset: DeclaredAsset, dl: Downloader, maxResolution: AssetResolution): Promise<PlannedFile[] | undefined> {
  const kind = polyHavenKind(asset.url);
  const id = asset.id ?? /\/(?:Textures|Models)\/[^/]+\/\d+k\/([^/]+)\//.exec(new URL(asset.url).pathname)?.[1];
  if (!kind || !id) return undefined;
  const tree = (await dl.json(`${POLY_HAVEN_API}/files/${encodeURIComponent(id)}`)) as Parameters<typeof filesFor>[1];
  const pageRes = kind.resolution as PolyHavenResolution;
  const atPage = filesFor(kind.type, tree ?? {}, pageRes);
  if (!atPage) return undefined;
  // Models keep their resolution: a lower-resolution .gltf names other relative files than the page maps.
  const fetchRes = (kind.type !== 'model' && resNumber(pageRes) > resNumber(maxResolution) ? maxResolution : pageRes) as PolyHavenResolution;
  const atFetch = fetchRes === pageRes ? atPage : (filesFor(kind.type, tree ?? {}, fetchRes) ?? atPage);
  const planned: PlannedFile[] = [];
  for (const [key, file] of Object.entries(atPage.files)) planned.push({ url: file.url, from: atFetch.files[key]?.url ?? file.url });
  for (const url of Object.values(atPage.includes ?? {})) planned.push({ url, from: url });
  // The declared URL itself, when it is a file the API listed under another address.
  if (!asset.url.endsWith('/') && !planned.some((p) => p.url === asset.url)) planned.push({ url: asset.url, from: asset.url });
  return planned;
}

/** A glTF's relative buffers and images, resolved against its URL. */
function gltfDependencies(gltfUrl: string, json: unknown): string[] {
  if (!json || typeof json !== 'object') return [];
  const doc = json as { buffers?: Array<{ uri?: unknown }>; images?: Array<{ uri?: unknown }> };
  const uris = [...(doc.buffers ?? []), ...(doc.images ?? [])].map((b) => b?.uri).filter((u): u is string => typeof u === 'string' && !u.startsWith('data:'));
  return uris.flatMap((uri) => {
    try {
      return [new URL(uri, gltfUrl).href];
    } catch {
      return [];
    }
  });
}

/** The inline runtime: blob: URLs for the embedded files, answered for their original URLs. */
export const EMBEDDED_ASSETS_RUNTIME = `(function () {
  var block = document.getElementById('${EMBEDDED_ASSETS_ID}');
  if (!block) return;
  var data = JSON.parse(block.textContent);
  var blobs = Object.create(null);
  Object.keys(data).forEach(function (url) {
    var bin = atob(data[url].data), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blobs[url] = URL.createObjectURL(new Blob([bytes], { type: data[url].type }));
  });
  block.textContent = '';
  function resolve(u) {
    if (typeof u !== 'string') return u;
    if (blobs[u]) return blobs[u];
    try { var abs = new URL(u, document.baseURI).href; return blobs[abs] || u; } catch (e) { return u; }
  }
  window.odEmbeddedAssets = { resolve: resolve, urls: Object.keys(blobs) };
  var nativeFetch = window.fetch;
  if (nativeFetch) window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
    var mapped = resolve(url);
    if (mapped !== url) return nativeFetch.call(this, mapped, typeof input === 'string' || input instanceof URL ? init : { signal: input.signal });
    return nativeFetch.call(this, input, init);
  };
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = resolve(String(url));
    return open.apply(this, args);
  };
  var src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (src && src.set) Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true, enumerable: src.enumerable, get: src.get,
    set: function (v) { src.set.call(this, resolve(String(v))); }
  });
  var setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src') value = resolve(String(value));
    return setAttribute.call(this, name, value);
  };
})();`;

function injectAtHeadStart(html: string, tags: string): string {
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + tags + html.slice(head.index + head[0].length);
  const htmlTag = /<html\b[^>]*>/i.exec(html);
  if (htmlTag) return html.slice(0, htmlTag.index + htmlTag[0].length) + `<head>${tags}</head>` + html.slice(htmlTag.index + htmlTag[0].length);
  return tags + html;
}

const mb = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`;

/** Downloads the page's declared assets and embeds them with the runtime. Never throws for a failed download. */
export async function embedDeclaredAssets(html: string, options: EmbedAssetsOptions = {}): Promise<EmbedAssetsResult> {
  const maxResolution = options.maxResolution ?? '1k';
  const dl = new Downloader(options.fetchImpl ?? (globalThis.fetch as unknown as BinaryFetch));
  const declared = declaredRemoteAssets(html);
  const notEmbedded: NotEmbeddedAsset[] = [];
  const files = new Map<string, { bytes: Buffer; type: string; from: string }>();

  const embed = async (url: string, from: string): Promise<Buffer | undefined> => {
    if (files.has(url)) return files.get(url)!.bytes;
    try {
      const bytes = await dl.bytes(from);
      files.set(url, { bytes, type: mimeFor(url), from });
      return bytes;
    } catch (err) {
      notEmbedded.push({ url, reason: err instanceof Error ? err.message : String(err) });
      return undefined;
    }
  };

  for (const asset of declared) {
    let planned: PlannedFile[] | undefined;
    if (asset.source === 'polyhaven' || new URL(asset.url).hostname === 'dl.polyhaven.org') {
      try {
        planned = await planPolyHaven(asset, dl, maxResolution);
      } catch {
        planned = undefined; // The API is unreachable: try the declared URL itself below.
      }
    }
    if (planned) {
      for (const p of planned) await embed(p.url, p.from);
      continue;
    }
    if (asset.url.endsWith('/')) {
      notEmbedded.push({ url: asset.url, reason: "a folder, and Poly Haven's file list for it couldn't be read" });
      continue;
    }
    const bytes = await embed(asset.url, asset.url);
    if (bytes && /\.gltf$/i.test(new URL(asset.url).pathname)) {
      let json: unknown;
      try {
        json = JSON.parse(bytes.toString('utf8'));
      } catch {
        json = undefined;
      }
      for (const dep of gltfDependencies(asset.url, json)) await embed(dep, dep);
    }
  }

  const embedded: EmbeddedAsset[] = [...files].map(([url, f]) => ({ url, bytes: f.bytes.length, ...(f.from !== url ? { fetchedFrom: f.from } : {}) }));
  const warnings: string[] = [];
  if (declared.length === 0) warnings.push('embedAssets: the page declares no remote assets (a scene spec `assets` list or an `application/od-assets+json` block), so nothing was embedded.');
  if (files.size === 0) return { html, embedded, notEmbedded, totalBytes: Buffer.byteLength(html, 'utf8'), warnings };

  const payload: Record<string, { type: string; data: string }> = {};
  for (const [url, f] of files) payload[url] = { type: f.type, data: f.bytes.toString('base64') };
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const tags = `<script type="${EMBEDDED_ASSETS_TYPE}" id="${EMBEDDED_ASSETS_ID}">${json}</script><script>${EMBEDDED_ASSETS_RUNTIME}</script>`;
  const out = injectAtHeadStart(html, tags);
  const totalBytes = Buffer.byteLength(out, 'utf8');
  const largest = [...embedded].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((a) => `${a.url} (${mb(a.bytes)})`).join(', ');
  let tooLarge: string | undefined;
  if (totalBytes > ARTIFACT_MAX_BYTES) {
    tooLarge = `With its assets embedded the page would be ${mb(totalBytes)}, over the ${mb(ARTIFACT_MAX_BYTES)} limit. The largest: ${largest}. Use 1k files (maxResolution: "1k") or fewer assets.`;
  } else if (totalBytes >= ARTIFACT_NEAR_LIMIT_BYTES) {
    warnings.push(`With its assets embedded the page is ${mb(totalBytes)}, close to the ${mb(ARTIFACT_MAX_BYTES)} artifact limit. The largest: ${largest}.`);
  }
  return { html: out, embedded, notEmbedded, totalBytes, warnings, tooLarge };
}
