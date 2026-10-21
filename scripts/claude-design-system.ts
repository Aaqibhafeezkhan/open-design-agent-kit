#!/usr/bin/env -S npx tsx
// One-off sync between Open Design design systems and Claude Design System
// artifacts (see packages/core/src/generation/claudeDesignSystem.ts).
//
//   npx tsx scripts/claude-design-system.ts export <design-system-dir> <out-dir> [--by <name>]
//     Reads DESIGN.md (+ tokens.css, manifest.json) and writes <out-dir>/project/…,
//     ready for an agent to publish to a Design System artifact with its Artifact tool.
//
//   npx tsx scripts/claude-design-system.ts import <artifact-dir> <design-systems-dir> [--id <slug>]
//     Reads <artifact-dir>/project/{design-system.json,tokens.json,README.md} (as an
//     Artifact `read` saves them) and writes <design-systems-dir>/<slug>/{DESIGN.md,tokens.css},
//     which Open Design lists as `user:<slug>`.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fromClaudeDesignSystem, toClaudeDesignSystem, type ClaudeTokensJson } from '../packages/core/src/generation/claudeDesignSystem';

const readOptional = async (file: string): Promise<string | undefined> => fs.readFile(file, 'utf8').catch(() => undefined);

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'claude-design-system';

async function exportCommand(dir: string, out: string, by?: string): Promise<void> {
  const designMd = await readOptional(path.join(dir, 'DESIGN.md'));
  if (!designMd) throw new Error(`${dir}/DESIGN.md not found`);
  const manifest = JSON.parse((await readOptional(path.join(dir, 'manifest.json'))) ?? '{}') as { id?: string; name?: string };
  const heading = /^#\s+(.+)$/m.exec(designMd)?.[1].replace(/^Design System (Inspired by )?/i, '').trim();
  const result = toClaudeDesignSystem({
    name: manifest.name ?? heading ?? path.basename(dir),
    id: manifest.id ?? path.basename(dir),
    designMd,
    tokensCss: await readOptional(path.join(dir, 'tokens.css')),
    by,
  });
  for (const [rel, text] of Object.entries(result.files)) {
    await fs.mkdir(path.dirname(path.join(out, rel)), { recursive: true });
    await fs.writeFile(path.join(out, rel), text);
  }
  console.log(JSON.stringify({ wrote: Object.keys(result.files).map((f) => path.join(out, f)), notes: result.notes }, null, 2));
}

async function importCommand(dir: string, target: string, id?: string): Promise<void> {
  const index = JSON.parse((await readOptional(path.join(dir, 'project/design-system.json'))) ?? '{}') as { title?: string };
  const tokensText = await readOptional(path.join(dir, 'project/tokens.json'));
  const readme = await readOptional(path.join(dir, 'project/README.md'));
  if (!tokensText && !readme) throw new Error(`${dir}/project has neither tokens.json nor README.md`);
  const title = index.title ?? /^#\s+(.+)$/m.exec(readme ?? '')?.[1].trim() ?? path.basename(dir);
  const result = fromClaudeDesignSystem({ title, tokensJson: tokensText ? (JSON.parse(tokensText) as ClaudeTokensJson) : undefined, readme });
  const slug = slugify(id ?? title);
  const dest = path.join(target, slug);
  await fs.mkdir(dest, { recursive: true });
  await fs.writeFile(path.join(dest, 'DESIGN.md'), result.designMd);
  await fs.writeFile(path.join(dest, 'tokens.css'), result.tokensCss);
  console.log(JSON.stringify({ id: `user:${slug}`, wrote: [path.join(dest, 'DESIGN.md'), path.join(dest, 'tokens.css')], notes: result.notes }, null, 2));
}

async function main(): Promise<void> {
  const [command, a, b, ...rest] = process.argv.slice(2);
  if (command === 'export' && a && b) return exportCommand(a, b, flag(rest, '--by'));
  if (command === 'import' && a && b) return importCommand(a, b, flag(rest, '--id'));
  console.error('usage: claude-design-system.ts export <design-system-dir> <out-dir> [--by <name>]\n       claude-design-system.ts import <artifact-dir> <design-systems-dir> [--id <slug>]');
  process.exitCode = 2;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
