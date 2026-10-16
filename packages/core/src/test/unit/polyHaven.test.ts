import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { filesFor, find3dAssets, formatFound3dAssets, listingCache, POLY_HAVEN_CREDIT, POLY_HAVEN_USER_AGENT, rankListing } from '../../assets/polyHaven';

// Trimmed copies of real api.polyhaven.com responses (recorded 2026-10-16).
// Tests compile to out/test/unit; the JSON stays in src.
const FIXTURES = path.resolve(__dirname, '../../../src/test/fixtures/polyhaven');
const fixture = (name: string): unknown => JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

/** A fetch that serves the fixtures and records every URL and User-Agent. */
function fakeFetch(calls: Array<{ url: string; ua?: string }>, fail?: Error) {
  return async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, ua: init?.headers?.['User-Agent'] });
    if (fail) throw fail;
    const list = /\/assets\?type=(\w+)$/.exec(url);
    const files = /\/files\/(.+)$/.exec(url);
    const name = list ? `assets-${list[1]}` : files ? `files-${decodeURIComponent(files[1])}` : '';
    let body: unknown;
    try {
      body = fixture(name);
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => body };
  };
}

describe('Poly Haven asset search', () => {
  beforeEach(() => listingCache.clear());

  it('ranks listing entries by matched terms, then downloads', () => {
    const entries = fixture('assets-models') as Parameters<typeof rankListing>[0];
    const ids = rankListing(entries, 'brass lantern', 5);
    assert.ok(ids.length >= 2);
    assert.ok(['Lantern_01', 'brass_diya_lantern'].includes(ids[0]), ids.join(','));
    assert.deepStrictEqual(rankListing(entries, 'spaceship', 5), []);
    // Whole words only: a collection like "smugglers_cove" must not match "mug".
    const fake = { fern_02: { name: 'Fern 02', tags: ['plant'], categories: ['plants', 'collection: smugglers_cove'] }, mug_01: { name: 'Mug 01', tags: ['cup'], categories: ['kitchen'] } };
    assert.deepStrictEqual(rankListing(fake, 'mug', 5), ['mug_01']);
    assert.deepStrictEqual(rankListing(fake, 'plant', 5), ['fern_02'], 'plurals match');
    assert.deepStrictEqual(rankListing(entries, '  ', 5), []);
  });

  it('picks the files a page needs per type and resolution', () => {
    const hdri = filesFor('hdri', fixture('files-studio_small_09') as never, '1k')!;
    assert.match(hdri.files.hdr.url, /^https:\/\/dl\.polyhaven\.org\/.+studio_small_09_1k\.hdr$/);
    const tex = filesFor('texture', fixture('files-cobblestone_floor_08') as never, '2k')!;
    assert.deepStrictEqual(Object.keys(tex.files).sort(), ['arm', 'diffuse', 'normal', 'roughness']);
    assert.match(tex.files.normal.url, /nor_gl_2k\.jpg$/);
    const model = filesFor('model', fixture('files-Lantern_01') as never, '1k')!;
    assert.match(model.files.gltf.url, /Lantern_01_1k\.gltf$/);
    assert.ok(model.includes && model.includes['Lantern_01.bin'], 'the .bin is mapped');
    assert.ok(Object.keys(model.includes!).some((rel) => rel.startsWith('textures/')), 'textures are mapped by their relative path');
    assert.strictEqual(filesFor('hdri', {}, '1k'), undefined);
  });

  it('searches with the kit User-Agent, returns CC0 assets with the credit, and caches the list', async () => {
    const calls: Array<{ url: string; ua?: string }> = [];
    const fetchImpl = fakeFetch(calls);
    const first = await find3dAssets({ query: 'lantern', type: 'model', limit: 1 }, fetchImpl);
    assert.ok(first.ok, JSON.stringify(first));
    if (!first.ok) return;
    assert.strictEqual(first.assets.length, 1);
    const a = first.assets[0];
    assert.strictEqual(a.license, 'CC0');
    assert.strictEqual(first.credit, POLY_HAVEN_CREDIT);
    assert.ok(a.dimensionsM && a.dimensionsM.every((m) => m > 0 && m < 2), `meters: ${a.dimensionsM}`);
    assert.ok(a.polycount && a.polycount > 0, 'models report their polycount');
    assert.match(formatFound3dAssets(first), /polygons \(up to ~[\d,]+ triangles\)/);
    assert.ok(calls.every((c) => c.ua === POLY_HAVEN_USER_AGENT));
    await find3dAssets({ query: 'chair', type: 'model', limit: 1 }, fetchImpl);
    assert.strictEqual(calls.filter((c) => c.url.includes('/assets?type=models')).length, 1, 'model list fetched once');
    const text = formatFound3dAssets(first);
    assert.match(text, /CC0/);
    assert.match(text, /Powered by Poly Haven/);
    assert.match(text, /setURLModifier/);
  });

  it('says so when nothing matches, and fails soft when offline', async () => {
    const none = await find3dAssets({ query: 'spaceship', type: 'texture' }, fakeFetch([]));
    assert.ok(none.ok && none.assets.length === 0);
    assert.match(formatFound3dAssets(none), /No Poly Haven textures match "spaceship"\. Try broader/);
    const offline = await find3dAssets({ query: 'sunset', type: 'hdri' }, fakeFetch([], new Error('getaddrinfo ENOTFOUND api.polyhaven.com')));
    assert.ok(!offline.ok);
    assert.match(formatFound3dAssets(offline), /Couldn't reach Poly Haven.*Fall back to procedural/);
    // A failed list isn't cached: the next call fetches again.
    const calls: Array<{ url: string }> = [];
    await find3dAssets({ query: 'studio', type: 'hdri' }, fakeFetch(calls));
    assert.ok(calls.some((c) => c.url.includes('/assets?type=hdris')));
  });

  it('rejects a missing query or an unknown type without a network call', async () => {
    const calls: Array<{ url: string }> = [];
    assert.ok(!(await find3dAssets({ query: '', type: 'model' }, fakeFetch(calls))).ok);
    assert.ok(!(await find3dAssets({ query: 'x', type: 'video' as never }, fakeFetch(calls))).ok);
    assert.strictEqual(calls.length, 0);
  });
});
