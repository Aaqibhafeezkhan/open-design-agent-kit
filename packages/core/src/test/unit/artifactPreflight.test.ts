import * as assert from 'node:assert';
import { artifactPreflight, findRemoteReferences, isAllowedInArtifact } from '../../export/artifactPreflight';

const page = (head: string, body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const blocked = (html: string, embeddedUrls?: string[]) =>
  artifactPreflight({ html, embeddedUrls }).findings.filter((f) => f.code === 'artifact-blocked-host').map((f) => f.url);

describe('artifactPreflight', () => {
  it('keeps allowed CDNs and Google Fonts quiet', () => {
    const html = page(
      `<script type="importmap">{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js" } }</script>
       <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
       <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
       <link rel="preconnect" href="https://fonts.gstatic.com">
       <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter&amp;display=swap">
       <style>@font-face { font-family: X; src: url(https://fonts.gstatic.com/s/x.woff2); }</style>`,
      `<svg xmlns="http://www.w3.org/2000/svg"></svg><script type="module">import * as THREE from 'three'; import x from "https://cdn.jsdelivr.net/npm/x@1/+esm";</script>`,
    );
    assert.deepStrictEqual(blocked(html), []);
  });

  it('flags a Poly Haven texture loaded by a script', () => {
    const html = page('', `<script type="module">const PH = 'https://dl.polyhaven.org/file/ph-assets'; loader.load(\`\${PH}/Textures/x.jpg\`);</script>`);
    const findings = artifactPreflight({ html }).findings;
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0]!.code, 'artifact-blocked-host');
    assert.strictEqual(findings[0]!.url, 'https://dl.polyhaven.org/file/ph-assets');
    assert.strictEqual(findings[0]!.kind, 'fetch');
  });

  it('flags scene spec assets, unless they are embedded', () => {
    const url = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/sky_1k.hdr';
    const html = page(`<script type="application/od-scene+json">{ "assets": [{ "url": "${url}" }] }</script>`);
    assert.deepStrictEqual(blocked(html), [url]);
    assert.deepStrictEqual(blocked(html, [url]), []);
    // A base URL the page joins paths onto is covered when an embedded URL starts with it.
    const withBase = page('', `<script>const PH = "https://dl.polyhaven.org/file/ph-assets";</script>`);
    assert.deepStrictEqual(blocked(withBase, [url]), []);
  });

  it('flags an external <img>, a CSS background and a stylesheet from a CDN', () => {
    const html = page(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/x@1/x.css">',
      '<img src="https://images.unsplash.com/photo-1"><div style="background:url(https://example.com/bg.png)"></div><a href="https://example.com/">link</a>',
    );
    assert.deepStrictEqual(blocked(html), ['https://cdn.jsdelivr.net/npm/x@1/x.css', 'https://images.unsplash.com/photo-1', 'https://example.com/bg.png']);
  });

  it('allows jsDelivr only under /npm/, and only over https', () => {
    assert.ok(isAllowedInArtifact(new URL('https://cdn.jsdelivr.net/npm/three@0.160.0'), 'script'));
    assert.ok(!isAllowedInArtifact(new URL('https://cdn.jsdelivr.net/gh/user/repo/x.js'), 'script'));
    assert.ok(!isAllowedInArtifact(new URL('http://unpkg.com/x'), 'script'));
    assert.ok(!isAllowedInArtifact(new URL('https://unpkg.com/x.png'), 'image'));
  });

  it('ignores URLs in comments and prose', () => {
    const html = page('<!-- <img src="https://example.com/a.png"> -->', '<p>See https://example.com/</p><script>// docs: https://threejs.org/docs\n</script>');
    assert.deepStrictEqual(blocked(html), []);
  });

  it('warns near the limit and fails a 17 MB page', () => {
    assert.deepStrictEqual(artifactPreflight({ html: '', bytes: 12_500_000 }).findings.map((f) => f.code), ['artifact-near-limit']);
    const big = artifactPreflight({ html: '', bytes: 17_000_000 });
    assert.ok(big.blocking);
    assert.strictEqual(big.findings[0]!.code, 'artifact-too-large');
    assert.ok(!artifactPreflight({ html: '', bytes: 1000 }).blocking);
  });

  it('reads srcset candidates', () => {
    const refs = findRemoteReferences('<img srcset="https://a.example/1.png 1x, https://a.example/2.png 2x">');
    assert.deepStrictEqual(refs.map((r) => r.url), ['https://a.example/1.png', 'https://a.example/2.png']);
  });
});
