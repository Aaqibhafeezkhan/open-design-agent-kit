// Opening the browser preview and cropping comment screenshots (openspec
// add-browser-preview, D1 and D5).
import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import { findBrowser } from '../../export/browserDiscovery';
import { captureRerenderedCrop, cropClip, MAX_CROP_EDGE } from '../../preview/server/captureCrop';
import { defaultOpeners, openPreviewWindow, type PreviewWindow } from '../../preview/server/openPreviewWindow';

const fakeWindow: PreviewWindow = { page: undefined as never, navigate: async () => undefined, focus: async () => undefined, close: async () => undefined, isOpen: () => true };

async function fakeBrowserEnv(): Promise<NodeJS.ProcessEnv> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'od-fake-browser-'));
  const exe = path.join(dir, 'chrome');
  await fs.writeFile(exe, '');
  return { OPEN_DESIGN_BROWSER_PATH: exe };
}

describe('preview window', () => {
  it('opens an app window when a browser is found', async () => {
    const env = await fakeBrowserEnv();
    const result = await openPreviewWindow('http://127.0.0.1:1/t/', { env, launchAppWindow: async () => fakeWindow, openDefault: async () => assert.fail('not used') });
    assert.strictEqual(result.how, 'app-window');
  });

  it('falls back to the default browser when the window fails, saying why', async () => {
    const env = await fakeBrowserEnv();
    const result = await openPreviewWindow('http://127.0.0.1:1/t/', {
      env,
      launchAppWindow: async () => {
        throw new Error('Missing X server');
      },
      openDefault: async () => true,
    });
    assert.strictEqual(result.how, 'default-browser');
    assert.match(result.how === 'default-browser' ? result.note : '', /Missing X server/);
  });

  it('skips the app window when OPEN_DESIGN_PREVIEW_BROWSER is default', async () => {
    const env = { ...(await fakeBrowserEnv()), OPEN_DESIGN_PREVIEW_BROWSER: 'default' };
    const result = await openPreviewWindow('http://127.0.0.1:1/t/', { env, launchAppWindow: async () => assert.fail('not used'), openDefault: async () => true });
    assert.strictEqual(result.how, 'default-browser');
  });

  it('returns not-opened when nothing can open it', async () => {
    const result = await openPreviewWindow('http://127.0.0.1:1/t/', { env: { OPEN_DESIGN_PREVIEW_BROWSER: 'default' }, openDefault: async () => false });
    assert.strictEqual(result.how, 'not-opened');
  });

  it('picks the default-browser opener per platform, including WSL, and none without a display', () => {
    const url = 'http://127.0.0.1:1/t/?entry=a';
    assert.deepStrictEqual(defaultOpeners(url, {}, 'darwin'), [['open', [url]]]);
    assert.deepStrictEqual(defaultOpeners(url, {}, 'win32'), [['cmd', ['/c', 'start', '', url]]]);
    assert.deepStrictEqual(defaultOpeners(url, { WSL_DISTRO_NAME: 'Ubuntu' }, 'linux').map(([c]) => c), ['wslview', 'cmd.exe']);
    assert.deepStrictEqual(defaultOpeners(url, { DISPLAY: ':0' }, 'linux'), [['xdg-open', [url]]]);
    assert.deepStrictEqual(defaultOpeners(url, {}, 'linux'), []);
  });
});

describe('comment crops', () => {
  it('adds context, clamps to the stage and caps the long edge', () => {
    assert.deepStrictEqual(cropClip({ x: 100, y: 100, width: 50, height: 20 }, { x: 0, y: 0, width: 1000, height: 1000 }), { x: 76, y: 76, width: 98, height: 68, scale: 1 });
    const clamped = cropClip({ x: 5, y: 5, width: 50, height: 20 }, { x: 0, y: 44, width: 1000, height: 1000 })!;
    assert.strictEqual(clamped.y, 44);
    const big = cropClip({ x: 0, y: 0, width: 2000, height: 400 }, { x: 0, y: 0, width: 4000, height: 4000 })!;
    assert.ok(Math.max(big.width, big.height) * big.scale <= MAX_CROP_EDGE + 0.001);
    assert.strictEqual(cropClip({ x: 5000, y: 5000, width: 10, height: 10 }, { x: 0, y: 0, width: 100, height: 100 }), undefined);
  });

  it('re-renders the entry headless and crops the element (real browser)', async function () {
    if (!(await findBrowser()).ok) this.skip();
    this.timeout(30000);
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-crop-'));
    await fs.writeFile(path.join(root, 'page.html'), '<!doctype html><body style="margin:0;background:#fff"><div style="height:1200px"></div><div id="x" style="width:100px;height:40px;background:#f00"></div><div style="height:200px"></div></body>');
    const png = await captureRerenderedCrop({ workspaceRoot: root, entryPath: 'page.html', docRect: { x: 0, y: 1200, width: 100, height: 40 }, viewport: { width: 800, height: 600 } });
    assert.ok(png);
    const image = PNG.sync.read(png!);
    assert.strictEqual(image.width, 124);
    assert.strictEqual(image.height, 88);
    // The element's centre is red: the crop came from below the first screen.
    const i = (image.width * 44 + 50) * 4;
    assert.deepStrictEqual([image.data[i], image.data[i + 1], image.data[i + 2]], [255, 0, 0]);
  });
});
