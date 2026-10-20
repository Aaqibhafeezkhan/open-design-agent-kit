// The browser-target preview modules (openspec add-browser-preview) are
// bundled into the VS Code webview, the in-page bridge and the browser
// preview shell, so neither they nor anything they import may use `node:`
// modules. Walks the relative imports from each browser entry point.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// Tests run from out/test/unit; the sources are next to out/.
const SRC = path.join(__dirname, '..', '..', '..', 'src');

const BROWSER_ENTRIES = ['preview/bridge.ts', 'preview/protocol.ts', 'preview/commentController.ts', 'preview/shell/main.ts'];

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

async function resolveTs(fromFile: string, spec: string): Promise<string | undefined> {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts'), base]) {
    if (await fs.stat(candidate).then((s) => s.isFile()).catch(() => false)) return candidate;
  }
  return undefined;
}

async function nodeImportsReachableFrom(entry: string): Promise<string[]> {
  const seen = new Set<string>();
  const problems: string[] = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    // Type-only imports are erased from the bundle, so they don't count.
    const source = (await fs.readFile(file, 'utf8')).replace(/import\s+type\s[^;]+;/g, '').replace(/export\s+type\s[^;]+;/g, '');
    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2] ?? match[3];
      if (!spec) continue;
      const rel = path.relative(SRC, file);
      if (spec.startsWith('node:') || ['fs', 'path', 'os', 'http', 'child_process', 'crypto'].includes(spec)) problems.push(`${rel} imports ${spec}`);
      else if (spec.startsWith('.')) {
        const resolved = await resolveTs(file, spec);
        if (resolved) queue.push(resolved);
      }
    }
  }
  return problems;
}

describe('preview browser modules', () => {
  it('import no node: module, directly or through their relative imports', async () => {
    const problems: string[] = [];
    let checked = 0;
    for (const entry of BROWSER_ENTRIES) {
      const abs = path.join(SRC, entry);
      if (!(await fs.stat(abs).catch(() => undefined))) continue;
      checked++;
      problems.push(...(await nodeImportsReachableFrom(abs)));
    }
    assert.ok(checked >= 2, 'expected the browser entry points to exist');
    assert.deepStrictEqual(problems, []);
  });
});
