import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describeOutcome, parsePreviewPort, runPreview } from '../../previewCommand';

async function workspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-cli-preview-'));
  await fs.mkdir(path.join(root, '.open-design', 'landing'), { recursive: true });
  return root;
}

describe('preview command', () => {
  it('parses --port', () => {
    assert.strictEqual(parsePreviewPort(undefined), undefined);
    assert.strictEqual(parsePreviewPort('4321'), 4321);
    assert.throws(() => parsePreviewPort('0'), /--port/);
    assert.throws(() => parsePreviewPort('abc'), /--port/);
  });

  it('opens the entry relative to the workspace, prints the URL, and closes on stop', async () => {
    const root = await workspace();
    const calls: Array<{ entry?: string; open: boolean }> = [];
    let closed = false;
    let workspaceRoot = '';
    const out: string[] = [];
    const err: string[] = [];
    const code = await runPreview(path.join(root, '.open-design', 'landing', 'index.html'), { open: false }, path.join(root, '.open-design'), {
      createSession: (o) => {
        workspaceRoot = o.workspaceRoot;
        return {
          open: async (entry, open = true) => {
            calls.push({ entry, open });
            return { url: 'http://127.0.0.1:1/t/?entry=x', how: 'not-opened' };
          },
          close: async () => {
            closed = true;
          },
        };
      },
      untilStopped: async () => undefined,
      out: (l) => out.push(l),
      err: (l) => err.push(l),
    });
    assert.strictEqual(code, 0);
    assert.strictEqual(workspaceRoot, root);
    assert.deepStrictEqual(calls, [{ entry: '.open-design/landing/index.html', open: false }]);
    assert.deepStrictEqual(out, ['http://127.0.0.1:1/t/?entry=x']);
    assert.match(err.join('\n'), /Open the URL above in a browser\..*Ctrl-C/s);
    assert.ok(closed);
  });

  it('shows the list of designs without an entry, finding the workspace from the current directory', async () => {
    const root = await workspace();
    let entry: string | undefined = 'unset';
    let workspaceRoot = '';
    let rootRedirect: boolean | undefined;
    await runPreview(undefined, { rootRedirect: true }, root, {
      createSession: (o) => {
        workspaceRoot = o.workspaceRoot;
        rootRedirect = o.rootRedirect;
        return { open: async (e) => ((entry = e), { url: 'u', how: 'app-window' }), close: async () => undefined };
      },
      untilStopped: async () => undefined,
      out: () => undefined,
      err: () => undefined,
    });
    assert.strictEqual(entry, undefined);
    assert.strictEqual(workspaceRoot, root);
    assert.strictEqual(rootRedirect, true);
  });

  it('describes each way it opened', () => {
    assert.match(describeOutcome({ url: 'u', how: 'app-window' }), /^Opened in a browser window\./);
    assert.match(describeOutcome({ url: 'u', how: 'default-browser', note: 'No Chrome found.' }), /default browser\. No Chrome found\./);
    assert.match(describeOutcome({ url: 'u', how: 'not-opened', note: 'No display.' }), /^Not opened: No display\./);
  });
});
