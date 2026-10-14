import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { startStaticServer } from '../../export/staticServer';

describe('static server', () => {
  it('requires the path token on every request when one is set', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-token-'));
    await fs.writeFile(path.join(root, 'a.html'), 'hello');
    const server = await startStaticServer(root, { pathToken: 'secret123' });
    try {
      assert.match(server.baseUrl, /^http:\/\/127\.0\.0\.1:\d+\/secret123\/$/);
      assert.strictEqual(await (await fetch(`${server.baseUrl}a.html`)).text(), 'hello');
      const origin = server.baseUrl.replace(/secret123\/$/, '');
      assert.strictEqual((await fetch(`${origin}a.html`)).status, 404);
      assert.strictEqual((await fetch(`${origin}wrong/a.html`)).status, 404);
      assert.strictEqual((await fetch(`${server.baseUrl}..%2F..%2Fetc%2Fpasswd`)).status, 403);
    } finally {
      await server.close();
    }
  });
});
