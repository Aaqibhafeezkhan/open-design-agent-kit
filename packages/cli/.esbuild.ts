// Bundles the CLI (like packages/mcp-server) so it can use
// @feimacode/open-design-agent-kit-core — a private, source-only workspace
// package — at runtime (`export` command). Published npm dependencies stay
// external and are installed normally.
import { promises as fs } from 'node:fs';
import * as esbuild from 'esbuild';
import { cheerioLoadParsePlugin } from '../core/build/cheerioLoadParsePlugin';
import { buildPreviewBundles } from '../core/build/previewBundles';

async function main() {
  await fs.rm('out', { recursive: true, force: true });
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: 'out/index.js',
    external: ['@feimacode/open-design-agent-kit-content', '@inquirer/prompts', 'commander', 'smol-toml'],
    plugins: [cheerioLoadParsePlugin],
    logLevel: 'info',
  });
  // The browser preview's shell and in-page bridge, read at runtime from out/preview/.
  await buildPreviewBundles('out');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
