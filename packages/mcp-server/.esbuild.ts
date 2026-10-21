import { promises as fs } from 'node:fs';
import * as esbuild from 'esbuild';
import { buildPreviewBundles } from '../core/build/previewBundles';
import { CONTENT_PACKAGE, MCP_SDK_PACKAGE, serverBuildOptions } from './serverBuild';

// Bundles @feimacode/open-design-agent-kit-core (raw TS source, no compiled
// output of its own — same resolution strategy packages/vscode's esbuild
// config already relies on) into one self-contained CJS file, so a
// published, `npx`-run MCP server has zero runtime dependency on that
// sibling workspace package being present. @feimacode/open-design-agent-kit-content
// is deliberately left external: it's ~15MB of markdown/JSON *data*, not
// code — env.ts locates it at runtime via `require.resolve` against a real
// installed node_modules entry, which only works if esbuild leaves that
// require call alone rather than trying to bundle a data package's assets
// into the JS output. @modelcontextprotocol/sdk is also left external:
// it's a normal, publishable npm dependency with no TS-source-resolution
// problem, so there's no reason to inline it. (The Claude Desktop extension
// inlines it instead: a .mcpb has no npm install step.)
async function main() {
  await fs.rm('out', { recursive: true, force: true });
  await esbuild.build(serverBuildOptions({ outfile: 'out/index.js', external: [CONTENT_PACKAGE, MCP_SDK_PACKAGE] }));
  // The browser preview's shell and in-page bridge, read at runtime from out/preview/.
  await buildPreviewBundles('out');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
