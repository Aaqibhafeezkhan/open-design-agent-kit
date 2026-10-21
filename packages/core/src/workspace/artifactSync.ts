// The sync bundle a synced Claude artifact carries: the design's working
// files (entry, manifest, comments, supporting files, a `user:` design
// system's DESIGN.md) in one JSON block in the page, so the design can be
// picked up on another device or session by reading the artifact back.
// Text files are plain JSON strings, readable and editable without tools;
// binary files are base64. Never fetches or publishes anything.
// openspec: add-artifact-sync.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { JsonRecord } from '../vendored/artifactManifest';
import { artifactManifestSidecarPath, readArtifact } from '../vendored/artifactCreate';
import { commentsSidecarPath } from './artifactComments';

export const SYNC_BUNDLE_TYPE = 'application/od-sync+json';
export const SYNC_BUNDLE_ID = 'od-sync';
export const SYNC_BUNDLE_VERSION = 1;

export interface SyncFile {
  /** Relative to the output directory, `/`-separated. */
  path: string;
  encoding: 'utf8' | 'base64';
  bytes: number;
  /** Hash of the file's bytes, or null for a file edited outside the kit. */
  sha256: string | null;
  content: string;
}

export interface SyncBundle {
  version: number;
  /** The entry file, relative to the output directory. */
  entry: string;
  createdAt: string;
  files: SyncFile[];
}

const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.json', '.md', '.markdown', '.css', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.svg', '.txt', '.csv', '.tsv', '.xml', '.yaml', '.yml',
]);

export function syncFileHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function encodeFile(relPath: string, bytes: Buffer): SyncFile {
  const text = TEXT_EXTENSIONS.has(path.posix.extname(relPath).toLowerCase()) ? bytes.toString('utf8') : undefined;
  const isText = text !== undefined && Buffer.from(text, 'utf8').equals(bytes);
  return {
    path: relPath,
    encoding: isText ? 'utf8' : 'base64',
    bytes: bytes.length,
    sha256: syncFileHash(bytes),
    content: isText ? text : bytes.toString('base64'),
  };
}

/** A copy of the manifest without the claim URLs of its share records. */
export function manifestForSync(manifest: JsonRecord): JsonRecord {
  const copy = JSON.parse(JSON.stringify(manifest)) as JsonRecord;
  const metadata = copy.metadata as JsonRecord | undefined;
  if (metadata && Array.isArray(metadata.shares)) {
    for (const share of metadata.shares as unknown[]) {
      if (share && typeof share === 'object') delete (share as JsonRecord).claimUrl;
    }
  }
  return copy;
}

export interface CollectSyncBundleOptions {
  workspaceRoot: string;
  /** Workspace-relative entry path. */
  entryPath: string;
  /** Workspace-relative output directory (e.g. `.open-design`). */
  outputDir: string;
  now?: Date;
}

export type CollectSyncBundleResult =
  | { ok: true; bundle: SyncBundle; notes: string[] }
  | { ok: false; error: string };

/** Collects the bundle for a registered entry. Missing optional files are left out with a note. */
export async function collectSyncBundle(options: CollectSyncBundleOptions): Promise<CollectSyncBundleResult> {
  const outAbs = path.resolve(options.workspaceRoot, options.outputDir);
  const entryAbs = path.resolve(options.workspaceRoot, options.entryPath);
  const entryRel = toPosix(path.relative(outAbs, entryAbs));
  if (entryRel.startsWith('../') || entryRel === '..' || path.isAbsolute(entryRel)) {
    return { ok: false, error: `${options.entryPath} isn't under the output directory (${options.outputDir}/), so its files can't be synced.` };
  }
  const artifact = await readArtifact({ workspaceRoot: options.workspaceRoot, entryPath: options.entryPath });
  if (!artifact?.manifest) return { ok: false, error: `${options.entryPath} isn't a registered artifact.` };

  const notes: string[] = [];
  const files: SyncFile[] = [];
  const seen = new Set<string>();
  const entryDir = path.posix.dirname(entryRel);
  const exportsPrefix = entryDir === '.' ? 'exports/' : `${entryDir}/exports/`;
  const add = async (rel: string, required: boolean, bytes?: Buffer): Promise<void> => {
    const norm = path.posix.normalize(rel);
    if (seen.has(norm)) return;
    // exports/ and the Figma capture can be made again.
    if (norm.startsWith(exportsPrefix) || norm.endsWith('.od-figma.json')) return;
    if (norm.startsWith('../') || path.posix.isAbsolute(norm)) {
      notes.push(`${rel} is outside the output directory, so it was left out.`);
      return;
    }
    let data = bytes;
    if (!data) {
      try {
        const stat = await fs.stat(path.join(outAbs, norm));
        if (!stat.isFile()) throw new Error('not a file');
        data = await fs.readFile(path.join(outAbs, norm));
      } catch {
        if (required) throw new Error(`${norm} couldn't be read.`);
        notes.push(`${norm} wasn't found, so it was left out.`);
        return;
      }
    }
    seen.add(norm);
    files.push(encodeFile(norm, data));
  };

  try {
    await add(entryRel, true);
    const manifestJson = JSON.stringify(manifestForSync(artifact.manifest), null, 2) + '\n';
    await add(toPosix(artifactManifestSidecarPath(entryRel)), true, Buffer.from(manifestJson, 'utf8'));
    try {
      await fs.access(path.join(outAbs, commentsSidecarPath(entryRel)));
      await add(commentsSidecarPath(entryRel), false);
    } catch {
      // No comments yet.
    }
    for (const supporting of artifact.supportingFiles) {
      if (typeof supporting !== 'string' || !supporting) continue;
      await add(path.posix.join(entryDir, toPosix(supporting)), false);
    }
    const ds = artifact.manifest.designSystemId;
    if (typeof ds === 'string' && ds.startsWith('user:')) {
      await add(`design-systems/${ds.slice('user:'.length)}/DESIGN.md`, false);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return {
    ok: true,
    bundle: { version: SYNC_BUNDLE_VERSION, entry: entryRel, createdAt: (options.now ?? new Date()).toISOString(), files },
    notes,
  };
}

/**
 * The bundle as a script element. `</` becomes `<\/` and `<!--` becomes
 * `<!--` (both valid JSON escapes), so the content can't close the
 * element or switch the parser into script-escape states, and the text
 * stays readable.
 */
export function encodeSyncBlock(bundle: SyncBundle): string {
  const json = JSON.stringify(bundle).replace(/<\//g, '<\\/').replace(/<!--/g, '\\u003c!--');
  return `<script type="${SYNC_BUNDLE_TYPE}" id="${SYNC_BUNDLE_ID}">${json}</script>`;
}

/** The page with the block added at the end of the body. */
export function injectSyncBlock(html: string, block: string): string {
  const close = html.toLowerCase().lastIndexOf('</body');
  if (close >= 0) return html.slice(0, close) + block + html.slice(close);
  const htmlClose = html.toLowerCase().lastIndexOf('</html');
  if (htmlClose >= 0) return html.slice(0, htmlClose) + block + html.slice(htmlClose);
  return html + block;
}

const BLOCK_RE = /<script\b[^>]*\btype\s*=\s*["']?application\/od-sync\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

/** Whether a recorded path is safe to write under the output directory. */
export function unsafeSyncPath(p: unknown): string | undefined {
  if (typeof p !== 'string' || p.length === 0) return 'is empty';
  if (p.includes('\0')) return 'contains a NUL character';
  if (p.startsWith('/') || p.startsWith('\\') || /^[a-zA-Z]:/.test(p) || path.isAbsolute(p)) return 'is absolute';
  if (p.split(/[\\/]/).includes('..')) return 'contains a ".." segment';
  return undefined;
}

export interface ParsedSyncFile extends SyncFile {
  /** The decoded bytes. */
  data: Buffer;
}

export type ParseSyncBundleResult =
  | { ok: true; bundle: SyncBundle; files: ParsedSyncFile[] }
  | { ok: false; reason: 'no-bundle' | 'invalid'; error: string };

/** Finds and checks the bundle in a page: one block, a known version, safe paths, matching hashes. */
export function parseSyncBundle(html: string): ParseSyncBundleResult {
  const blocks = [...html.matchAll(BLOCK_RE)];
  if (blocks.length === 0) return { ok: false, reason: 'no-bundle', error: `The page has no ${SYNC_BUNDLE_TYPE} block.` };
  if (blocks.length > 1) return { ok: false, reason: 'invalid', error: `The page has ${blocks.length} sync blocks; expected one.` };
  let raw: unknown;
  try {
    raw = JSON.parse(blocks[0]![1]!);
  } catch (err) {
    return { ok: false, reason: 'invalid', error: `The sync block isn't valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'invalid', error: 'The sync block isn\'t a JSON object.' };
  const b = raw as JsonRecord;
  if (b.version !== SYNC_BUNDLE_VERSION) return { ok: false, reason: 'invalid', error: `Unknown sync bundle version ${JSON.stringify(b.version)}; this kit reads version ${SYNC_BUNDLE_VERSION}.` };
  if (typeof b.entry !== 'string') return { ok: false, reason: 'invalid', error: 'The sync bundle has no entry.' };
  if (!Array.isArray(b.files)) return { ok: false, reason: 'invalid', error: 'The sync bundle has no files list.' };

  const files: ParsedSyncFile[] = [];
  const seen = new Set<string>();
  for (const f of b.files as unknown[]) {
    if (!f || typeof f !== 'object') return { ok: false, reason: 'invalid', error: 'A sync bundle file entry isn\'t an object.' };
    const file = f as JsonRecord;
    const unsafe = unsafeSyncPath(file.path);
    if (unsafe) return { ok: false, reason: 'invalid', error: `Refused: the path ${JSON.stringify(file.path)} ${unsafe}.` };
    const p = path.posix.normalize(toPosix(file.path as string));
    if (seen.has(p)) return { ok: false, reason: 'invalid', error: `${p} appears twice in the sync bundle.` };
    seen.add(p);
    if (file.encoding !== 'utf8' && file.encoding !== 'base64') return { ok: false, reason: 'invalid', error: `${p} has an unknown encoding.` };
    if (typeof file.content !== 'string') return { ok: false, reason: 'invalid', error: `${p} has no content.` };
    if (file.sha256 !== null && typeof file.sha256 !== 'string') return { ok: false, reason: 'invalid', error: `${p} has no sha256 (use null for a file edited outside the kit).` };
    const data = file.encoding === 'utf8' ? Buffer.from(file.content, 'utf8') : Buffer.from(file.content, 'base64');
    if (file.sha256 !== null && syncFileHash(data) !== (file.sha256 as string).toLowerCase()) {
      return { ok: false, reason: 'invalid', error: `${p} doesn't match its sha256: the bundle is damaged.` };
    }
    files.push({ path: p, encoding: file.encoding, bytes: data.length, sha256: file.sha256 as string | null, content: file.content, data });
  }
  const entry = path.posix.normalize(toPosix(b.entry));
  if (!seen.has(entry)) return { ok: false, reason: 'invalid', error: `The sync bundle's entry ${entry} isn't among its files.` };
  if (!seen.has(artifactManifestSidecarPath(entry))) return { ok: false, reason: 'invalid', error: `The sync bundle has no manifest for ${entry}.` };
  return {
    ok: true,
    bundle: { version: SYNC_BUNDLE_VERSION, entry, createdAt: typeof b.createdAt === 'string' ? b.createdAt : '', files: files.map((f) => ({ path: f.path, encoding: f.encoding, bytes: f.bytes, sha256: f.sha256, content: f.content })) },
    files,
  };
}
