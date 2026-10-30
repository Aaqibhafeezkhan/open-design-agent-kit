import assert from 'node:assert';
import { test } from 'node:test';
import { checkGallerySiteConfig } from '../gallerySite.mjs';

test('gallery site: an https url ending in "/" and a boolean live pass; anything else fails', () => {
  assert.deepStrictEqual(checkGallerySiteConfig({ url: 'https://feimacode.github.io/open-design-agent-kit/', live: false }), []);
  assert.deepStrictEqual(checkGallerySiteConfig({ url: 'https://gallery.example/', live: true }), []);
  assert.match(checkGallerySiteConfig({ url: 'feimacode.github.io', live: false }).join('\n'), /url must be/);
  assert.match(checkGallerySiteConfig({ url: 'https://feimacode.github.io/kit', live: false }).join('\n'), /url must be/);
  assert.match(checkGallerySiteConfig({ url: 'http://feimacode.github.io/', live: false }).join('\n'), /url must be/);
  assert.match(checkGallerySiteConfig({ url: 'https://feimacode.github.io/', live: 'yes' }).join('\n'), /live must be/);
});
