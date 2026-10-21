// Checks a job run can do without a browser (design D6): missing local
// files, empty data-od-field elements, leftover placeholder text, the
// registration number check, and the artifact viewer's size limits for the
// preview's standalone file. Captures and check_open_design_artifact need
// Chrome; these don't, so an unattended cloud run still gets a verdict.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { load } from 'cheerio';
import { artifactPreflight } from '../export/artifactPreflight';
import { extractCssReferences, extractHtmlReferences, extractInlineCssReferences, resolveReferencedPath } from '../export/htmlReferences';
import { findStaleSources, prepareSourceRegistration, recordedSources, visibleText } from '../generation/sourceNumberCheck';
import { readArtifact } from '../vendored/artifactCreate';
import type { JobCheckFinding } from './runLog';

const PLACEHOLDERS: Array<{ re: RegExp; label: string }> = [
  { re: /\{\{/, label: '{{' },
  { re: /\bTODO\b/, label: 'TODO' },
  { re: /\blorem ipsum\b/i, label: 'Lorem ipsum' },
];
const MAX_LISTED = 10;

async function exists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/** Where the standalone export (and so the claude-artifact preview) is written for an entry. */
export function standalonePathFor(entryPath: string): string {
  const p = entryPath.replace(/\\/g, '/');
  return path.posix.join(path.posix.dirname(p), 'exports', `${path.posix.basename(p, path.posix.extname(p))}.html`);
}

/** Local files the entry and its supporting CSS reference that don't exist. */
export async function findMissingReferences(workspaceRoot: string, entryPath: string, html: string, supportingFiles: string[]): Promise<string[]> {
  const entryDir = path.posix.dirname(entryPath.replace(/\\/g, '/'));
  const refs = new Set<string>();
  for (const raw of [...extractHtmlReferences(html), ...extractInlineCssReferences(html)]) {
    const resolved = resolveReferencedPath(raw, entryDir);
    if (resolved) refs.add(resolved);
  }
  for (const file of supportingFiles.filter((f) => /\.css$/i.test(f))) {
    try {
      const css = await fs.readFile(path.join(workspaceRoot, file), 'utf8');
      for (const raw of extractCssReferences(css)) {
        const resolved = resolveReferencedPath(raw, path.posix.dirname(file));
        if (resolved) refs.add(resolved);
      }
    } catch {
      // A missing supporting file is reported below.
    }
  }
  for (const file of supportingFiles) refs.add(path.posix.normalize(file));
  const missing: string[] = [];
  for (const ref of refs) if (!(await exists(path.join(workspaceRoot, ref)))) missing.push(ref);
  return missing.sort();
}

/** Names of data-od-field elements with no text and no media. */
export function findEmptyFields(html: string): string[] {
  const $ = load(html);
  const empty = new Set<string>();
  $('[data-od-field]').each((_, el) => {
    const node = $(el);
    const name = node.attr('data-od-field') ?? '';
    const tag = (el as { tagName?: string }).tagName?.toLowerCase();
    if (tag === 'img' || tag === 'image') {
      if (!(node.attr('src') ?? node.attr('href') ?? '').trim()) empty.add(name);
      return;
    }
    if (tag === 'input' || tag === 'textarea') {
      if (!(node.attr('value') ?? node.text()).trim()) empty.add(name);
      return;
    }
    if (node.text().trim()) return;
    if (node.find('img[src], svg, video, picture, canvas, iframe').length > 0) return;
    empty.add(name);
  });
  return [...empty];
}

/** Placeholder markers left in the page's visible text. */
export function findPlaceholders(html: string): string[] {
  const text = visibleText(html);
  return PLACEHOLDERS.filter((p) => p.re.test(text)).map((p) => p.label);
}

const list = (items: string[]) => `${items.slice(0, MAX_LISTED).join(', ')}${items.length > MAX_LISTED ? ` and ${items.length - MAX_LISTED} more` : ''}`;

/** Every browserless check on the run's target entry. */
export async function runJobChecks(input: { workspaceRoot: string; outputDir: string; entryPath: string; preview: boolean }): Promise<JobCheckFinding[]> {
  const findings: JobCheckFinding[] = [];
  const artifact = await readArtifact({ workspaceRoot: input.workspaceRoot, entryPath: input.entryPath });
  if (!artifact) {
    return [{ severity: 'error', code: 'entry-missing', message: `The target entry ${input.entryPath} doesn't exist: the run didn't write it.` }];
  }
  if (!artifact.manifest) {
    findings.push({ severity: 'error', code: 'not-registered', message: `${input.entryPath} isn't registered: call register_open_design_artifact for it.` });
  }
  const isHtml = /\.html?$/i.test(input.entryPath);
  const html = artifact.entryContent;

  const missing = await findMissingReferences(input.workspaceRoot, input.entryPath, isHtml ? html : '', artifact.supportingFiles);
  if (missing.length) findings.push({ severity: 'error', code: 'missing-file', message: `Referenced but missing: ${list(missing)}.` });

  if (isHtml) {
    const empty = findEmptyFields(html);
    if (empty.length) findings.push({ severity: 'error', code: 'empty-field', message: `Empty data-od-field element(s): ${list(empty.map((f) => `"${f || '(unnamed)'}"`))}.` });
    const placeholders = findPlaceholders(html);
    if (placeholders.length) findings.push({ severity: 'error', code: 'placeholder-text', message: `Placeholder text left on the page: ${placeholders.join(', ')}.` });
  }

  const recorded = recordedSources(artifact.manifest);
  if (recorded.length) {
    const stale = await findStaleSources(input.workspaceRoot, input.outputDir, recorded);
    if (stale.length) {
      findings.push({
        severity: 'warning',
        code: 'stale-sources',
        message: `Changed since registration: ${list(stale.map((s) => `${s.path} (${s.reason})`))}. Register the artifact again with its sources after updating it.`,
      });
    }
    if (isHtml) {
      const reg = await prepareSourceRegistration({ workspaceRoot: input.workspaceRoot, outputDir: input.outputDir, entryPath: input.entryPath, sourcePaths: recorded.map((s) => s.path) });
      const unmatched = reg.numberCheck?.unmatched ?? [];
      if (unmatched.length) {
        const omitted = reg.numberCheck?.omitted ?? 0;
        findings.push({
          severity: 'warning',
          code: 'unsourced-number',
          message: `Number(s) on the page found in no source: ${list(unmatched.map((u) => u.number))}${omitted ? ` (+${omitted} more)` : ''}. Check each is derived as the notes say.`,
        });
      }
    }
  }

  if (input.preview && isHtml) {
    const standalone = standalonePathFor(input.entryPath);
    try {
      const file = await fs.readFile(path.join(input.workspaceRoot, standalone), 'utf8');
      for (const f of artifactPreflight({ html: file }).findings) {
        if (f.code === 'artifact-blocked-host') continue;
        findings.push({ severity: f.code === 'artifact-too-large' ? 'error' : 'warning', code: f.code, message: f.message });
      }
    } catch {
      // No standalone file yet: the preview step reports its own problems.
    }
  }

  return findings;
}
