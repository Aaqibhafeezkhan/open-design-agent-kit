#!/usr/bin/env node
// Smoke test for the Claude Desktop extension (openspec
// add-desktop-extension-bundle): unzips the .mcpb into a temp folder outside
// this checkout, checks its manifest and size, then starts the bundled server
// with plain Node, the way Claude Desktop does, and completes an MCP
// initialize + tools/list handshake. Proves the bundle runs with no repo
// node_modules, no npx and no network.
//
// Usage: node scripts/test-mcpb.mjs <file.mcpb> [--version <x.y.z>]
// The version defaults to packages/mcp-server/package.json's.
import { execFileSync, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 40 * 1024 * 1024;
const REQUIRED_TOOLS = ['list_open_design_skills', 'set_open_design_workspace', 'prepare_open_design_brief', 'register_open_design_artifact', 'use_open_design_managed_workspace', 'write_open_design_file'];

function log(msg) {
  console.log(`[test-mcpb] ${msg}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

/** Starts the server and returns a request function for newline-delimited JSON-RPC over stdio. */
function startServer(entry, options) {
  const child = spawn(process.execPath, [entry], { ...options, stdio: ['pipe', 'pipe', 'inherit'] });
  const results = [];
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        results.push(JSON.parse(line));
      } catch {
        // Non-JSON stdout noise.
      }
    }
  });
  let nextId = 1;
  const notify = (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  const request = async (method, params, timeoutMs = 20000) => {
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = results.find((r) => r.id === id);
      if (found) return found;
      if (child.exitCode !== null) throw new Error(`the server exited with code ${child.exitCode}`);
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`no response to ${method} within ${timeoutMs}ms`);
  };
  return { child, request, notify };
}

async function main() {
  const argv = process.argv.slice(2);
  const file = argv[0] && path.resolve(argv[0]);
  assert(file, 'usage: node scripts/test-mcpb.mjs <file.mcpb> [--version <x.y.z>]');
  const versionFlag = argv.indexOf('--version');
  const expectedVersion =
    versionFlag !== -1 ? argv[versionFlag + 1] : JSON.parse(await fs.readFile(path.join(repoRoot, 'packages', 'mcp-server', 'package.json'), 'utf8')).version;

  const { size } = await fs.stat(file);
  assert(size <= MAX_BYTES, `${path.basename(file)} is ${(size / 1024 / 1024).toFixed(1)} MB, over the ${MAX_BYTES / 1024 / 1024} MB limit: something outside the server and content was packed`);
  log(`size ${(size / 1024 / 1024).toFixed(1)} MB`);

  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'od-mcpb-test-'));
  let server;
  try {
    const unpacked = path.join(scratch, 'extension');
    execFileSync('unzip', ['-q', file, '-d', unpacked], { stdio: 'inherit' });
    const manifest = JSON.parse(await fs.readFile(path.join(unpacked, 'manifest.json'), 'utf8'));
    assert(manifest.name === 'open-design', `manifest name is ${manifest.name}, not open-design`);
    assert(manifest.version === expectedVersion, `manifest version is ${manifest.version}, not ${expectedVersion}`);
    assert(manifest.server?.type === 'node', 'manifest server.type is not node');
    log(`manifest ${manifest.name}@${manifest.version} OK`);

    const home = path.join(scratch, 'home');
    const designs = path.join(scratch, 'Designs');
    const connected = path.join(scratch, 'connected');
    await Promise.all([home, designs, connected].map((d) => fs.mkdir(d, { recursive: true })));
    const env = {
      PATH: process.env.PATH ?? '',
      HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: path.join(home, '.config'),
      OPEN_DESIGN_HOST: 'claude-desktop-extension',
      OPEN_DESIGN_DEFAULT_WORKSPACE: designs,
      OPEN_DESIGN_FIGMA_TOKEN: '${user_config.figma_token}',
      OPEN_DESIGN_PREVIEW: 'off',
    };
    server = startServer(path.join(unpacked, 'server', 'out', 'index.js'), { cwd: home, env });

    const init = await server.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'claude-ai', version: '0' } });
    assert(init.result?.serverInfo?.name === 'open-design', `unexpected serverInfo: ${JSON.stringify(init)}`);
    assert(init.result.serverInfo.version === expectedVersion, `serverInfo version is ${init.result.serverInfo.version}, not ${expectedVersion}`);
    server.notify('notifications/initialized');

    const list = await server.request('tools/list', {});
    const names = (list.result?.tools ?? []).map((t) => t.name);
    const missing = REQUIRED_TOOLS.filter((n) => !names.includes(n));
    assert(missing.length === 0, `tools/list is missing ${missing.join(', ')}`);
    log(`tools/list OK (${names.length} tools)`);

    const lock = JSON.parse(await fs.readFile(path.join(env.XDG_CONFIG_HOME, 'open-design', 'desktop-extension.lock'), 'utf8'));
    assert(lock.pid === server.child.pid, 'the extension did not hold its lock file');

    // The vendored content resolves from the bundle's own node_modules.
    await server.request('tools/call', { name: 'set_open_design_workspace', arguments: { path: connected } });
    const skills = await server.request('tools/call', { name: 'list_open_design_skills', arguments: { query: 'landing' } });
    const parsed = JSON.parse(skills.result?.content?.[0]?.text ?? 'null');
    assert(Array.isArray(parsed) && parsed.length > 0, `list_open_design_skills returned no entries: ${JSON.stringify(skills).slice(0, 500)}`);
    log(`list_open_design_skills OK (${parsed.length} entries for "landing")`);
  } finally {
    server?.child.kill();
    await fs.rm(scratch, { recursive: true, force: true });
  }
  log('OK');
}

main().catch((err) => {
  console.error(`[test-mcpb] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
