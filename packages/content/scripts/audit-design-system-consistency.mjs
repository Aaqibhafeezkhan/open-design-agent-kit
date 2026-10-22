#!/usr/bin/env node
// Audits every bundled design system whose DESIGN.md follows upstream's
// template for agreement with its tokens.css (openspec
// reconcile-design-system-sources), and keeps the generated overlays that
// fix the disagreements in step with local/design-system-sources.json.
//
//   node scripts/audit-design-system-consistency.mjs            print the review table
//   node scripts/audit-design-system-consistency.mjs --suggest  add suggested rows for undecided systems
//   node scripts/audit-design-system-consistency.mjs --write    regenerate overlays from the decisions
//   ... --json                                                  print the audit as JSON
//
// After --write, run `npm run apply-overlay` to copy the overlays into assets/.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AUDIT_COMMAND,
  DESIGN_SECTIONS_FILE,
  GENERATED_OVERRIDE_HEADER,
  GENERATED_SECTIONS_HEADER,
  SOURCES_FILE,
  TOKENS_OVERRIDE_FILE,
  auditSystem,
  generateOverlays,
  suggestSide,
} from './designSystemConsistency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
export const ASSETS_ROOT = path.join(packageRoot, 'assets', 'open-design');
export const LOCAL_ROOT = path.join(packageRoot, 'local');
const OVERLAY_MARKER = '.od-local-overlay';

async function readOptional(p) {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return undefined;
  }
}

export async function readSources(localRoot = LOCAL_ROOT) {
  const raw = await readOptional(path.join(localRoot, SOURCES_FILE));
  return raw ? JSON.parse(raw) : {};
}

async function writeSources(sources, localRoot) {
  const sorted = Object.fromEntries(Object.keys(sources).sort().map((id) => [id, sources[id]]));
  await fs.writeFile(path.join(localRoot, SOURCES_FILE), JSON.stringify(sorted, null, 2) + '\n');
}

/**
 * One row per vendored upstream design system with a template DESIGN.md:
 * its vendored files, its local overlays, and the audit both before
 * (`raw`) and after (`applied`) those overlays.
 */
export async function auditAll(assetsRoot = ASSETS_ROOT, localRoot = LOCAL_ROOT) {
  const dsRoot = path.join(assetsRoot, 'design-systems');
  const rows = [];
  for (const entry of (await fs.readdir(dsRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const id = entry.name;
    const dir = path.join(dsRoot, id);
    // Our own new packages are copied in with a marker; they aren't upstream content.
    if ((await readOptional(path.join(dir, OVERLAY_MARKER))) !== undefined) continue;
    const designMd = await readOptional(path.join(dir, 'DESIGN.md'));
    const tokensCss = await readOptional(path.join(dir, 'tokens.css'));
    if (designMd === undefined || tokensCss === undefined) continue;
    const overrideCss = await readOptional(path.join(localRoot, 'design-systems', id, TOKENS_OVERRIDE_FILE));
    const sectionsMd = await readOptional(path.join(localRoot, 'design-systems', id, DESIGN_SECTIONS_FILE));
    const raw = auditSystem({ designMd, tokensCss });
    if (!raw.template) continue;
    let applied;
    try {
      applied = auditSystem({ designMd, tokensCss, overrideCss, sectionsMd });
    } catch (err) {
      applied = { error: err.message };
    }
    rows.push({ id, designMd, tokensCss, overrideCss, sectionsMd, raw, applied });
  }
  return rows;
}

/**
 * Drift problems for check-content-sync.mjs: `failures` fail the build,
 * `removable` are overlays upstream has made unnecessary.
 */
export async function checkConsistency(assetsRoot = ASSETS_ROOT, localRoot = LOCAL_ROOT) {
  const sources = await readSources(localRoot);
  const rows = await auditAll(assetsRoot, localRoot);
  const failures = [];
  const removable = [];
  const seen = new Set();
  for (const row of rows) {
    seen.add(row.id);
    const decision = sources[row.id];
    if (row.raw.status === 'consistent') {
      if (decision || row.overrideCss || row.sectionsMd) removable.push(`${row.id} (DESIGN.md and tokens.css agree upstream now)`);
      continue;
    }
    if (!decision) {
      failures.push(`${row.id}: DESIGN.md and tokens.css disagree (${row.raw.status}) and ${SOURCES_FILE} has no decision. Run \`${AUDIT_COMMAND} -- --suggest\`, review the row, then \`-- --write\`.`);
      continue;
    }
    if (decision.suggested) {
      failures.push(`${row.id}: the decision in ${SOURCES_FILE} is still a suggestion; confirm it (remove "suggested") once reviewed.`);
    }
    const expected = generateOverlays({ designMd: row.designMd, tokensCss: row.tokensCss, decision });
    const stale = [];
    if ((expected.override ?? null) !== (row.overrideCss ?? null)) stale.push(TOKENS_OVERRIDE_FILE);
    if ((expected.sections ?? null) !== (row.sectionsMd ?? null)) stale.push(DESIGN_SECTIONS_FILE);
    if (stale.length > 0) failures.push(`${row.id}: ${stale.join(' and ')} differ from what the decision generates. Run \`${AUDIT_COMMAND} -- --write\` and \`npm run apply-overlay\`.`);
    else if (row.applied.error) failures.push(`${row.id}: ${row.applied.error}`);
    else if (row.applied.status !== 'consistent') failures.push(`${row.id}: still inconsistent after its overlays (${row.applied.status}).`);
  }
  for (const id of Object.keys(sources)) if (!seen.has(id)) failures.push(`${id}: ${SOURCES_FILE} has a decision for a design system that isn't a bundled template system.`);
  return { failures, removable };
}

function tableRows(rows) {
  const lines = ['| System | Status | Field | DESIGN.md | tokens.css |', '|---|---|---|---|---|'];
  for (const row of rows) {
    const diffs = row.raw.fields.filter((f) => !f.same);
    if (diffs.length === 0) {
      lines.push(`| ${row.id} | consistent | | | |`);
      continue;
    }
    diffs.forEach((f, i) => lines.push(`| ${i === 0 ? row.id : ''} | ${i === 0 ? `${row.raw.status} (color ${row.raw.color}, type ${row.raw.type})` : ''} | ${f.field} | \`${f.design}\` | \`${f.tokens}\` |`));
  }
  return lines.join('\n');
}

async function writeOverlays(rows, sources, localRoot) {
  const written = [];
  for (const row of rows) {
    const decision = sources[row.id];
    const dir = path.join(localRoot, 'design-systems', row.id);
    const expected = decision && row.raw.status !== 'consistent' ? generateOverlays({ designMd: row.designMd, tokensCss: row.tokensCss, decision }) : {};
    for (const [file, content] of [[TOKENS_OVERRIDE_FILE, expected.override], [DESIGN_SECTIONS_FILE, expected.sections]]) {
      const target = path.join(dir, file);
      const current = await readOptional(target);
      if (content === undefined) {
        // Remove only what a decision owns: a generated file, or a hand-written override a decision now replaces.
        if (current !== undefined && (decision || current.startsWith(GENERATED_OVERRIDE_HEADER) || current.startsWith(GENERATED_SECTIONS_HEADER))) {
          await fs.rm(target);
          written.push(`removed ${row.id}/${file}`);
        }
      } else if (content !== current) {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(target, content);
        written.push(`wrote ${row.id}/${file}`);
      }
    }
    try {
      if ((await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
    } catch {}
  }
  return written;
}

async function main(argv) {
  const localRoot = LOCAL_ROOT;
  const rows = await auditAll(ASSETS_ROOT, localRoot);
  const sources = await readSources(localRoot);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(rows.map(({ id, raw, applied }) => ({ id, raw, applied, decision: sources[id] })), null, 2));
    return;
  }
  if (argv.includes('--suggest')) {
    let added = 0;
    for (const row of rows) {
      if (row.raw.status === 'consistent' || sources[row.id]) continue;
      sources[row.id] = {
        color: suggestSide(row.raw.color),
        type: suggestSide(row.raw.type),
        reason: `suggested: color ${row.raw.color}, type ${row.raw.type}`,
        suggested: true,
      };
      added++;
    }
    await writeSources(sources, localRoot);
    console.log(`Added ${added} suggested rows to local/${SOURCES_FILE}.`);
    return;
  }
  if (argv.includes('--write')) {
    const written = await writeOverlays(rows, sources, localRoot);
    console.log(written.length > 0 ? written.join('\n') : 'Overlays already match the decisions.');
    return;
  }
  console.log(tableRows(rows));
  const counts = {};
  for (const row of rows) counts[row.raw.status] = (counts[row.raw.status] ?? 0) + 1;
  console.log(`\n${rows.length} template systems: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`);
  const { failures, removable } = await checkConsistency(ASSETS_ROOT, localRoot);
  if (removable.length > 0) console.log(`\nRemovable: ${removable.join(', ')}`);
  if (failures.length > 0) console.log(`\n${failures.length} problems:\n${failures.join('\n')}`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
