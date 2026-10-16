// CC0 3D assets from Poly Haven (openspec add-3d-scene, "3d-asset-sources"):
// search the public API for HDRIs, textures and models and return the direct
// CDN file URLs a three.js page needs. Writes nothing.
//
// Poly Haven's API terms (github.com/Poly-Haven/Public-API, ToS.md): free for
// any use, no key; requests must identify the software (User-Agent); results
// shown from the live API carry a light "Powered by Poly Haven" credit. The
// assets themselves are CC0 and need no credit.

export type PolyHavenType = 'hdri' | 'texture' | 'model';
export type PolyHavenResolution = '1k' | '2k';

export const POLY_HAVEN_API = 'https://api.polyhaven.com';
export const POLY_HAVEN_USER_AGENT = 'open-design-agent-kit (+https://github.com/feimacode/open-design-agent-kit)';
export const POLY_HAVEN_CREDIT = 'Powered by Poly Haven (polyhaven.com)';
const TIMEOUT_MS = 10_000;
const TYPE_PARAM: Record<PolyHavenType, string> = { hdri: 'hdris', texture: 'textures', model: 'models' };

export interface Found3dAsset {
  id: string;
  name: string;
  type: PolyHavenType;
  categories: string[];
  /** Models: width × depth × height in meters, from Poly Haven's millimeters. */
  dimensionsM?: [number, number, number];
  /** Models: Poly Haven's polygon count; triangles can be up to twice this. */
  polycount?: number;
  thumbnailUrl?: string;
  resolution: PolyHavenResolution;
  /** HDRI: `hdr`. Texture: `diffuse`, `normal` (GL), `roughness`, `arm` (AO/roughness/metal), when available. Model: `gltf`. */
  files: Record<string, { url: string; bytes?: number }>;
  /** Models: the glTF's relative file paths (as written inside the .gltf) mapped to their CDN URLs. */
  includes?: Record<string, string>;
  license: 'CC0';
  pageUrl: string;
}

export type Find3dAssetsResult =
  | { ok: true; query: string; type: PolyHavenType; resolution: PolyHavenResolution; assets: Found3dAsset[]; credit: string }
  | { ok: false; error: string };

export interface Find3dAssetsInput {
  query: string;
  type: PolyHavenType;
  limit?: number;
  resolution?: PolyHavenResolution;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

type Listing = Record<string, { name?: string; categories?: string[]; tags?: string[]; dimensions?: number[]; polycount?: number; thumbnail_url?: string; download_count?: number }>;

/** Asset lists per type, fetched once per process (design D5). Exported for tests. */
export const listingCache = new Map<PolyHavenType, Promise<Listing>>();

async function getJson(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': POLY_HAVEN_USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function listing(fetchImpl: FetchLike, type: PolyHavenType): Promise<Listing> {
  let cached = listingCache.get(type);
  if (!cached) {
    cached = getJson(fetchImpl, `${POLY_HAVEN_API}/assets?type=${TYPE_PARAM[type]}`).then((data) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('the asset list had an unexpected shape');
      return data as Listing;
    });
    // A failed fetch isn't cached, so the next search tries again.
    cached.catch(() => listingCache.delete(type));
    listingCache.set(type, cached);
  }
  return cached;
}

const tokensOf = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);

/** Ranks listing entries by how many query terms they match (id, name, tags, categories), then by downloads. */
export function rankListing(entries: Listing, query: string, limit: number): string[] {
  const terms = tokensOf(query);
  if (terms.length === 0) return [];
  const scored: Array<{ id: string; score: number; downloads: number }> = [];
  for (const [id, entry] of Object.entries(entries)) {
    const words = tokensOf([id, entry.name ?? '', ...(entry.tags ?? []), ...(entry.categories ?? [])].join(' '));
    let score = 0;
    // Whole words (plurals and longer stems allowed), never raw substrings: "mug" mustn't match "smugglers".
    for (const term of terms) if (words.some((w) => w === term || w === `${term}s` || term === `${w}s` || (term.length >= 4 && w.startsWith(term)))) score++;
    if (score > 0) scored.push({ id, score, downloads: entry.download_count ?? 0 });
  }
  scored.sort((a, b) => b.score - a.score || b.downloads - a.downloads);
  return scored.slice(0, limit).map((s) => s.id);
}

type FileNode = { url?: string; size?: number; include?: Record<string, { url?: string }> };
type FileTree = Record<string, Record<string, Record<string, FileNode>>>;

/** The files a three.js page needs, from a `/files/<id>` response (design D5). */
export function filesFor(type: PolyHavenType, tree: FileTree, resolution: PolyHavenResolution): Pick<Found3dAsset, 'files' | 'includes'> | undefined {
  const pick = (map: string, format: string): { url: string; bytes?: number } | undefined => {
    const node = tree[map]?.[resolution]?.[format];
    return node?.url ? { url: node.url, bytes: node.size } : undefined;
  };
  const files: Record<string, { url: string; bytes?: number }> = {};
  const put = (key: string, value: { url: string; bytes?: number } | undefined): void => {
    if (value) files[key] = value;
  };
  if (type === 'hdri') {
    put('hdr', pick('hdri', 'hdr'));
    return files.hdr ? { files } : undefined;
  }
  if (type === 'texture') {
    put('diffuse', pick('Diffuse', 'jpg'));
    put('normal', pick('nor_gl', 'jpg'));
    put('roughness', pick('Rough', 'jpg'));
    put('arm', pick('arm', 'jpg'));
    return files.diffuse ? { files } : undefined;
  }
  const gltf = tree.gltf?.[resolution]?.gltf;
  if (!gltf?.url) return undefined;
  put('gltf', { url: gltf.url, bytes: gltf.size });
  const includes: Record<string, string> = {};
  for (const [rel, node] of Object.entries(gltf.include ?? {})) if (node?.url) includes[rel] = node.url;
  return { files, includes };
}

/** find_open_design_3d_assets: searches Poly Haven and returns CDN file URLs; never throws. */
export async function find3dAssets(input: Find3dAssetsInput, fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike): Promise<Find3dAssetsResult> {
  const type = input.type;
  if (!(type in TYPE_PARAM)) return { ok: false, error: `type must be hdri, texture or model (got "${String(type)}").` };
  const query = (input.query ?? '').trim();
  if (!query) return { ok: false, error: 'query is required, e.g. "lantern", "cobblestone", "sunset field".' };
  const limit = Math.min(10, Math.max(1, Math.floor(input.limit ?? 5)));
  const resolution: PolyHavenResolution = input.resolution === '2k' ? '2k' : '1k';
  try {
    const entries = await listing(fetchImpl, type);
    const ids = rankListing(entries, query, limit);
    const assets: Found3dAsset[] = [];
    for (const id of ids) {
      const tree = (await getJson(fetchImpl, `${POLY_HAVEN_API}/files/${encodeURIComponent(id)}`)) as FileTree;
      const picked = filesFor(type, tree ?? {}, resolution);
      if (!picked) continue;
      const entry = entries[id];
      const dims = entry.dimensions;
      assets.push({
        id,
        name: entry.name ?? id,
        type,
        categories: entry.categories ?? [],
        dimensionsM: type === 'model' && Array.isArray(dims) && dims.length === 3 ? (dims.map((mm) => Math.round(mm) / 1000) as [number, number, number]) : undefined,
        polycount: type === 'model' && typeof entry.polycount === 'number' ? entry.polycount : undefined,
        thumbnailUrl: entry.thumbnail_url,
        resolution,
        ...picked,
        license: 'CC0',
        pageUrl: `https://polyhaven.com/a/${id}`,
      });
    }
    return { ok: true, query, type, resolution, assets, credit: POLY_HAVEN_CREDIT };
  } catch (err) {
    const reason = err instanceof Error ? (err.name === 'AbortError' ? 'the request timed out' : err.message) : String(err);
    return { ok: false, error: `Couldn't reach Poly Haven (${reason}).` };
  }
}

const FALLBACK = 'Fall back to procedural geometry and materials, and RoomEnvironment for light; tell the user Poly Haven assets were unavailable.';

const kb = (bytes?: number): string => (bytes === undefined ? '' : ` (${bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`})`);

/** Model-friendly text for the tool result. */
export function formatFound3dAssets(result: Find3dAssetsResult): string {
  if (!result.ok) return `${result.error} ${FALLBACK}`;
  if (result.assets.length === 0) {
    return `No Poly Haven ${result.type}s match "${result.query}". Try broader or different words (a material, an object, a mood: "stone", "wood floor", "sunset", "chair"). ${result.credit}`;
  }
  const lines = [`Poly Haven ${result.type}s for "${result.query}" at ${result.resolution} — all CC0 (no attribution needed; free for any use). ${result.credit}`, ''];
  for (const a of result.assets) {
    lines.push(`## ${a.name} (\`${a.id}\`)`);
    lines.push(
      `Categories: ${a.categories.join(', ') || '—'}${a.dimensionsM ? ` · size ${a.dimensionsM.map((m) => m.toFixed(2)).join(' × ')} m` : ''}${a.polycount ? ` · ${a.polycount.toLocaleString('en-US')} polygons (up to ~${(a.polycount * 2).toLocaleString('en-US')} triangles)` : ''} · ${a.pageUrl}`,
    );
    if (a.thumbnailUrl) lines.push(`Thumbnail: ${a.thumbnailUrl}`);
    for (const [key, file] of Object.entries(a.files)) lines.push(`- ${key}: ${file.url}${kb(file.bytes)}`);
    if (a.includes && Object.keys(a.includes).length > 0) {
      lines.push(`- includes (the .gltf refers to these by relative path; on the CDN they live elsewhere, so map them with a LoadingManager URL modifier, or download them keeping these paths): ${JSON.stringify(a.includes)}`);
    }
    lines.push('');
  }
  lines.push(
    'Use: HDRI → RGBELoader + PMREMGenerator for scene.environment (and background if wanted). Texture → TextureLoader, diffuse with colorSpace = SRGBColorSpace, set wrapS/wrapT = RepeatWrapping and repeat to the surface size. Model → GLTFLoader with a LoadingManager whose setURLModifier returns includes[path] for each relative file, then measure and rescale it to its layout size. Record each asset (source "polyhaven", id, url, license "CC0") in the scene spec\'s assets list.',
  );
  return lines.join('\n');
}
