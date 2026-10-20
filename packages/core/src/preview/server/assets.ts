// The browser preview's bundled browser code, read at runtime from the
// `preview/` folder its host's build wrote next to the bundle (see
// build/previewBundles.ts). Under tsx (dev runs, tests) there is no such
// folder, so the code is bundled in memory instead when esbuild is around.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface PreviewAssets {
  shellJs: string;
  bridgeJs: string;
}

let cached: Promise<PreviewAssets> | undefined;

async function bundleInMemory(): Promise<PreviewAssets> {
  // A non-literal specifier, so host bundlers leave this dev-only import alone.
  const name = 'esbuild';
  const esbuild = (await import(name)) as typeof import('esbuild');
  const src = path.join(__dirname, '..');
  // The TypeScript sources under tsx, or tsc's output when tests run compiled.
  const build = async (entry: string): Promise<string> => {
    const ts = path.join(src, `${entry}.ts`);
    const file = (await fs.stat(ts).catch(() => undefined)) ? ts : path.join(src, `${entry}.js`);
    return (await esbuild.build({ entryPoints: [file], bundle: true, platform: 'browser', format: 'iife', target: 'es2020', write: false })).outputFiles[0].text;
  };
  return { shellJs: await build(path.join('shell', 'main')), bridgeJs: await build('bridge') };
}

export function loadPreviewAssets(dir = path.join(__dirname, 'preview')): Promise<PreviewAssets> {
  cached ??= (async () => {
    try {
      return { shellJs: await fs.readFile(path.join(dir, 'shell.js'), 'utf8'), bridgeJs: await fs.readFile(path.join(dir, 'bridge.js'), 'utf8') };
    } catch (err) {
      try {
        return await bundleInMemory();
      } catch {
        throw new Error(`The browser preview's files are missing from ${dir} (${err instanceof Error ? err.message : String(err)}). Reinstall the package.`);
      }
    }
  })();
  cached.catch(() => {
    cached = undefined;
  });
  return cached;
}
