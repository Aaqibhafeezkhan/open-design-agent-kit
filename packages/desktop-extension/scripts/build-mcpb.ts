// Builds the Claude Desktop extension, open-design-<version>.mcpb
// (openspec add-desktop-extension-bundle):
//   1. the MCP server bundled with the same esbuild options as the npm
//      package, except that @modelcontextprotocol/sdk is inlined (a .mcpb has
//      no npm install step), plus the browser preview bundles;
//   2. the content package, extracted from the content tarball built in the
//      same release run (it isn't on npm yet then, and has no dependencies);
//   3. the plugin's icon and manifest.json, rendered with the server's version;
//   4. `mcpb validate` and `mcpb pack` from the pinned devDependency.
// Nothing is fetched from the network.
//
// Usage (run through tsx, which the server's build config needs). A .ts file,
// so tsx runs it as CommonJS: on Node 20 an .mjs importing serverBuild.ts gave
// that module a data: URL for __dirname and broke the entry point path.
//
//   npm run build --workspace=packages/desktop-extension -- --content <content.tgz> --out <file.mcpb>
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import { buildPreviewBundles } from '../../core/build/previewBundles';
import { CONTENT_PACKAGE, serverBuildOptions } from '../../mcp-server/serverBuild';

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const mcpb = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'mcpb.cmd' : 'mcpb');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag !== '--content' && flag !== '--out') throw new Error(`Unknown argument ${flag}`);
    if (!argv[i + 1]) throw new Error(`${flag} needs a value`);
    args[flag.slice(2)] = path.resolve(argv[++i]);
  }
  if (!args.content) throw new Error('--content <tgz> is required: the content package tarball (npm pack --workspace=packages/content)');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { version } = JSON.parse(await fs.readFile(path.join(repoRoot, 'packages', 'mcp-server', 'package.json'), 'utf8'));
  const out = args.out ?? path.join(repoRoot, 'release', `open-design-${version}.mcpb`);
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'od-mcpb-'));
  try {
    const serverOut = path.join(stage, 'server', 'out');
    await esbuild.build(serverBuildOptions({ outfile: path.join(serverOut, 'index.js'), external: [CONTENT_PACKAGE] }));
    await buildPreviewBundles(serverOut);

    const unpacked = path.join(stage, '.content');
    await fs.mkdir(unpacked);
    execFileSync('tar', ['-xzf', args.content, '-C', unpacked], { stdio: 'inherit' });
    const contentPackage = JSON.parse(await fs.readFile(path.join(unpacked, 'package', 'package.json'), 'utf8'));
    if (contentPackage.name !== CONTENT_PACKAGE) throw new Error(`${args.content} is ${contentPackage.name}, not ${CONTENT_PACKAGE}`);
    if (contentPackage.version !== version) throw new Error(`${args.content} is version ${contentPackage.version}; the server is ${version}`);
    const contentDest = path.join(stage, 'server', 'node_modules', ...CONTENT_PACKAGE.split('/'));
    await fs.mkdir(path.dirname(contentDest), { recursive: true });
    await fs.rename(path.join(unpacked, 'package'), contentDest);
    await fs.rm(unpacked, { recursive: true });

    await fs.copyFile(path.join(repoRoot, 'packages', 'claude-plugin', '.claude-plugin', 'icon.png'), path.join(stage, 'icon.png'));
    const template = await fs.readFile(path.join(packageRoot, 'manifest.template.json'), 'utf8');
    await fs.writeFile(path.join(stage, 'manifest.json'), template.replace('"${VERSION}"', JSON.stringify(version)));

    execFileSync(mcpb, ['validate', path.join(stage, 'manifest.json')], { stdio: 'inherit' });
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.rm(out, { force: true });
    execFileSync(mcpb, ['pack', stage, out], { stdio: 'inherit' });
    console.log(`Built ${out}`);
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
