// Builds the browser preview's browser code (openspec add-browser-preview):
// the shell (shell.js) and the in-page bridge (bridge.js), into
// <outDir>/preview/. Shared by the MCP server's and the CLI's esbuild
// configs; loadPreviewAssets() reads them back at runtime.
import * as path from 'node:path';
import * as esbuild from 'esbuild';

const SRC = path.join(__dirname, '..', 'src', 'preview');

export async function buildPreviewBundles(outDir: string, options: { minify?: boolean } = {}): Promise<void> {
  await esbuild.build({
    entryPoints: [
      { in: path.join(SRC, 'shell', 'main.ts'), out: 'shell' },
      { in: path.join(SRC, 'bridge.ts'), out: 'bridge' },
    ],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    outdir: path.join(outDir, 'preview'),
    minify: options.minify ?? true,
    logLevel: 'info',
  });
}
