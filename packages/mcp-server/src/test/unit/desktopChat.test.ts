// The real server over stdio as Claude Desktop starts it (openspec
// add-desktop-extension-bundle, add-folderless-chat-support): the desktop
// extension's default folder and lock, the plugin's server deferring to it,
// and a chat with no folder writing through the managed workspace.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ToolListChangedNotificationSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { extensionLockPath } from '../../extensionLock';

const SERVER = path.join(__dirname, '..', '..', 'index.ts');
const FOLDERLESS = ['use_open_design_managed_workspace', 'write_open_design_file'];

const tmp = (prefix: string) => fs.mkdtemp(path.join(os.tmpdir(), prefix));

async function connect(options: { cwd: string; env: Record<string, string>; clientName?: string }): Promise<Client> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('OPEN_DESIGN_')) env[k] = v;
  const client = new Client({ name: options.clientName ?? 'claude-ai', version: '1.0.0' }, { capabilities: {} });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--require', require.resolve('tsx/cjs'), SERVER],
      cwd: options.cwd,
      env: { ...env, OPEN_DESIGN_PREVIEW: 'off', ...options.env },
      stderr: 'ignore',
    }),
  );
  return client;
}

const texts = (result: unknown): string[] =>
  ((result as CallToolResult).content ?? []).filter((c): c is { type: 'text'; text: string } => c.type === 'text').map((c) => c.text);
const text = (result: unknown): string => texts(result).join('\n');
const names = async (client: Client) => (await client.listTools()).tools.map((t) => t.name);

describe('Claude Desktop chats over MCP', function () {
  this.timeout(60000);

  describe('a chat with no folder (home folder, no roots)', () => {
    let home: string;
    let client: Client;
    before(async () => {
      home = await tmp('od-home-');
      client = await connect({ cwd: home, env: { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config') } });
    });
    after(() => client?.close());

    it('lists the managed-workspace tools and names them in the guard', async () => {
      const listed = await names(client);
      for (const name of FOLDERLESS) assert.ok(listed.includes(name), name);
      const refused = await client.callTool({ name: 'prepare_open_design_brief', arguments: { skillId: 'od:prototype:x', brief: 'b' } });
      assert.strictEqual(refused.isError, true);
      assert.match(text(refused), /set_open_design_workspace/);
      assert.match(text(refused), /use_open_design_managed_workspace/);
    });

    it('refuses the write tool until a managed workspace is open', async () => {
      const refused = await client.callTool({ name: 'write_open_design_file', arguments: { path: '.open-design/p/p.html', content: 'x' } });
      assert.strictEqual(refused.isError, true);
      assert.match(text(refused), /your own file tools/);
    });

    it('writes, registers and hands over a page to publish in ~/Open Design/<name>/', async () => {
      const opened = await client.callTool({ name: 'use_open_design_managed_workspace', arguments: { name: 'Coffee poster' } });
      const root = path.join(home, 'Open Design', 'coffee-poster');
      assert.ok(!opened.isError, text(opened));
      assert.match(text(opened), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

      const html = '<!doctype html><html><head><title>Coffee poster</title></head><body><h1>Coffee ☕</h1></body></html>\n';
      const written = await client.callTool({ name: 'write_open_design_file', arguments: { path: '.open-design/coffee-poster/coffee-poster.html', content: html } });
      assert.ok(!written.isError, text(written));
      assert.strictEqual(await fs.readFile(path.join(root, '.open-design', 'coffee-poster', 'coffee-poster.html'), 'utf8'), html);

      const sidecar = await client.callTool({ name: 'write_open_design_file', arguments: { path: '.open-design/coffee-poster/coffee-poster.html.artifact.json', content: '{}' } });
      assert.strictEqual(sidecar.isError, true);

      const registered = await client.callTool({ name: 'register_open_design_artifact', arguments: { entryPath: '.open-design/coffee-poster/coffee-poster.html', kind: 'html', title: 'Coffee poster' } });
      assert.match(text(registered), /Artifact registered/);
      assert.doesNotMatch(text(registered), /Artifact preview: if you have an Artifact tool/);

      const published = await client.callTool({ name: 'publish_open_design_artifact', arguments: { entryPath: '.open-design/coffee-poster/coffee-poster.html', provider: 'claude-artifact' } });
      const [instructions, page] = texts(published);
      assert.match(instructions, /second text item/);
      assert.doesNotMatch(instructions, /Call your Artifact tool with the file's path/);
      assert.match(page, /<h1>Coffee ☕<\/h1>/);
    });
  });

  describe('a project folder (Claude Code)', () => {
    let client: Client;
    let project: string;
    before(async () => {
      const home = await tmp('od-home-');
      project = await tmp('od-project-');
      client = await connect({ cwd: project, clientName: 'claude-code', env: { HOME: home, USERPROFILE: home } });
    });
    after(() => client?.close());

    it('lists neither managed-workspace tool and refuses the write', async () => {
      const listed = await names(client);
      for (const name of FOLDERLESS) assert.ok(!listed.includes(name), name);
      const refused = await client.callTool({ name: 'write_open_design_file', arguments: { path: '.open-design/p/p.html', content: 'x' } });
      assert.strictEqual(refused.isError, true);
      await assert.rejects(fs.access(path.join(project, '.open-design', 'p', 'p.html')));
    });
  });

  describe('the desktop extension', () => {
    let client: Client;
    let configHome: string;
    let designs: string;
    before(async () => {
      const home = await tmp('od-home-');
      configHome = path.join(home, '.config');
      designs = await tmp('od-designs-');
      client = await connect({
        cwd: home,
        env: { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: configHome, OPEN_DESIGN_HOST: 'claude-desktop-extension', OPEN_DESIGN_DEFAULT_WORKSPACE: designs, OPEN_DESIGN_FIGMA_TOKEN: '${user_config.figma_token}' },
      });
    });
    after(() => client?.close());

    it('reports the package version and holds the lock', async () => {
      const { version } = JSON.parse(await fs.readFile(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'));
      assert.strictEqual(client.getServerVersion()?.version, version);
      const lock = JSON.parse(await fs.readFile(extensionLockPath({ XDG_CONFIG_HOME: configHome } as NodeJS.ProcessEnv), 'utf8'));
      assert.strictEqual(typeof lock.pid, 'number');
      assert.strictEqual(lock.version, version);
    });

    it('guards the default folder, names it, and writes nothing until a folder is set', async () => {
      const refused = await client.callTool({ name: 'prepare_open_design_brief', arguments: { skillId: 'od:prototype:x', brief: 'b' } });
      assert.strictEqual(refused.isError, true);
      assert.ok(text(refused).includes(designs), text(refused));
      assert.match(text(refused), /set_open_design_workspace/);
      assert.deepStrictEqual(await fs.readdir(designs), []);
    });

    it('lets a connected folder win over the default', async () => {
      const connected = await tmp('od-connected-');
      await client.callTool({ name: 'set_open_design_workspace', arguments: { path: connected } });
      await client.callTool({ name: 'set_active_design_system', arguments: { designSystemId: 'stripe' } });
      await fs.access(path.join(connected, '.open-design', 'config.json'));
      assert.deepStrictEqual(await fs.readdir(designs), []);
    });
  });

  describe('the plugin\'s server while the extension runs', () => {
    let lockDir: string;
    const lockFile = () => extensionLockPath({ XDG_CONFIG_HOME: lockDir } as NodeJS.ProcessEnv);
    const writeLock = () => fs.writeFile(lockFile(), JSON.stringify({ pid: process.pid, version: '9.9.9', startedAt: new Date().toISOString() }));
    let project: string;

    before(async () => {
      lockDir = await tmp('od-config-');
      project = await tmp('od-project-');
      await fs.mkdir(path.join(lockDir, 'open-design'), { recursive: true });
    });

    it('lists no tools for Desktop and refuses calls, naming the extension', async () => {
      await writeLock();
      const client = await connect({ cwd: project, env: { XDG_CONFIG_HOME: lockDir, OPEN_DESIGN_LAUNCHER: 'claude-plugin' } });
      try {
        assert.deepStrictEqual(await names(client), []);
        const refused = await client.callTool({ name: 'list_open_design_skills', arguments: {} });
        assert.strictEqual(refused.isError, true);
        assert.match(text(refused), /desktop extension/);
      } finally {
        await client.close();
      }
    });

    it('keeps every tool for Claude Code', async () => {
      await writeLock();
      const client = await connect({ cwd: project, clientName: 'claude-code', env: { XDG_CONFIG_HOME: lockDir, OPEN_DESIGN_LAUNCHER: 'claude-plugin' } });
      try {
        assert.ok((await names(client)).includes('list_open_design_skills'));
      } finally {
        await client.close();
      }
    });

    it('takes its tools back, with tools/list_changed, when the extension stops', async () => {
      await writeLock();
      const client = await connect({ cwd: project, env: { XDG_CONFIG_HOME: lockDir, OPEN_DESIGN_LAUNCHER: 'claude-plugin' } });
      try {
        assert.deepStrictEqual(await names(client), []);
        const changed = new Promise<void>((resolve) => client.setNotificationHandler(ToolListChangedNotificationSchema, async () => resolve()));
        await fs.unlink(lockFile());
        await changed;
        assert.ok((await names(client)).includes('list_open_design_skills'));
      } finally {
        await client.close();
      }
    });

    it('ignores a lock left by a crashed extension', async () => {
      await fs.writeFile(lockFile(), JSON.stringify({ pid: 2 ** 22 + 12345, version: '9.9.9', startedAt: 'then' }));
      const client = await connect({ cwd: project, env: { XDG_CONFIG_HOME: lockDir, OPEN_DESIGN_LAUNCHER: 'claude-plugin' } });
      try {
        assert.ok((await names(client)).includes('list_open_design_skills'));
      } finally {
        await client.close();
      }
    });
  });
});
