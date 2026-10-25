// The surface catalog guard (openspec add-surface-picker, "Surface Build
// Guard"): every ready surface's entries must exist in the catalog and must
// not be catalog stubs, and every named prompt must exist. Stub detection
// mirrors packages/core's ContentIndex (keep the two in step).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const STUB_MARKER = 'This catalogue entry advertises';
const POOLS = ['skills', 'design-templates', 'examples'];
const IGNORED_FILES = new Set(['SKILL.md', '.od-local-overlay']);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** A pool entry is a stub when its SKILL.md advertises an upstream skill and the folder ships nothing else. */
export async function isStubEntry(entryDir) {
  const skillMd = path.join(entryDir, 'SKILL.md');
  if (!(await exists(skillMd))) return false;
  if (!(await fs.readFile(skillMd, 'utf8')).includes(STUB_MARKER)) return false;
  const others = (await fs.readdir(entryDir)).filter((n) => !IGNORED_FILES.has(n));
  return others.length === 0;
}

/** Problems with the surface catalog at `<assetsRoot>/surfaces.json`, as human-readable strings (empty when fine or absent). */
export async function checkSurfaces(assetsRoot) {
  const file = path.join(assetsRoot, 'surfaces.json');
  if (!(await exists(file))) return [];
  let catalog;
  try {
    catalog = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    return [`surfaces.json is not valid JSON: ${err.message}`];
  }
  const problems = [];
  const prompts = new Set();
  const promptsDir = path.join(assetsRoot, 'prompts');
  if (await exists(promptsDir)) {
    for (const name of await fs.readdir(promptsDir)) {
      if (!name.endsWith('.md')) continue;
      const { data } = matter(await fs.readFile(path.join(promptsDir, name), 'utf8'));
      if (typeof data.name === 'string') prompts.add(data.name);
    }
  }
  const ids = new Set();
  for (const s of Array.isArray(catalog.surfaces) ? catalog.surfaces : []) {
    if (!s || typeof s.id !== 'string' || !s.id) {
      problems.push('a surface has no id');
      continue;
    }
    if (ids.has(s.id)) problems.push(`${s.id}: id used twice`);
    ids.add(s.id);
    if (s.status !== 'ready' && s.status !== 'planned') problems.push(`${s.id}: status must be "ready" or "planned"`);
    if (typeof s.label !== 'string' || typeof s.description !== 'string') problems.push(`${s.id}: needs a label and a description`);
    if (s.status !== 'ready') continue;
    if (!Array.isArray(s.entries) || s.entries.length === 0) problems.push(`${s.id}: a ready surface needs at least one entry`);
    for (const entry of Array.isArray(s.entries) ? s.entries : []) {
      const dirs = [];
      for (const pool of POOLS) if (await exists(path.join(assetsRoot, pool, entry, 'SKILL.md'))) dirs.push(path.join(assetsRoot, pool, entry));
      if (dirs.length === 0) problems.push(`${s.id}: entry "${entry}" doesn't exist in the catalog`);
      else if ((await Promise.all(dirs.map(isStubEntry))).every(Boolean)) problems.push(`${s.id}: entry "${entry}" is a catalog stub (it only links upstream)`);
    }
    if (s.prompt !== undefined && !prompts.has(s.prompt)) problems.push(`${s.id}: prompt "${s.prompt}" doesn't exist`);
    problems.push(...checkSurfaceQuestions(s));
  }
  problems.push(...checkGoals(catalog));
  return problems;
}

/**
 * Problems with one surface's structured questions (openspec add-brief-questions):
 * an id, text, two to four options, a default among them and what the answer
 * changes. Plain-string questions still load; they're reported by
 * plainQuestionWarnings instead.
 */
export function checkSurfaceQuestions(surface) {
  const problems = [];
  const ids = new Set();
  for (const q of Array.isArray(surface.questions) ? surface.questions : []) {
    if (typeof q === 'string') continue;
    if (!q || typeof q.id !== 'string' || !q.id || typeof q.text !== 'string' || !q.text) {
      problems.push(`${surface.id}: a question needs an id and text`);
      continue;
    }
    const where = `${surface.id}: question "${q.id}"`;
    if (ids.has(q.id)) problems.push(`${where}: id used twice`);
    ids.add(q.id);
    const options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string' && o) : [];
    if (options.length < 2 || options.length > 4) problems.push(`${where}: needs two to four options`);
    if (!options.includes(q.default)) problems.push(`${where}: default must be one of its options`);
    if (typeof q.changes !== 'string' || !q.changes) problems.push(`${where}: needs a one-line "changes"`);
  }
  if (ids.size > 3) problems.push(`${surface.id}: at most three questions`);
  return problems;
}

/** Plain-string questions in the catalog: they load as questions with no options, so warn rather than fail. */
export function plainQuestionWarnings(catalog) {
  const warnings = [];
  for (const s of Array.isArray(catalog?.surfaces) ? catalog.surfaces : []) {
    for (const q of Array.isArray(s?.questions) ? s.questions : []) {
      if (typeof q === 'string') warnings.push(`${s.id}: "${q}" is a plain string; give it options, a default and what it changes`);
    }
  }
  return warnings;
}

/** Problems with the catalog's goals (openspec desktop-first-run-welcome): each must lead to ready surfaces. */
export function checkGoals(catalog) {
  const problems = [];
  const ready = new Set((Array.isArray(catalog.surfaces) ? catalog.surfaces : []).filter((s) => s && s.status === 'ready').map((s) => s.id));
  const ids = new Set();
  for (const g of Array.isArray(catalog.goals) ? catalog.goals : []) {
    if (!g || typeof g.id !== 'string' || !g.id) {
      problems.push('a goal has no id');
      continue;
    }
    if (ids.has(g.id)) problems.push(`goal ${g.id}: id used twice`);
    ids.add(g.id);
    if (typeof g.label !== 'string' || typeof g.description !== 'string') problems.push(`goal ${g.id}: needs a label and a description`);
    if (!Array.isArray(g.surfaces) || g.surfaces.length === 0) problems.push(`goal ${g.id}: needs at least one surface`);
    for (const surface of Array.isArray(g.surfaces) ? g.surfaces : []) {
      if (!ready.has(surface)) problems.push(`goal ${g.id}: surface "${surface}" doesn't exist or isn't ready`);
    }
  }
  return problems;
}
