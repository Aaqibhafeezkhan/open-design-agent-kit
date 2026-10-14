#!/usr/bin/env node
// Scaffold generator for porting apps from Meliwat/awesome-ios-design-md into
// this repo's local content overlay as "Mobile Apps" design systems (id
// `<app>-ios`). See iosExtraction.mjs for the extraction rules and
// packages/content/local/README.md for the scaffold -> review -> move
// workflow. NEVER writes into local/design-systems/ directly — output lands
// under the gitignored .ios-scaffold/ staging dir, so an unreviewed scaffold
// can never be picked up by apply-local-overlay.mjs.
//
// Usage:
//   node scripts/extract-ios-design-system.mjs <app>... [--source <dir>] [--force]
//   node scripts/extract-ios-design-system.mjs --list-candidates [--source <dir>]
//   node scripts/extract-ios-design-system.mjs --report [--source <dir>]
//
// --source is a local awesome-ios-design-md checkout (defaults to
// $IOS_DESIGN_MD_SRC). Without either, files are fetched from GitHub on
// `main` (the repo has no tags to pin against); listing apps then uses the
// unauthenticated git-trees API, which allows 60 requests an hour.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyIosCandidates, extractIosDesignSystemScaffold, extractIosTokens, summarizeExtractions, SOURCE_REPO_URL } from './iosExtraction.mjs';
import { OVERLAY_MARKER } from './apply-local-overlay.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const assetsRoot = path.join(packageRoot, 'assets', 'open-design');
const localDesignSystemsRoot = path.join(packageRoot, 'local', 'design-systems');
const scaffoldRoot = path.join(packageRoot, 'scripts', '.ios-scaffold');

const RAW_BASE = 'https://raw.githubusercontent.com/Meliwat/awesome-ios-design-md/main';
const TREE_URL = 'https://api.github.com/repos/Meliwat/awesome-ios-design-md/git/trees/main?recursive=1';

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listDirs(dir) {
  if (!(await pathExists(dir))) return [];
  return (await fs.readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

/** Every app as { category, app }. */
async function listApps(source) {
  if (source) {
    const root = path.join(source, 'design-md');
    const apps = [];
    for (const category of await listDirs(root)) {
      for (const app of await listDirs(path.join(root, category))) {
        if (await pathExists(path.join(root, category, app, 'DESIGN.md'))) apps.push({ category, app });
      }
    }
    return apps;
  }
  const { tree } = JSON.parse(await fetchText(TREE_URL));
  return tree
    .map((e) => e.path.match(/^design-md\/([^/]+)\/([^/]+)\/DESIGN\.md$/))
    .filter(Boolean)
    .map(([, category, app]) => ({ category, app }));
}

async function readApp(source, { category, app }) {
  const rel = `design-md/${category}/${app}`;
  if (source) {
    const dir = path.join(source, rel);
    const readmePath = path.join(dir, 'README.md');
    return {
      designMd: await fs.readFile(path.join(dir, 'DESIGN.md'), 'utf8'),
      readmeMd: (await pathExists(readmePath)) ? await fs.readFile(readmePath, 'utf8') : '',
    };
  }
  const [designMd, readmeMd] = await Promise.all([fetchText(`${RAW_BASE}/${rel}/DESIGN.md`), fetchText(`${RAW_BASE}/${rel}/README.md`).catch(() => '')]);
  return { designMd, readmeMd };
}

// Local-overlay copies also land in assets/ (carrying OVERLAY_MARKER); only
// the unmarked ones are really upstream.
async function getUpstreamDesignSystemIds() {
  const dsRoot = path.join(assetsRoot, 'design-systems');
  const ids = [];
  for (const id of await listDirs(dsRoot)) {
    if (!(await pathExists(path.join(dsRoot, id, OVERLAY_MARKER)))) ids.push(id);
  }
  return new Set(ids);
}

async function getLocalDesignSystemIds() {
  return new Set(await listDirs(localDesignSystemsRoot));
}

function parseArgs(argv) {
  const args = { source: process.env.IOS_DESIGN_MD_SRC, force: false, listCandidates: false, report: false, apps: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--source') args.source = argv[++i];
    else if (arg === '--force') args.force = true;
    else if (arg === '--list-candidates') args.listCandidates = true;
    else if (arg === '--report') args.report = true;
    else if (!arg.startsWith('--')) args.apps.push(arg);
  }
  return args;
}

async function runListCandidates(args) {
  const apps = (await listApps(args.source)).map((a) => a.app);
  const { ported, candidate, sameBrandUpstream } = classifyIosCandidates(apps, await getUpstreamDesignSystemIds(), await getLocalDesignSystemIds());
  console.log(`ported (already a <app>-ios system, ${ported.length}): ${ported.join(', ') || '(none)'}`);
  console.log(`candidate (${candidate.length}): ${candidate.join(', ') || '(none)'}`);
  console.log(`same brand as an upstream web system (${sameBrandUpstream.length}): ${sameBrandUpstream.join(', ') || '(none)'}`);
}

async function runReport(args) {
  const apps = await listApps(args.source);
  const extractions = [];
  for (const a of apps) extractions.push(extractIosTokens((await readApp(args.source, a)).designMd));
  const s = summarizeExtractions(extractions);
  const pct = (k) => `${k}/${s.total} (${Math.round((100 * k) / s.total)}%)`;
  console.log(`apps: ${s.total} (dark-first ${s.dark}, light-first ${s.total - s.dark})\n`);
  console.log('role     found          §9 agree  elsewhere  disagree  unlisted');
  for (const [role, r] of Object.entries(s.roles)) {
    console.log(`${role.padEnd(8)} ${pct(r.found).padEnd(14)} ${String(r.agree).padEnd(9)} ${String(r.elsewhere).padEnd(10)} ${String(r.disagree).padEnd(9)} ${r.unlisted}`);
  }
  console.log(`\nfont ${pct(s.font)}   type table ${pct(s.typeTable)}   body size ${pct(s.bodySize)}   radii ${pct(s.radii)}`);
  console.log(`fg/bg contrast ≥ 4.5: ${pct(s.fgContrastOk)}`);
  console.log(`clean (all six roles, readable, font found, §9 doesn't contradict accent/bg/fg): ${pct(s.clean)}`);
}

async function runExtract(args) {
  if (!args.apps.length) {
    console.error('Usage: node scripts/extract-ios-design-system.mjs <app>... [--source <dir>] [--force]');
    process.exit(1);
  }
  const all = await listApps(args.source);
  const upstreamIds = await getUpstreamDesignSystemIds();
  const localIds = await getLocalDesignSystemIds();
  let failed = false;
  for (const wanted of args.apps) {
    const entry = all.find((a) => a.app === wanted || `${a.category}/${a.app}` === wanted);
    if (!entry) {
      console.error(`No app "${wanted}" in awesome-ios-design-md. Run --list-candidates to see them.`);
      failed = true;
      continue;
    }
    const files = await readApp(args.source, entry);
    const scaffold = extractIosDesignSystemScaffold({ ...entry, ...files }, upstreamIds, localIds);
    if (scaffold.collision && !args.force) {
      console.error(`Refusing to scaffold "${scaffold.id}": ${scaffold.notes[0]}`);
      failed = true;
      continue;
    }
    const dir = path.join(scaffoldRoot, scaffold.id);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(scaffold.manifest, null, 2) + '\n');
    await fs.writeFile(path.join(dir, 'tokens.css'), scaffold.tokensCss);
    await fs.writeFile(path.join(dir, 'DESIGN.md'), scaffold.designMd);
    await fs.writeFile(
      path.join(dir, 'NOTES.md'),
      `# Review checklist for "${scaffold.id}"\n\n` +
        `Source: ${SOURCE_REPO_URL}/tree/main/design-md/${entry.category}/${entry.app}\n\n` +
        scaffold.notes.map((n) => `- [ ] ${n}`).join('\n') +
        '\n\nOnce every item above is resolved, remove the `TODO` comments from tokens.css, move ' +
        `manifest.json/tokens.css/DESIGN.md into packages/content/local/design-systems/${scaffold.id}/, delete this NOTES.md, then run ` +
        '`npm run apply-overlay --workspace=@feimacode/open-design-agent-kit-content` (and the vscode mirror step, see local/README.md).\n',
    );
    console.log(`${path.relative(process.cwd(), dir)}/ — ${scaffold.notes.length} review items`);
  }
  if (failed) process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.listCandidates) await runListCandidates(args);
  else if (args.report) await runReport(args);
  else await runExtract(args);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
