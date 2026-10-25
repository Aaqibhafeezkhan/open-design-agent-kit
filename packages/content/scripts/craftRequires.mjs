// Guards for kit-owned craft (openspec add-states-and-microcopy-craft):
// local/craft-requires.json may only name real skills or templates and real
// craft docs, and a local craft doc that supersedes an upstream line must
// still quote text that upstream has, so a content sync that changes the
// line is noticed.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const POOLS = ['skills', 'design-templates'];
/** `Supersedes \`form-validation.md\`: "…"` in a local craft doc. */
const SUPERSEDES = /Supersedes `([a-z0-9-]+)\.md`[^"\n]*"([^"\n]+)"/g;

async function read(p) {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return undefined;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** The map's entries, `$`-prefixed keys (comments) left out. Throws on malformed JSON. */
export function parseCraftRequires(raw) {
  const json = JSON.parse(raw);
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('must be an object of id → craft ids');
  return Object.entries(json).filter(([key]) => !key.startsWith('$'));
}

/** Problems with `<assetsRoot>/craft-requires.json`, as human-readable strings (empty when fine or absent). */
export async function checkCraftRequires(assetsRoot) {
  const raw = await read(path.join(assetsRoot, 'craft-requires.json'));
  if (raw === undefined) return [];
  let entries;
  try {
    entries = parseCraftRequires(raw);
  } catch (err) {
    return [`craft-requires.json: ${err.message}`];
  }
  const problems = [];
  for (const [id, craftIds] of entries) {
    let known = false;
    for (const pool of POOLS) if (await exists(path.join(assetsRoot, pool, id, 'SKILL.md'))) known = true;
    if (!known) problems.push(`${id}: unknown skill or template id`);
    if (!Array.isArray(craftIds) || craftIds.some((c) => typeof c !== 'string')) {
      problems.push(`${id}: must list craft ids as strings`);
      continue;
    }
    for (const craftId of craftIds) {
      if (!(await exists(path.join(assetsRoot, 'craft', `${craftId}.md`)))) problems.push(`${id}: unknown craft id "${craftId}"`);
    }
  }
  return problems;
}

/** Problems with local craft docs' `Supersedes` quotes: each must still appear in the named upstream craft doc. */
export async function checkSupersededQuotes(localRoot, assetsRoot) {
  const dir = path.join(localRoot, 'craft');
  if (!(await exists(dir))) return [];
  const problems = [];
  for (const name of (await fs.readdir(dir)).filter((n) => n.endsWith('.md'))) {
    const body = await fs.readFile(path.join(dir, name), 'utf8');
    for (const [, upstreamId, quote] of body.matchAll(SUPERSEDES)) {
      const upstream = await read(path.join(assetsRoot, 'craft', `${upstreamId}.md`));
      if (upstream === undefined) problems.push(`${name}: supersedes ${upstreamId}.md, which no longer exists`);
      else if (!upstream.includes(quote)) problems.push(`${name}: ${upstreamId}.md no longer says "${quote}"; re-read the upstream change and update the addendum`);
    }
  }
  return problems;
}
