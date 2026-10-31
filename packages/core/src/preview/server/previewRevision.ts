import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { checkRunsDir } from '../../export/checkHistory';
import { campaignSheetPaths } from '../../export/campaignSheet';
import { normalizeWorkspacePath } from '../../export/workspaceAssets';
import { readArtifact } from '../../vendored/artifactCreate';
import { isUnaddressed } from '../../workspace/artifactCommentTypes';
import { commentsSidecarPath, readArtifactComments } from '../../workspace/artifactComments';
import { directionArtifactMap, explorationPaths, findExplorationArtifacts, readExplorationPlan } from '../../workspace/explorationStore';

/** At most this many files are looked at per design, so a design folder full of exports stays cheap. */
const MAX_FILES = 200;

/**
 * A cheap fingerprint of what an inline view shows (openspec
 * inline-preview-in-place, "Revision-Only State"): file times and sizes,
 * never contents, so the view can poll it and reload only on a change.
 */
export type RevisionTarget = { entryPath: string; campaign?: boolean } | { explorationId: string };

async function stamp(abs: string): Promise<string> {
  try {
    const s = await fs.stat(abs);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return '-';
  }
}

/** Files directly in the design's folder and its assets/ folder, unless the entry sits at the workspace root. */
async function folderFiles(workspaceRoot: string, entryPath: string): Promise<string[]> {
  const dir = path.posix.dirname(entryPath);
  if (dir === '.' || dir === '') return [];
  const out: string[] = [];
  for (const sub of [dir, path.posix.join(dir, 'assets')]) {
    try {
      for (const e of await fs.readdir(path.join(workspaceRoot, sub), { withFileTypes: true })) {
        if (e.isFile()) out.push(path.posix.join(sub, e.name));
        if (out.length >= MAX_FILES) return out;
      }
    } catch {
      // No such folder.
    }
  }
  return out;
}

async function designParts(workspaceRoot: string, outputDir: string, entryPath: string): Promise<string[]> {
  const read = await readArtifact({ workspaceRoot, entryPath }).catch(() => undefined);
  const dir = path.posix.dirname(entryPath);
  const files = new Set<string>([entryPath, `${entryPath}.artifact.json`, commentsSidecarPath(entryPath), checkRunsDir(outputDir, entryPath)]);
  for (const f of read?.supportingFiles ?? []) files.add(path.posix.join(dir, f));
  for (const f of await folderFiles(workspaceRoot, entryPath)) files.add(f);
  const sorted = [...files].sort().slice(0, MAX_FILES);
  const stamps = await Promise.all(sorted.map(async (f) => `${f}=${await stamp(path.join(workspaceRoot, f))}`));
  const open = (await readArtifactComments(workspaceRoot, entryPath).catch(() => [])).filter(isUnaddressed).length;
  return [...stamps, `open=${open}`];
}

export async function previewRevision(input: { workspaceRoot: string; outputDir: string; target: RevisionTarget }): Promise<string> {
  const { workspaceRoot, outputDir, target } = input;
  let parts: string[];
  if ('explorationId' in target) {
    const plan = await readExplorationPlan(workspaceRoot, outputDir, target.explorationId);
    parts = [`plan=${await stamp(path.join(workspaceRoot, explorationPaths(outputDir, target.explorationId).plan))}`];
    if (plan) {
      const byDirection = directionArtifactMap(await findExplorationArtifacts(workspaceRoot, outputDir, target.explorationId, plan));
      for (const d of plan.directions) {
        const artifact = byDirection.get(d.id);
        parts.push(`${d.id}:${artifact ? (await designParts(workspaceRoot, outputDir, artifact.entryPath)).join(',') : '-'}`);
      }
    }
  } else {
    const entryPath = normalizeWorkspacePath(target.entryPath);
    if (!entryPath) throw new Error(`${target.entryPath} isn't a path inside the workspace.`);
    parts = target.campaign ? [`sheet=${await stamp(path.join(workspaceRoot, campaignSheetPaths(entryPath).sidecar))}`] : await designParts(workspaceRoot, outputDir, entryPath);
  }
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
}
