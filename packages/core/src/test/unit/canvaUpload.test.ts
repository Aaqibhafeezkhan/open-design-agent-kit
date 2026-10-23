import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { isCanvaUploadUrl, uploadToCanva } from '../../generation/canvaUpload';

describe('uploadToCanva (route B, sent by the server)', () => {
  const entryPath = '.open-design/poster/poster.html';
  const filePath = '.open-design/poster/exports/poster.pdf';
  const uploadUrl = 'https://www.canva.com/_blob/upload/ingress/upload/file/agent-tool?token=abc';
  let root: string;

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-canva-upload-'));
    await fs.mkdir(path.join(root, '.open-design/poster/exports'), { recursive: true });
    await fs.writeFile(path.join(root, filePath), Buffer.from('%PDF-1.7 test'));
    await fs.writeFile(path.join(root, '.open-design/secret.txt'), 'secret');
  });

  it('accepts only https canva.com upload URLs', () => {
    assert.ok(isCanvaUploadUrl(uploadUrl));
    assert.ok(isCanvaUploadUrl('https://canva.com/x'));
    assert.ok(!isCanvaUploadUrl('http://www.canva.com/x'));
    assert.ok(!isCanvaUploadUrl('https://canva.com.evil.example/x'));
    assert.ok(!isCanvaUploadUrl('https://evilcanva.com/x'));
    assert.ok(!isCanvaUploadUrl('not a url'));
  });

  it('POSTs the raw bytes as octet-stream and reports the fileId', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ fileId: 'F123' }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await uploadToCanva({ workspaceRoot: root, entryPath, filePath, uploadUrl, fetchImpl });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.fileId, 'F123');
    assert.match(r.text, /Canva \*\*Uploads\*\*[\s\S]*Don't claim a design was created/);
    assert.strictEqual(seen?.url, uploadUrl);
    assert.strictEqual(seen?.init.method, 'POST');
    assert.deepStrictEqual(seen?.init.headers, { 'Content-Type': 'application/octet-stream' });
    assert.strictEqual(Buffer.from(seen?.init.body as Uint8Array).toString(), '%PDF-1.7 test');
  });

  it('refuses files outside the artifact exports folder and non-Canva URLs without sending anything', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    for (const bad of ['.open-design/secret.txt', '.open-design/poster/exports/../../secret.txt', '/etc/passwd']) {
      const r = await uploadToCanva({ workspaceRoot: root, entryPath, filePath: bad, uploadUrl, fetchImpl });
      assert.strictEqual(r.ok, false, bad);
      assert.match(r.text, /Nothing was uploaded/);
    }
    const r = await uploadToCanva({ workspaceRoot: root, entryPath, filePath, uploadUrl: 'https://example.com/upload', fetchImpl });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(called, false);
  });

  it('asks for a fresh URL when Canva refuses or is unreachable', async () => {
    const refused = (async () => new Response('expired', { status: 403 })) as unknown as typeof fetch;
    const r1 = await uploadToCanva({ workspaceRoot: root, entryPath, filePath, uploadUrl, fetchImpl: refused });
    assert.strictEqual(r1.ok, false);
    assert.match(r1.text, /HTTP 403[\s\S]*create-upload-url` again/);
    const offline = (async () => {
      throw new Error('getaddrinfo ENOTFOUND www.canva.com');
    }) as unknown as typeof fetch;
    const r2 = await uploadToCanva({ workspaceRoot: root, entryPath, filePath, uploadUrl, fetchImpl: offline });
    assert.strictEqual(r2.ok, false);
    assert.match(r2.text, /Couldn't reach Canva[\s\S]*route C/);
  });
});
