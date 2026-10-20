// The browser preview's server (openspec add-browser-preview): origin
// separation, tokens, the write allow-list, live events and check runs.
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveCheckRun } from '../../export/checkHistory';
import { startPreviewServer, type PreviewServer } from '../../preview/server/previewServer';
import { PreviewSession, previewModeFromEnv } from '../../preview/server/previewSession';
import { writeArtifactManifest } from '../../vendored/artifactCreate';
import { readArtifactComments, writeArtifactComments, type ArtifactComment } from '../../workspace/artifactComments';

const ENTRY = '.open-design/demo/index.html';

async function makeWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-preview-'));
  await fs.mkdir(path.join(root, '.open-design/demo'), { recursive: true });
  await fs.writeFile(path.join(root, ENTRY), '<!doctype html><html><head><title>Demo</title></head><body><h1>Hi</h1></body></html>');
  await fs.writeFile(path.join(root, 'secret.txt'), 'secret');
  await writeArtifactManifest({ workspaceRoot: root, entryPath: ENTRY, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Demo' } });
  return root;
}

const comment = (id: string): ArtifactComment => ({ id, selector: 'h1', htmlHint: '<h1>', note: 'Bigger', status: 'open', createdAt: '2026-10-19T00:00:00.000Z', updatedAt: '2026-10-19T00:00:00.000Z' });

function rawRequest(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

/** Reads server-sent events until `match` returns true or the timeout passes. */
async function waitForEvent(url: string, trigger: () => Promise<void>, eventName: string, timeoutMs = 4000): Promise<string> {
  const controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Wait for the stream to start before changing anything.
    buffer += decoder.decode((await reader.read()).value);
    await trigger();
    for (;;) {
      const at = buffer.indexOf(`event: ${eventName}\n`);
      if (at !== -1) {
        const end = buffer.indexOf('\n\n', at);
        if (end !== -1) return buffer.slice(at, end);
      }
      const { value, done } = await reader.read();
      if (done) throw new Error(`stream ended without ${eventName}`);
      buffer += decoder.decode(value);
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

describe('preview server', () => {
  let root: string;
  let server: PreviewServer;
  let shellOrigin: string;

  beforeEach(async () => {
    root = await makeWorkspace();
    server = await startPreviewServer({ workspaceRoot: root, assets: { shellJs: '/*shell*/', bridgeJs: 'window.__bridge=1' } });
    shellOrigin = new URL(server.shellBaseUrl).origin;
  });

  afterEach(async () => {
    await server.close();
  });

  it('puts the shell and the design on different origins, each behind a 128-bit token', () => {
    const shell = new URL(server.shellBaseUrl);
    const design = new URL(server.designBaseUrl);
    assert.notStrictEqual(shell.origin, design.origin);
    assert.strictEqual(shell.hostname, '127.0.0.1');
    assert.match(shell.pathname, /^\/[0-9a-f]{32}\/$/);
    assert.match(design.pathname, /^\/[0-9a-f]{32}\/$/);
    assert.notStrictEqual(shell.pathname, design.pathname);
  });

  it('answers 404 without the token and 403 for another Host', async () => {
    assert.strictEqual((await fetch(`${shellOrigin}/`)).status, 404);
    assert.strictEqual((await fetch(`${shellOrigin}/wrong/api/artifacts`)).status, 404);
    assert.strictEqual(await rawRequest(`${server.shellBaseUrl}api/artifacts`, { Host: `evil.example:${new URL(shellOrigin).port}` }), 403);
    assert.strictEqual((await fetch(`${server.shellBaseUrl}api/artifacts`)).status, 200);
  });

  it('serves the shell page with the entry and a CSP framing only the design origin', async () => {
    const res = await fetch(server.urlFor(ENTRY));
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-security-policy') ?? '', new RegExp(`frame-src ${new URL(server.designBaseUrl).origin}`));
    assert.match(await res.text(), /data-od-config=.*demo\/index\.html/);
    assert.strictEqual(await (await fetch(`${server.shellBaseUrl}shell.js`)).text(), '/*shell*/');
  });

  it('serves the design with the bridge injected, never written to disk', async () => {
    const state = (await (await fetch(`${server.shellBaseUrl}api/state?entry=${encodeURIComponent(ENTRY)}`)).json()) as { designUrl: string; title: string; cropSupport: string };
    assert.strictEqual(state.title, 'Demo');
    const html = await (await fetch(state.designUrl)).text();
    assert.match(html, /window\.__bridge=1/);
    assert.doesNotMatch(await fs.readFile(path.join(root, ENTRY), 'utf8'), /__bridge/);
    assert.strictEqual((await fetch(`${server.designBaseUrl}..%2Fsecret.txt`)).status, 403);
    assert.strictEqual((await fetch(`${new URL(server.designBaseUrl).origin}/secret.txt`)).status, 404);
  });

  it('accepts comment writes only from the shell origin', async () => {
    const url = `${server.shellBaseUrl}api/comments?entry=${encodeURIComponent(ENTRY)}`;
    const body = JSON.stringify({ changed: [comment('c-one')], deletedIds: [] });
    const headers = { 'Content-Type': 'application/json' };
    assert.strictEqual((await fetch(url, { method: 'POST', headers, body })).status, 403);
    assert.strictEqual((await fetch(url, { method: 'POST', headers: { ...headers, Origin: new URL(server.designBaseUrl).origin }, body })).status, 403);
    assert.deepStrictEqual(await readArtifactComments(root, ENTRY), []);
    const ok = await fetch(url, { method: 'POST', headers: { ...headers, Origin: shellOrigin }, body });
    assert.strictEqual(ok.status, 200);
    assert.deepStrictEqual((await readArtifactComments(root, ENTRY)).map((c) => c.id), ['c-one']);
  });

  it('refuses entries outside the workspace, unregistered entries and oversized bodies', async () => {
    const post = (entry: string, body: string) =>
      fetch(`${server.shellBaseUrl}api/comments?entry=${encodeURIComponent(entry)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: shellOrigin }, body });
    assert.strictEqual((await post('../outside.html', '{}')).status, 403);
    assert.strictEqual((await post('secret.txt', '{}')).status, 400);
    await fs.writeFile(path.join(root, 'loose.html'), '<p>x</p>');
    assert.strictEqual((await post('loose.html', '{}')).status, 404);
    assert.strictEqual((await post(ENTRY, JSON.stringify({ changed: [{ ...comment('c-big'), note: 'x'.repeat(300 * 1024) }] }))).status, 413);
  });

  it('streams source changes, comment changes and new check runs', async () => {
    const events = `${server.shellBaseUrl}events?entry=${encodeURIComponent(ENTRY)}`;
    await waitForEvent(events, () => fs.writeFile(path.join(root, ENTRY), '<!doctype html><h1>Changed</h1>'), 'source-updated');
    const commentsFrame = await waitForEvent(events, () => writeArtifactComments(root, ENTRY, [comment('c-ext')]), 'comments-updated');
    assert.match(commentsFrame, /c-ext/);
    const checksFrame = await waitForEvent(events, async () => void (await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [], images: [] })), 'checks-updated');
    assert.match(checksFrame, /runId/);
  });

  it('lists registered artifacts and check runs', async () => {
    await saveCheckRun(root, '.open-design', ENTRY, { mode: 'page', findings: [{ severity: 'error', check: 'x', message: 'm' }], images: [{ label: 'desktop', data: Buffer.from('jpg'), width: 1, height: 1 }] });
    const { artifacts } = (await (await fetch(`${server.shellBaseUrl}api/artifacts`)).json()) as { artifacts: { entryPath: string }[] };
    assert.deepStrictEqual(artifacts.map((a) => a.entryPath), [ENTRY]);
    const { runs } = (await (await fetch(`${server.shellBaseUrl}api/checks?entry=${encodeURIComponent(ENTRY)}`)).json()) as { runs: { id: string; errors: number; images: { file: string }[] }[] };
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0].errors, 1);
    const img = await fetch(`${server.shellBaseUrl}api/check-image?entry=${encodeURIComponent(ENTRY)}&run=${runs[0].id}&file=${runs[0].images[0].file}`);
    assert.strictEqual(await img.text(), 'jpg');
    assert.strictEqual((await fetch(`${server.shellBaseUrl}api/check-image?entry=${encodeURIComponent(ENTRY)}&run=${runs[0].id}&file=..%2Frun.json`)).status, 404);
  });
});

describe('preview session', () => {
  it('reads the preview mode from the environment', () => {
    assert.strictEqual(previewModeFromEnv({}), 'manual');
    assert.strictEqual(previewModeFromEnv({ OPEN_DESIGN_PREVIEW: 'AUTO' }), 'auto');
    assert.strictEqual(previewModeFromEnv({ OPEN_DESIGN_PREVIEW: 'off' }), 'off');
  });

  it('starts one server, reports how it opened, and reuses a driven window', async () => {
    const root = await makeWorkspace();
    const navigated: string[] = [];
    let opens = 0;
    const session = new PreviewSession({
      workspaceRoot: root,
      openWindow: async () => {
        opens++;
        return {
          how: 'app-window',
          browserPath: '/fake',
          window: { page: undefined as never, navigate: async (u) => void navigated.push(u), focus: async () => undefined, close: async () => undefined, isOpen: () => true },
        };
      },
    });
    try {
      const first = await session.open(ENTRY);
      assert.strictEqual(first.how, 'app-window');
      assert.ok(!first.reused);
      const second = await session.open(undefined);
      assert.strictEqual(second.how, 'app-window');
      assert.strictEqual(second.reused, true);
      assert.strictEqual(opens, 1);
      assert.deepStrictEqual(navigated, [second.url]);
      assert.strictEqual(new URL(first.url).origin, new URL(second.url).origin);
    } finally {
      await session.close();
    }
  });

  it('returns the URL when nothing could be opened', async () => {
    const root = await makeWorkspace();
    const session = new PreviewSession({ workspaceRoot: root, openWindow: async () => ({ how: 'not-opened', reason: 'No display.' }) });
    try {
      const outcome = await session.open(ENTRY);
      assert.strictEqual(outcome.how, 'not-opened');
      assert.strictEqual(outcome.note, 'No display.');
      assert.match(outcome.url, /^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{32}\/\?entry=/);
    } finally {
      await session.close();
    }
  });
});
