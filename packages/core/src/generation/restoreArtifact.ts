// The restore_open_design_artifact tool: writes a synced Claude artifact's
// working files back into the workspace. The agent reads the artifact with
// its own Artifact tool, which saves the page to a file, and passes that
// file's path; this reads it, checks the sync bundle, and writes under the
// output directory only, all or nothing. Never makes a network request.
// openspec: add-artifact-sync.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { artifactManifestSidecarPath, writeArtifactManifest } from '../vendored/artifactCreate';
import type { JsonRecord } from '../vendored/artifactManifest';
import { parseSyncBundle, type ParsedSyncFile } from '../workspace/artifactSync';
import { CLAUDE_ARTIFACT_PROVIDER, readShareRecords, upsertShareRecord, validatePublished } from '../workspace/shareRecords';
import { PUBLISH_TOOL_NAME, RESTORE_TOOL_NAME } from './publishInstructions';

export interface RestoreArtifactOptions {
  workspaceRoot: string;
  /** Workspace-relative output directory (e.g. `.open-design`). */
  outputDir: string;
  /** The page the Artifact tool saved: absolute, or relative to the workspace. */
  pagePath: string;
  artifactUrl: string;
  overwrite?: boolean;
  now?: Date;
}

export interface RestoreArtifactReport {
  /** Workspace-relative entry path of the restored design. */
  entryPath: string;
  written: string[];
  identical: string[];
  editedOutside: string[];
  missingSources: string[];
}

export type RestoreArtifactResult = { ok: true; text: string; report: RestoreArtifactReport } | { ok: false; text: string };

/** Manifest fields a publish or restore changes on its own: left out when deciding whether two manifests differ. */
function comparableManifest(raw: string): string | undefined {
  try {
    const m = JSON.parse(raw) as JsonRecord;
    delete m.updatedAt;
    delete m.entry;
    if (m.metadata && typeof m.metadata === 'object') delete (m.metadata as JsonRecord).shares;
    return JSON.stringify(m);
  } catch {
    return undefined;
  }
}

export async function restoreArtifact(options: RestoreArtifactOptions): Promise<RestoreArtifactResult> {
  const now = options.now ?? new Date();
  const validated = validatePublished({ provider: CLAUDE_ARTIFACT_PROVIDER, url: options.artifactUrl }, now);
  if (!validated.ok) return { ok: false, text: `Not restored (invalid-args): artifactUrl must be the artifact's https://claude.ai/... link (got "${options.artifactUrl}"). Nothing was written.` };

  const pageAbs = path.isAbsolute(options.pagePath) ? options.pagePath : path.join(options.workspaceRoot, options.pagePath);
  let html: string;
  try {
    html = await fs.readFile(pageAbs, 'utf8');
  } catch {
    return { ok: false, text: `Couldn't read ${options.pagePath}. Read the artifact with your Artifact tool and pass the path of the file it saved (in Claude Desktop, a path in the connected folder). Nothing was written.` };
  }

  const parsed = parseSyncBundle(html);
  if (!parsed.ok) {
    return parsed.reason === 'no-bundle'
      ? { ok: false, text: `This artifact was published without sync, so it holds only the preview, not the design's working files. Nothing was written. To sync it, publish the design again from where its files are, with \`${PUBLISH_TOOL_NAME}\` and \`sync: true\`.` }
      : { ok: false, text: `Not restored: ${parsed.error} Nothing was written.` };
  }

  const outAbs = path.resolve(options.workspaceRoot, options.outputDir);
  const targets: Array<{ file: ParsedSyncFile; abs: string }> = [];
  for (const file of parsed.files) {
    const abs = path.resolve(outAbs, file.path);
    const rel = path.relative(outAbs, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return { ok: false, text: `Not restored: ${file.path} resolves outside the output directory. Nothing was written.` };
    }
    targets.push({ file, abs });
  }

  const entryRel = parsed.bundle.entry;
  const manifestRel = artifactManifestSidecarPath(entryRel);
  const toWrite: typeof targets = [];
  const identical: string[] = [];
  const differing: string[] = [];
  let localManifest: JsonRecord | undefined;
  for (const t of targets) {
    let existing: Buffer | undefined;
    try {
      existing = await fs.readFile(t.abs);
    } catch {
      existing = undefined;
    }
    if (t.file.path === manifestRel && existing) {
      try {
        localManifest = JSON.parse(existing.toString('utf8')) as JsonRecord;
      } catch {
        localManifest = undefined;
      }
    }
    if (!existing) toWrite.push(t);
    else if (existing.equals(t.file.data)) identical.push(t.file.path);
    else if (t.file.path === manifestRel && comparableManifest(existing.toString('utf8')) === comparableManifest(t.file.content)) identical.push(t.file.path);
    else {
      differing.push(t.file.path);
      toWrite.push(t);
    }
  }
  if (differing.length && !options.overwrite) {
    return {
      ok: false,
      text: `Not restored: these files already exist here with different content, so nothing was written:\n${differing.map((f) => `- ${f}`).join('\n')}\n\nThe local copies may be newer work. Ask the user which to keep. Only if they want the artifact's version, call \`${RESTORE_TOOL_NAME}\` again with \`overwrite: true\`.`,
    };
  }

  const editedOutside = parsed.files.filter((f) => f.sha256 === null).map((f) => f.path);
  try {
    for (const t of toWrite) {
      if (t.file.path === manifestRel) continue;
      await fs.mkdir(path.dirname(t.abs), { recursive: true });
      await fs.writeFile(t.abs, t.file.data);
    }
  } catch (err) {
    return { ok: false, text: `Restore stopped while writing files: ${err instanceof Error ? err.message : String(err)}` };
  }

  // The manifest last: the bundle's copy (or the local one when they match), with this
  // artifact recorded as its claude-artifact share and the local share records kept.
  const entryPath = path.posix.join(options.outputDir.replace(/\\/g, '/'), entryRel);
  const bundleManifest = JSON.parse(parsed.files.find((f) => f.path === manifestRel)!.content) as JsonRecord;
  const base = identical.includes(manifestRel) && localManifest ? localManifest : bundleManifest;
  let metadata: JsonRecord = base.metadata && typeof base.metadata === 'object' && !Array.isArray(base.metadata) ? { ...(base.metadata as JsonRecord) } : {};
  for (const r of readShareRecords(localManifest)) metadata = upsertShareRecord(metadata, r);
  metadata = upsertShareRecord(metadata, validated.record);
  // Writing the manifest sets updatedAt to now, which marks files edited outside the kit as newer.
  const restored: JsonRecord = { ...base, entry: entryPath, metadata };
  try {
    await writeArtifactManifest({ workspaceRoot: options.workspaceRoot, entryPath, artifactManifest: restored });
  } catch (err) {
    return { ok: false, text: `The files were written, but the manifest couldn't be: ${err instanceof Error ? err.message : String(err)}` };
  }

  const written = toWrite.map((t) => t.file.path);
  if (!written.includes(manifestRel)) {
    const i = identical.indexOf(manifestRel);
    if (i >= 0) identical.splice(i, 1);
    written.push(manifestRel);
  }
  const missingSources: string[] = [];
  const sources = Array.isArray(restored.sources) ? (restored.sources as unknown[]) : [];
  for (const s of sources) {
    const p = s && typeof s === 'object' ? (s as JsonRecord).path : undefined;
    if (typeof p !== 'string') continue;
    try {
      await fs.access(path.isAbsolute(p) ? p : path.join(options.workspaceRoot, p));
    } catch {
      missingSources.push(p);
    }
  }

  const report: RestoreArtifactReport = { entryPath, written, identical, editedOutside, missingSources };
  const list = (items: string[]) => items.map((f) => `- ${options.outputDir}/${f}`).join('\n');
  const lines = [`Restored \`${entryPath}\` from ${options.artifactUrl}.`];
  if (written.length) lines.push('', 'Written:', list(written));
  if (identical.length) lines.push('', 'Already identical, left untouched:', list(identical));
  if (editedOutside.length) lines.push('', 'Edited outside the kit (no hash in the bundle; written as they are, so check them):', list(editedOutside));
  if (missingSources.length) {
    lines.push('', 'Source documents the design was built from that aren\'t here (the bundle lists them but doesn\'t carry them):', ...missingSources.map((p) => `- ${p}`));
  }
  lines.push(
    '',
    `The next preview publish (\`${PUBLISH_TOOL_NAME}\` with \`provider: "claude-artifact"\`) updates this same artifact${bundleManifest.metadata && (bundleManifest.metadata as JsonRecord).sync === true ? ', with sync still on' : ''}.`,
  );
  return { ok: true, text: lines.join('\n'), report };
}
