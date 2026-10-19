// Saved visual-check runs (openspec add-browser-preview, check-history): each
// check that renders keeps its screenshots and a findings summary under
// <outputDir>/.checks/<entry-slug>/<timestamp>/, the last few per entry, so the
// person can see before and after (the browser preview's Checks panel, or the
// paths the check result lists) in hosts that don't show tool images.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export const CHECK_RUNS_KEPT = 5;
const RUN_FILE = 'run.json';

export interface CheckRunImage {
  label: string;
  /** File name inside the run folder. */
  file: string;
  width: number;
  height: number;
}

export interface CheckRun {
  entryPath: string;
  /** Folder name, also the run's id (an ISO-like timestamp). */
  id: string;
  createdAt: string;
  mode: string;
  errors: number;
  warnings: number;
  findings: Array<{ severity: string; check: string; message: string }>;
  images: CheckRunImage[];
}

export interface SavedCheckRun {
  run: CheckRun;
  /** Workspace-relative run folder. */
  dir: string;
  previous?: { run: CheckRun; dir: string };
}

/** The folder name for an entry's runs: its path below outputDir, flattened. */
export function checkRunSlug(entryPath: string, outputDir = '.open-design'): string {
  const norm = entryPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const prefix = `${outputDir.replace(/\\/g, '/').replace(/\/$/, '')}/`;
  const rel = norm.startsWith(prefix) ? norm.slice(prefix.length) : norm;
  return rel.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'artifact';
}

export function checkRunsDir(outputDir: string, entryPath: string): string {
  return path.posix.join(outputDir.replace(/\\/g, '/'), '.checks', checkRunSlug(entryPath, outputDir));
}

function runId(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\..+$/, '');
}

function imageFileName(index: number, label: string): string {
  return `${String(index + 1).padStart(2, '0')}-${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40) || 'image'}.jpg`;
}

type Listener = (saved: SavedCheckRun & { workspaceRoot: string }) => void;
const listeners = new Set<Listener>();

/** Called after every saved run in this process (the browser preview listens). Returns an unsubscribe function. */
export function onCheckRunSaved(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Newest first. */
export async function listCheckRuns(workspaceRoot: string, outputDir: string, entryPath: string): Promise<CheckRun[]> {
  const abs = path.join(workspaceRoot, checkRunsDir(outputDir, entryPath));
  let names: string[];
  try {
    names = await fs.readdir(abs);
  } catch {
    return [];
  }
  const runs: CheckRun[] = [];
  for (const name of names.sort().reverse()) {
    try {
      runs.push(JSON.parse(await fs.readFile(path.join(abs, name, RUN_FILE), 'utf8')) as CheckRun);
    } catch {
      // Not a run folder, or one being written.
    }
  }
  return runs;
}

/** A saved run's image, or undefined; `file` must be one the run lists. */
export async function readCheckRunImage(workspaceRoot: string, outputDir: string, entryPath: string, runIdValue: string, file: string): Promise<Buffer | undefined> {
  if (!/^[\w-]+$/.test(runIdValue) || !/^[\w.-]+\.jpg$/.test(file)) return undefined;
  try {
    return await fs.readFile(path.join(workspaceRoot, checkRunsDir(outputDir, entryPath), runIdValue, file));
  } catch {
    return undefined;
  }
}

export async function saveCheckRun(
  workspaceRoot: string,
  outputDir: string,
  entryPath: string,
  result: { mode: string; findings: Array<{ severity: string; check: string; message: string }>; images: Array<{ label: string; data: Buffer; width: number; height: number }> },
  now = new Date(),
): Promise<SavedCheckRun> {
  const previousRun = (await listCheckRuns(workspaceRoot, outputDir, entryPath))[0];
  const baseRel = checkRunsDir(outputDir, entryPath);
  let id = runId(now);
  // Two runs in the same second (a fast re-check) get distinct folders.
  for (let n = 2; previousRun && previousRun.id.startsWith(runId(now)) && previousRun.id >= id; n++) id = `${runId(now)}-${n}`;
  const dirRel = path.posix.join(baseRel, id);
  const dirAbs = path.join(workspaceRoot, dirRel);
  await fs.mkdir(dirAbs, { recursive: true });
  const images: CheckRunImage[] = [];
  for (const [i, image] of result.images.entries()) {
    const file = imageFileName(i, image.label);
    await fs.writeFile(path.join(dirAbs, file), image.data);
    images.push({ label: image.label, file, width: image.width, height: image.height });
  }
  const run: CheckRun = {
    entryPath,
    id,
    createdAt: now.toISOString(),
    mode: result.mode,
    errors: result.findings.filter((f) => f.severity === 'error').length,
    warnings: result.findings.filter((f) => f.severity === 'warning').length,
    findings: result.findings.map((f) => ({ severity: f.severity, check: f.check, message: f.message })),
    images,
  };
  await fs.writeFile(path.join(dirAbs, RUN_FILE), JSON.stringify(run, null, 2) + '\n', 'utf8');

  // Keep the newest CHECK_RUNS_KEPT folders.
  const names = (await fs.readdir(path.join(workspaceRoot, baseRel))).sort().reverse();
  for (const old of names.slice(CHECK_RUNS_KEPT)) await fs.rm(path.join(workspaceRoot, baseRel, old), { recursive: true, force: true });

  const saved: SavedCheckRun = { run, dir: dirRel, previous: previousRun ? { run: previousRun, dir: path.posix.join(baseRel, previousRun.id) } : undefined };
  for (const listener of listeners) {
    try {
      listener({ ...saved, workspaceRoot });
    } catch {
      // A listener's failure never fails the check.
    }
  }
  return saved;
}

/** The lines a check result adds about its saved run. */
export function formatSavedCheckRun(saved: SavedCheckRun): string[] {
  const lines: string[] = [];
  if (saved.run.images.length) lines.push(`Screenshots saved for the user: ${saved.run.images.map((i) => path.posix.join(saved.dir, i.file)).join(', ')}.`);
  else lines.push(`Findings saved to ${saved.dir}/.`);
  if (saved.previous) {
    const p = saved.previous.run;
    lines.push(`Previous check: ${saved.previous.dir}/ (errors ${p.errors} → ${saved.run.errors}, warnings ${p.warnings} → ${saved.run.warnings}).`);
  }
  return lines;
}
