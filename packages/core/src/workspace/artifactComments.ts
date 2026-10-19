import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { mergeComments, type ArtifactComment } from './artifactCommentTypes';

export * from './artifactCommentTypes';

export function commentsSidecarPath(entryPath: string): string {
  return `${entryPath}.comments.json`;
}

/** The folder next to the sidecar that holds comment crops (`<entry>.comments/`). */
export function commentCropsDir(entryPath: string): string {
  return `${entryPath}.comments`;
}

/** A crop's path relative to the entry's folder, as stored in `ArtifactComment.screenshot`. */
export function commentCropRelPath(entryPath: string, commentId: string): string {
  return `${path.posix.basename(entryPath.replace(/\\/g, '/'))}.comments/${commentId}.png`;
}

// See the identical comment in vendored/artifactCreate.ts: an absolute
// entryPath must be used as-is, not re-joined onto workspaceRoot, or it
// silently resolves to a bogus nested path instead of the real file.
function assertWorkspaceRelative(workspaceRoot: string, entryPath: string): string {
  const abs = path.isAbsolute(entryPath) ? entryPath : path.join(workspaceRoot, entryPath);
  const rel = path.relative(workspaceRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`entryPath escapes the workspace: ${entryPath}`);
  }
  return abs;
}

export async function readArtifactComments(workspaceRoot: string, entryPath: string): Promise<ArtifactComment[]> {
  const absSidecar = assertWorkspaceRelative(workspaceRoot, commentsSidecarPath(entryPath));
  try {
    const raw = await fs.readFile(absSidecar, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ArtifactComment[]) : [];
  } catch {
    return [];
  }
}

// Written through a temporary file and a rename, so a reader (another
// preview, the agent) never sees a half-written sidecar.
async function writeAtomically(absPath: string, content: string): Promise<void> {
  const tmp = `${absPath}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmp, content, 'utf8');
  try {
    await fs.rename(tmp, absPath);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw err;
  }
}

export async function writeArtifactComments(workspaceRoot: string, entryPath: string, comments: ArtifactComment[]): Promise<void> {
  const absSidecar = assertWorkspaceRelative(workspaceRoot, commentsSidecarPath(entryPath));
  await writeAtomically(absSidecar, JSON.stringify(comments, null, 2) + '\n');
}

// One queue per sidecar in this process, so two updates from the same host
// can't interleave their read and write.
const updateQueues = new Map<string, Promise<unknown>>();

/**
 * Read-modify-write of the sidecar: `mutate` gets the current comments and
 * returns the new list. Every writer (VS Code preview, browser preview, MCP
 * tools) goes through this or mergeArtifactComments, so concurrent writers
 * don't drop each other's comments. Returns the list written.
 */
export async function updateArtifactComments(
  workspaceRoot: string,
  entryPath: string,
  mutate: (current: ArtifactComment[]) => ArtifactComment[],
): Promise<ArtifactComment[]> {
  const key = assertWorkspaceRelative(workspaceRoot, commentsSidecarPath(entryPath));
  const run = async (): Promise<ArtifactComment[]> => {
    const next = mutate(await readArtifactComments(workspaceRoot, entryPath));
    await writeArtifactComments(workspaceRoot, entryPath, next);
    return next;
  };
  const previous = updateQueues.get(key) ?? Promise.resolve();
  const result = previous.then(run, run);
  updateQueues.set(key, result.catch(() => undefined));
  try {
    return await result;
  } finally {
    if (updateQueues.get(key) === result) updateQueues.delete(key);
  }
}

/** Merges changed comments into the sidecar by id (later `updatedAt` wins) and drops `deletedIds`, deleting their crops. */
export async function mergeArtifactComments(
  workspaceRoot: string,
  entryPath: string,
  changed: ArtifactComment[],
  deletedIds: readonly string[] = [],
): Promise<ArtifactComment[]> {
  const result = await updateArtifactComments(workspaceRoot, entryPath, (current) => mergeComments(current, changed, deletedIds));
  for (const id of deletedIds) await deleteCommentCrop(workspaceRoot, entryPath, id);
  return result;
}

/** Marks the given comments resolved; returns the ids that were found and the ids that weren't. */
export async function resolveArtifactComments(workspaceRoot: string, entryPath: string, ids: readonly string[]): Promise<{ resolved: string[]; unknown: string[] }> {
  const wanted = new Set(ids);
  const resolved: string[] = [];
  const now = new Date().toISOString();
  await updateArtifactComments(workspaceRoot, entryPath, (current) =>
    current.map((c) => {
      if (!wanted.has(c.id)) return c;
      resolved.push(c.id);
      return c.status === 'resolved' ? c : { ...c, status: 'resolved', updatedAt: now };
    }),
  );
  return { resolved, unknown: ids.filter((id) => !resolved.includes(id)) };
}

function cropAbsPath(workspaceRoot: string, entryPath: string, commentId: string): string {
  if (!/^[\w-]{1,64}$/.test(commentId)) throw new Error(`Invalid comment id: ${commentId}`);
  return path.join(assertWorkspaceRelative(workspaceRoot, commentCropsDir(entryPath)), `${commentId}.png`);
}

/** Saves a comment's crop PNG to `<entry>.comments/<id>.png`; returns its entry-relative path. */
export async function writeCommentCrop(workspaceRoot: string, entryPath: string, commentId: string, png: Buffer): Promise<string> {
  const abs = cropAbsPath(workspaceRoot, entryPath, commentId);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, png);
  return commentCropRelPath(entryPath, commentId);
}

export async function readCommentCrop(workspaceRoot: string, entryPath: string, commentId: string): Promise<Buffer | undefined> {
  try {
    return await fs.readFile(cropAbsPath(workspaceRoot, entryPath, commentId));
  } catch {
    return undefined;
  }
}

export async function deleteCommentCrop(workspaceRoot: string, entryPath: string, commentId: string): Promise<void> {
  try {
    await fs.rm(cropAbsPath(workspaceRoot, entryPath, commentId), { force: true });
  } catch {
    // An invalid id has no crop.
  }
}

/** At most this many comment crops go back to the agent as images; the rest are listed by path. */
export const MAX_COMMENT_CROPS_RETURNED = 4;

/**
 * The comments an agent should address (status open or sent), each with its
 * crop path made workspace-relative, plus up to `maxCrops` crops as PNGs,
 * newest comment first. What get_open_design_artifact returns.
 */
export async function readUnaddressedComments(
  workspaceRoot: string,
  entryPath: string,
  maxCrops = MAX_COMMENT_CROPS_RETURNED,
): Promise<{ comments: ArtifactComment[]; crops: Array<{ commentId: string; png: Buffer }> }> {
  const entryDir = path.posix.dirname(entryPath.replace(/\\/g, '/'));
  const comments = (await readArtifactComments(workspaceRoot, entryPath))
    .filter((c) => c.status === 'open' || c.status === 'sent')
    .map((c) => (c.screenshot ? { ...c, screenshot: path.posix.join(entryDir, c.screenshot) } : c));
  const crops: Array<{ commentId: string; png: Buffer }> = [];
  const newestFirst = [...comments].filter((c) => c.screenshot).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const c of newestFirst) {
    if (crops.length >= maxCrops) break;
    const png = await readCommentCrop(workspaceRoot, entryPath, c.id);
    if (png) crops.push({ commentId: c.id, png });
  }
  return { comments, crops };
}
