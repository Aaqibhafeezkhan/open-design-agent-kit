import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PNG } from 'pngjs';
import type { Browser } from 'puppeteer-core';
import { findBrowser } from '../../export/browserDiscovery';
import { checkArtifact, formatCheckResult } from '../../export/checkArtifact';
import { budgetFindings, captureReviewViews, computePixelMetrics, computeReviewCameras, focalLuma, formatHeroLine, heroFindings, heroFraming, probeScene, REVIEW_VIEWS, sceneSpecFindings, WEBGL_BUDGET, type HeroProbe, type SceneProbe } from '../../export/sceneReview';
import { writeArtifactManifest } from '../../vendored/artifactCreate';

type Vec3 = [number, number, number];

const probe = (over: Partial<SceneProbe> = {}): SceneProbe => ({
  handles: true,
  perspective: true,
  bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
  camera: { position: [0, 3, 10], fov: 40, aspect: 1.5 },
  focus: null,
  views: {},
  ...over,
});

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec3): number => Math.hypot(...a);

/** True when every corner of the box projects inside the camera's frustum. */
function framesBox(position: Vec3, target: Vec3, fov: number, aspect: number, min: Vec3, max: Vec3): boolean {
  const f = sub(target, position);
  const fl = len(f);
  const forward: Vec3 = [f[0] / fl, f[1] / fl, f[2] / fl];
  let right: Vec3 = [-forward[2], 0, forward[0]];
  const rl = len(right) || 1;
  right = [right[0] / rl, right[1] / rl, right[2] / rl];
  const up: Vec3 = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
  const tanV = Math.tan((fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    const rel = sub([x, y, z], position);
    const depth = dot(rel, forward);
    if (depth <= 0 || Math.abs(dot(rel, right)) / depth > tanH + 1e-9 || Math.abs(dot(rel, up)) / depth > tanV + 1e-9) return false;
  }
  return true;
}

function png(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): Buffer {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) img.data.set(fill(x, y), (y * width + x) * 4);
  return PNG.sync.write(img);
}

describe('scene review: view math, metrics and budget', () => {
  it('fits the overview to the subject from the authored azimuth at 25° elevation', () => {
    const p = probe();
    const cams = computeReviewCameras(p)!;
    const o = cams.overview;
    assert.deepStrictEqual(o.target, [0, 1, 0]);
    const dir = sub(o.position, o.target);
    assert.ok(Math.abs(Math.asin(dir[1] / len(dir)) - (25 * Math.PI) / 180) < 1e-9, 'elevation 25°');
    assert.ok(Math.abs(dir[0]) < 1e-9 && dir[2] > 0, 'same azimuth as the authored camera (+z)');
    assert.ok(framesBox(o.position, o.target, 40, 1.5, [-1, 0, -1], [1, 2, 1]), 'every corner in frame');
    assert.strictEqual(o.wireframe, false);
    assert.strictEqual(cams.wireframe.wireframe, true);
    assert.deepStrictEqual(cams.wireframe.position, o.position);
  });

  it('frames a wide flat subject tighter than its bounding sphere would', () => {
    const p = probe({ bounds: { min: [-5, 0, -5], max: [5, 0.5, 5] } });
    const o = computeReviewCameras(p)!.overview;
    const sphereFit = Math.hypot(10, 0.5, 10) / 2 / Math.sin((20 * Math.PI) / 180);
    assert.ok(len(sub(o.position, o.target)) < sphereFit, 'closer than a bounding-sphere fit');
    assert.ok(framesBox(o.position, o.target, 40, 1.5, [-5, 0, -5], [5, 0.5, 5]));
  });

  it('puts the close-up nearer, the low view just above the base, and honors focus and overrides', () => {
    const cams = computeReviewCameras(probe())!;
    assert.ok(len(sub(cams.closeup.position, cams.closeup.target)) < len(sub(cams.overview.position, cams.overview.target)));
    assert.ok(Math.abs(cams.low.position[1] - cams.low.target[1]) < 1e-9, 'level camera');
    assert.ok(cams.low.position[1] < 0.5, 'just above the base');
    const focused = computeReviewCameras(probe({ focus: [0.5, 1.8, 0], views: { low: { position: [4, 0.1, 4], target: [0, 0.1, 0] } } }))!;
    assert.deepStrictEqual(focused.closeup.target, [0.5, 1.8, 0]);
    assert.deepStrictEqual(focused.low, { position: [4, 0.1, 4], target: [0, 0.1, 0], wireframe: false });
  });

  it('returns only the requested views, and nothing without handles, a perspective camera or bounds', () => {
    assert.deepStrictEqual(Object.keys(computeReviewCameras(probe(), ['low', 'overview'])!), ['low', 'overview']);
    assert.strictEqual(computeReviewCameras({ handles: false }), undefined);
    assert.strictEqual(computeReviewCameras(probe({ perspective: false })), undefined);
    assert.strictEqual(computeReviewCameras(probe({ bounds: null })), undefined);
  });

  it('measures a flat frame as sparse and a busy one as rich', () => {
    const flat = computePixelMetrics(png(320, 180, () => [220, 200, 240, 255]));
    assert.deepStrictEqual(flat, { colorEntropyBits: 0, edgeDensity: 0, contrast: 0, dominantColorShare: 1 });
    const busy = computePixelMetrics(png(320, 180, (x, y) => ((x >> 3) + (y >> 3)) % 2 ? [250, 250, 250, 255] : [((x * 7) % 255), ((y * 5) % 255), 40, 255]));
    assert.ok(busy.colorEntropyBits > 3, `entropy ${busy.colorEntropyBits}`);
    assert.ok(busy.edgeDensity > 0.1 && busy.contrast > 60 && busy.dominantColorShare < 0.6);
  });

  it('flags a 3d-scene page without its scene spec, and nothing else', () => {
    const spec = '<script type="application/od-scene+json">{"units":"m"}</script>';
    assert.strictEqual(sceneSpecFindings('<canvas data-od-webgl></canvas>', 'od:prototype:3d-scene')[0]?.check, 'scene-spec');
    assert.deepStrictEqual(sceneSpecFindings(spec, 'od:prototype:3d-scene'), []);
    assert.deepStrictEqual(sceneSpecFindings('<canvas></canvas>', 'od:prototype:3d-object'), []);
    assert.deepStrictEqual(sceneSpecFindings('<canvas></canvas>', undefined), []);
  });

  it('warns only above the software-rendering budget', () => {
    assert.deepStrictEqual(budgetFindings({ calls: WEBGL_BUDGET.calls, triangles: WEBGL_BUDGET.triangles, geometries: 10, textures: WEBGL_BUDGET.textures }), []);
    const over = budgetFindings({ calls: 450, triangles: 450_000, geometries: 10, textures: 3 });
    assert.strictEqual(over.length, 1);
    assert.strictEqual(over[0].check, 'webgl-budget');
    assert.strictEqual(over[0].severity, 'warning');
    assert.match(over[0].message, /450,000 triangles \(budget 300,000\)/);
    assert.match(over[0].message, /450 draw calls \(budget 400\)/);
    assert.match(over[0].message, /software/);
  });
});

/** A pinhole camera at `position` looking at `target`: a world point in NDC, and whether it is behind the camera. */
function projectPoint(position: Vec3, target: Vec3, fov: number, aspect: number, p: Vec3): [number, number, boolean] {
  const f = sub(target, position);
  const fl = len(f);
  const fw: Vec3 = [f[0] / fl, f[1] / fl, f[2] / fl];
  const r0: Vec3 = [fw[2], 0, -fw[0]]; // forward × up (0,1,0), right-handed: right = (−fz, 0, fx) flipped for −z forward
  const rl = len(r0) || 1;
  const right: Vec3 = [-r0[0] / rl, 0, -r0[2] / rl];
  const up: Vec3 = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
  const d = sub(p, position);
  const z = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2];
  const t = Math.tan((fov * Math.PI) / 360);
  const x = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / (z * t * aspect);
  const y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / (z * t);
  return [x, y, z <= 0];
}

/** A HeroProbe for an axis-aligned box seen from a camera (the local frame is the world frame). */
function heroProbeFor(min: Vec3, max: Vec3, cam: { position: Vec3; target: Vec3; fov?: number; aspect?: number }, over: Partial<HeroProbe> = {}): HeroProbe {
  const corners: HeroProbe['corners'] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push(projectPoint(cam.position, cam.target, cam.fov ?? 40, cam.aspect ?? 1.5, [x, y, z]));
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const v = sub(center, cam.position);
  const l = len(v);
  return {
    name: 'gantry',
    fallback: false,
    corners,
    local: { extents: [max[0] - min[0], max[1] - min[1], max[2] - min[2]], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], viewDir: [v[0] / l, v[1] / l, v[2] / l] },
    rect: { x: 0, y: 0, width: 1500, height: 1000 },
    ...over,
  };
}

describe('scene review: hero framing', () => {
  // A gantry 7 wide (x), 4.7 tall (y), 0.9 deep (z): its face normal is z.
  const gMin: Vec3 = [-3.5, 0, -0.45];
  const gMax: Vec3 = [3.5, 4.7, 0.45];

  it('sees a flat object face-on, at three-quarters, and edge-on', () => {
    const face = heroFraming(heroProbeFor(gMin, gMax, { position: [0, 2.3, 14], target: [0, 2.3, 0] }))!;
    assert.ok(face.faceAngle! < 5, `face-on: ${face.faceAngle}`);
    const threeQuarter = heroFraming(heroProbeFor(gMin, gMax, { position: [9, 3, 10.7], target: [0, 2.3, 0] }))!;
    assert.ok(threeQuarter.faceAngle! > 30 && threeQuarter.faceAngle! < 55, `three-quarter: ${threeQuarter.faceAngle}`);
    const edge = heroProbeFor(gMin, gMax, { position: [14, 2.6, 0.4], target: [0, 2.3, 0] });
    const edgeF = heroFraming(edge)!;
    assert.ok(edgeF.faceAngle! > 75, `edge-on: ${edgeF.faceAngle}`);
    assert.ok(heroFindings('desktop', edge, edgeF).some((f) => f.check === 'framing' && /edge-on/.test(f.message) && f.viewport === 'desktop'));
    assert.deepStrictEqual(heroFindings('desktop', heroProbeFor(gMin, gMax, { position: [9, 3, 10.7], target: [0, 2.3, 0] }), threeQuarter), []);
  });

  it('does not call a board seen from above at three-quarters edge-on, nor a cube flat', () => {
    const board = heroFraming(heroProbeFor([-5, 0, -5], [5, 0.5, 5], { position: [7, 10, 12], target: [0, 0.5, 0] }))!;
    assert.ok(board.faceAngle! < 75, `board: ${board.faceAngle}`);
    const cube = heroFraming(heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 1e3], target: [0, 1, 0] }))!;
    assert.strictEqual(cube.faceAngle, undefined);
  });

  it('measures coverage and flags a tiny subject', () => {
    const near = heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 6], target: [0, 1, 0] });
    const far = heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 60], target: [0, 1, 0] });
    const n = heroFraming(near)!;
    const f = heroFraming(far)!;
    assert.ok(n.span.height > 0.4 && n.outside === 0, JSON.stringify(n));
    assert.ok(f.span.height < 0.1 && f.coverage < 0.01);
    assert.deepStrictEqual(heroFindings('mobile', near, n), []);
    const small = heroFindings('mobile', far, f);
    assert.ok(small.some((x) => x.check === 'framing' && /spans only/.test(x.message) && /heroPortrait/.test(x.message)));
  });

  it('measures clipping by edge and counts corners behind the camera as outside', () => {
    const cut = heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [1.6, 1, 4], target: [1.6, 1, 0] });
    const c = heroFraming(cut)!;
    assert.ok(c.outside > 0.1 && c.edges.includes('left'), JSON.stringify(c));
    assert.ok(heroFindings('desktop', cut, c).some((x) => /cut off at the left edge/.test(x.message)));
    assert.deepStrictEqual(heroFindings('desktop', { ...cut, fallback: true }, c).filter((x) => /cut off/.test(x.message)), [], 'a whole scene may run off the frame');
    const behind = heroFraming(heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 0.5], target: [0, 1, -5] }))!;
    assert.ok(behind.outside >= 0.5, JSON.stringify(behind));
    const gone = heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 5], target: [0, 1, 10] });
    const g = heroFraming(gone)!;
    assert.strictEqual(g.outside, 1);
    assert.ok(heroFindings('desktop', gone, g).some((x) => /doesn't show/.test(x.message)));
  });

  it('splits luma inside and outside the focal box, with a floor for dark scenes', () => {
    const png = new PNG({ width: 100, height: 100 });
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
      const i = (y * 100 + x) * 4;
      const v = x >= 25 && x < 75 && y >= 25 && y < 75 ? 60 : 120;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = v;
      png.data[i + 3] = 255;
    }
    const luma = focalLuma(PNG.sync.write(png), { x0: 25, y0: 25, x1: 75, y1: 75 });
    assert.ok(Math.abs(luma.inside - 60 / 255) < 0.01 && Math.abs(luma.outside! - 120 / 255) < 0.01, JSON.stringify(luma));
    const probe = heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 6], target: [0, 1, 0] });
    const f = heroFraming(probe)!;
    assert.ok(heroFindings('desktop', probe, f, luma).some((x) => x.check === 'light' && /0\.235 vs 0\.471/.test(x.message)));
    assert.deepStrictEqual(heroFindings('desktop', probe, f, { inside: 0.03, outside: 0.06 }), [], 'dark scenes are below the floor');
    assert.deepStrictEqual(heroFindings('desktop', probe, f, { inside: 0.4, outside: 0.42 }), [], 'within 0.85×');
  });

  it('leaves background and sky out of the surroundings', () => {
    // Over black and over white: the left half is geometry (same in both), the right half is background (differs).
    const solid = (fill: (x: number, y: number) => number) => {
      const png = new PNG({ width: 100, height: 100 });
      for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
        const i = (y * 100 + x) * 4;
        png.data[i] = png.data[i + 1] = png.data[i + 2] = fill(x, y);
        png.data[i + 3] = 255;
      }
      return PNG.sync.write(png);
    };
    const box = { x0: 20, y0: 20, x1: 40, y1: 80 };
    const page = solid((x) => (x >= 20 && x < 40 ? 100 : x < 50 ? 60 : 240)); // a bright backdrop on the right
    const luma = focalLuma(page, box, solid((x) => (x < 50 ? 60 : 0)), solid((x) => (x < 50 ? 60 : 255)));
    // Geometry around the box is 60 or 100; the 240 backdrop would pull the mean far above 100.
    assert.ok(luma.outside! > 60 / 255 - 0.01 && luma.outside! < 100 / 255, `only the geometry around it counts: ${JSON.stringify(luma)}`);
    assert.ok(focalLuma(page, box).outside! > 0.6, 'without the two background renders, the backdrop counts');
    const inBox = (x: number, y: number) => x >= 20 && x < 40 && y >= 20 && y < 80;
    const allBackdrop = focalLuma(page, box, solid((x, y) => (inBox(x, y) ? 100 : 0)), solid((x, y) => (inBox(x, y) ? 100 : 255)));
    assert.strictEqual(allBackdrop.outside, undefined, 'a subject on a plain backdrop has nothing to compare against');
    const probe = heroProbeFor([-1, 0, -1], [1, 2, 1], { position: [0, 1, 6], target: [0, 1, 0] });
    assert.deepStrictEqual(heroFindings('desktop', probe, heroFraming(probe)!, allBackdrop), []);
  });

  it('writes one evidence line per viewport and suggests focus for the fallback', () => {
    const probe = heroProbeFor(gMin, gMax, { position: [14, 2.6, 0.4], target: [0, 2.3, 0] });
    const line = formatHeroLine({ name: 'mobile', width: 390, height: 844 }, probe, heroFraming(probe), { inside: 0.3, outside: 0.36 });
    assert.match(line, /^Hero still \(mobile 390×844\): focal "gantry" spans \d+% of the width and \d+% of the height \(bounding box\);.*flat, \d+° from its face; brightness 0\.3 vs 0\.36 in the lit scene around it \(0\.83×\)\.$/);
    const fb = formatHeroLine({ name: 'desktop', width: 1440, height: 900 }, { ...probe, fallback: true, name: '', local: undefined }, heroFraming({ ...probe, local: undefined }));
    assert.match(fb, /the scene \(no odScene\.focus\).*Set odScene\.focus/);
  });
});

/**
 * A page with a tiny stand-in for the three.js object API the review script
 * uses (no network): a 2×2×2 subject at the origin, a stage plane marked
 * userData.odStage, a ShadowMaterial ground, and a loop that moves the camera
 * to (9, 9, 9) every frame. The renderer paints the canvas from the camera
 * position and records each render.
 */
function mockScene(opts: { handles?: boolean; triangles?: number; tier?: string } = {}): string {
  return `<!doctype html><html><head><style>html,body{margin:0;background:#fff}canvas{display:block;width:480px;height:320px}</style></head><body>
<canvas id="stage" data-od-webgl width="480" height="320"></canvas>
<script>
class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } clone() { return new V3(this.x, this.y, this.z); } copy(v) { return this.set(v.x, v.y, v.z); } toArray() { return [this.x, this.y, this.z]; } }
class Box { constructor(min, max) { this.min = min; this.max = max; } clone() { return new Box(this.min.clone(), this.max.clone()); } isEmpty() { return this.max.x < this.min.x; }
  applyMatrix4(m) { for (const v of [this.min, this.max]) { v.x += m.x; v.y += m.y; v.z += m.z; } return this; }
  union(b) { this.min.set(Math.min(this.min.x, b.min.x), Math.min(this.min.y, b.min.y), Math.min(this.min.z, b.min.z)); this.max.set(Math.max(this.max.x, b.max.x), Math.max(this.max.y, b.max.y), Math.max(this.max.z, b.max.z)); return this; } }
class Obj { constructor() { this.isObject3D = true; this.children = []; this.parent = null; this.position = new V3(); this.quaternion = { clone() { return this; }, copy() {} }; this.up = new V3(0, 1, 0); this.visible = true; this.userData = {}; this.matrixWorld = { x: 0, y: 0, z: 0 }; }
  add(c) { c.parent = this; this.children.push(c); return this; }
  updateMatrixWorld() { const p = this.parent ? this.parent.matrixWorld : { x: 0, y: 0, z: 0 }; this.matrixWorld = { x: p.x + this.position.x, y: p.y + this.position.y, z: p.z + this.position.z }; this.children.forEach((c) => c.updateMatrixWorld()); }
  traverse(f) { f(this); this.children.forEach((c) => c.traverse(f)); }
  traverseVisible(f) { if (!this.visible) return; f(this); this.children.forEach((c) => c.traverseVisible(f)); }
  getWorldPosition(t) { this.updateMatrixWorld(); return t.set(this.matrixWorld.x, this.matrixWorld.y, this.matrixWorld.z); } }
const color = () => ({ isColor: true, clone() { return { isColor: true }; } });
class Mesh extends Obj { constructor(w, h, material) { super(); this.isMesh = true; this.material = material; this.geometry = { boundingBox: null, computeBoundingBox() { this.boundingBox = new Box(new V3(-w / 2, 0, -w / 2), new V3(w / 2, h, w / 2)); } }; } }
const scene = new Obj();
const subjectMat = { wireframe: false, color: color() };
const subject = new Mesh(2, 2, subjectMat);
const plane = new Mesh(40, 0.1, { wireframe: false, color: color() });
const stage = new Obj(); stage.userData.odStage = true; stage.add(plane);
const shadow = new Mesh(100, 0, { type: 'ShadowMaterial', isShadowMaterial: true, wireframe: false });
// A tall stage wall at z ≈ 2.4: it sits between some review cameras and the subject.
const wallMat = { wireframe: false, color: color() };
const wall = new Mesh(30, 3, wallMat); wall.geometry.computeBoundingBox = function () { this.boundingBox = new Box(new V3(-15, 0, 2.3), new V3(15, 3, 2.5)); };
const wallStage = new Obj(); wallStage.userData.odStage = true; wallStage.add(wall);
scene.add(subject); scene.add(stage); scene.add(shadow); scene.add(wallStage);
const camera = new Obj(); camera.isCamera = true; camera.isPerspectiveCamera = true; camera.fov = 40; camera.aspect = 1.5;
camera.lookAt = function (x, y, z) { this.target = [x, y, z]; };
camera.position.set(0, 3, 10);
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
window.__renders = [];
const renderer = {
  domElement: canvas,
  info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 3, textures: 1 } },
  clear: 0xffffff,
  setClearColor(c) { this.clear = c; }, getClearColor(t) { return t; }, getClearAlpha() { return 1; },
  render(s, cam) {
    let calls = 0; s.traverseVisible((o) => { if (o.isMesh) calls++; });
    this.info.render.calls = calls; this.info.render.triangles = ${opts.triangles ?? 1200};
    const p = cam.position;
    ctx.fillStyle = 'rgb(' + (40 + Math.abs(p.x * 20) % 200) + ',' + (60 + Math.abs(p.y * 20) % 180) + ',' + (80 + Math.abs(p.z * 20) % 170) + ')';
    ctx.fillRect(0, 0, 480, 320);
    ctx.fillStyle = subjectMat.wireframe ? '#fff' : '#222'; ctx.fillRect(200, 100, 80, 120);
    window.__renders.push({ position: p.toArray(), wireframe: subjectMat.wireframe, planeVisible: plane.visible, wallVisible: wall.visible });
  },
};
function loop() { camera.position.set(9, 9, 9); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
window.odScene = { rotate: true, ready: Promise.resolve()${opts.handles === false ? '' : ', scene, camera, renderer'}${opts.tier ? `, tier: '${opts.tier}'` : ''} };
</script></body></html>`;
}

async function workspaceWith(html: string): Promise<{ ws: string; entry: string }> {
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'od-review-'));
  const entry = '.open-design/s/scene.html';
  await fs.mkdir(path.join(ws, '.open-design/s'), { recursive: true });
  await fs.writeFile(path.join(ws, entry), html);
  await writeArtifactManifest({ workspaceRoot: ws, entryPath: entry, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html', 'png'], title: 'Scene' } });
  return { ws, entry };
}

describe('scene review in a real browser (skipped when none is installed)', function () {
  this.timeout(120000);
  let browserPath: string | undefined;
  let browser: Browser | undefined;
  before(async function () {
    const found = await findBrowser();
    if (!found.ok) return this.skip();
    browserPath = found.executablePath;
    const { default: puppeteer } = await import('puppeteer-core');
    browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
  });
  after(async () => {
    await browser?.close();
  });

  it('frames the subject without the stage, poses each view over a loop that moves the camera, and restores the page', async () => {
    const page = await browser!.newPage();
    try {
      await page.setViewport({ width: 800, height: 600 });
      await page.setContent(mockScene(), { waitUntil: 'load' });
      await page.evaluate('window.odScene.ready');
      const p = await probeScene(page);
      assert.strictEqual(p.handles, true);
      assert.deepStrictEqual(p.bounds, { min: [-1, 0, -1], max: [1, 2, 1] }, 'stage and ShadowMaterial meshes excluded');
      const review = await captureReviewViews(page, p, REVIEW_VIEWS);
      assert.deepStrictEqual(review.shots.map((s) => s.label), ['overview', 'closeup', 'low', 'wireframe']);
      const cams = computeReviewCameras(p)!;
      const renders = (await page.evaluate('window.__renders')) as Array<{ position: Vec3; wireframe: boolean; planeVisible: boolean; wallVisible: boolean }>;
      let hidden = 0;
      let shown = 0;
      for (const name of REVIEW_VIEWS) {
        // The overview and wireframe share a camera; they differ in the wireframe flag.
        const hit = renders.find((r) => r.wireframe === (name === 'wireframe') && r.position.every((v, i) => Math.abs(v - cams[name].position[i]) < 1e-9));
        assert.ok(hit, `rendered the ${name} view`);
        assert.strictEqual(hit!.planeVisible, name !== 'wireframe', 'stage hidden only in wireframe');
        // The wall at z ≈ 2.4 stands between the farther review cameras and the subject at the origin, so it's hidden.
        const crosses = cams[name].position[2] > 2.5;
        if (name !== 'wireframe') assert.strictEqual(hit!.wallVisible, !crosses, `${name}: an occluding stage wall is hidden, others stay`);
        hidden += crosses ? 1 : 0;
        shown += crosses ? 0 : 1;
      }
      assert.ok(hidden > 0 && shown > 0, `the fixture exercises both cases (hidden ${hidden}, shown ${shown})`);
      assert.ok(review.evidence.metrics && review.evidence.renderer);
      assert.strictEqual(review.evidence.renderer!.triangles, 1200);
      assert.deepStrictEqual(review.findings, []);
      // Restored: the page's loop runs again with its own camera, and nothing is left in wireframe.
      const before = ((await page.evaluate('window.__renders.length')) as number);
      await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const after = (await page.evaluate('window.__renders.slice(-1)[0]')) as { position: Vec3; wireframe: boolean };
      assert.ok(((await page.evaluate('window.__renders.length')) as number) > before, 'loop resumed');
      assert.deepStrictEqual(after.position, [9, 9, 9]);
      assert.strictEqual(after.wireframe, false);
      assert.strictEqual(await page.evaluate("!!document.getElementById('od-review-isolate')"), false, 'overlay isolation removed');
    } finally {
      await page.close();
    }
  });

  it('adds the review sheet second in a check, with evidence and the budget warning', async () => {
    const { ws, entry } = await workspaceWith(mockScene({ triangles: 450_000 }));
    const result = await checkArtifact({ workspaceRoot: ws, entryPath: entry, browserPath, settleMs: 0 });
    assert.ok(result.ok, JSON.stringify(result));
    if (!result.ok) return;
    assert.deepStrictEqual(result.images.map((i) => i.label), ['desktop', '3d views: overview, closeup, low, wireframe', 'mobile']);
    assert.deepStrictEqual(result.scene3d?.views, ['overview', 'closeup', 'low', 'wireframe']);
    assert.ok(result.findings.some((f) => f.check === 'webgl-budget'));
    const text = formatCheckResult(result);
    assert.match(text, /3D review sheet: overview, closeup, low, wireframe/);
    assert.match(text, /Renderer: \d+ draw calls, 450,000 triangles/);
    assert.match(text, /NOT DONE YET \(3D\).*critique.*at most three critique rounds/s, 'asks for the critique where the agent decides it is done');
  });

  it('honors views: a subset, false, and invalid names', async () => {
    const { ws, entry } = await workspaceWith(mockScene());
    const some = await checkArtifact({ workspaceRoot: ws, entryPath: entry, browserPath, settleMs: 0, views: ['low', 'wireframe'], maxImages: 2 });
    assert.ok(some.ok && some.images.map((i) => i.label).join('|') === 'desktop|3d views: low, wireframe', JSON.stringify(some.ok && some.images.map((i) => i.label)));
    const none = await checkArtifact({ workspaceRoot: ws, entryPath: entry, browserPath, settleMs: 0, views: false });
    assert.ok(none.ok && none.scene3d === undefined && none.images.every((i) => !i.label.startsWith('3d views')));
    const bad = await checkArtifact({ workspaceRoot: ws, entryPath: entry, views: ['top' as never] });
    assert.ok(!bad.ok && bad.code === 'invalid-args');
  });

  it('says a blockout is a blockout and asks for a layout-only critique', async () => {
    const { ws, entry } = await workspaceWith(mockScene({ tier: 'blockout' }));
    const result = await checkArtifact({ workspaceRoot: ws, entryPath: entry, browserPath, settleMs: 0, maxImages: 2 });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.strictEqual(result.scene3d?.tier, 'blockout');
    const text = formatCheckResult(result);
    assert.match(text, /BLOCKOUT/);
    assert.match(text, /NOT DONE YET \(3D blockout\)/);
    assert.doesNotMatch(text, /NOT DONE YET \(3D\):/);
  });

  it('notes how to enable review views on a page without handles', async () => {
    const { ws, entry } = await workspaceWith(mockScene({ handles: false }));
    const result = await checkArtifact({ workspaceRoot: ws, entryPath: entry, browserPath, settleMs: 0 });
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepStrictEqual(result.images.map((i) => i.label), ['desktop', 'mobile']);
    assert.match(formatCheckResult(result), /expose window\.odScene\.scene, window\.odScene\.camera and window\.odScene\.renderer/);
    assert.doesNotMatch(formatCheckResult(result), /NOT DONE YET/, 'no critique reminder without a review sheet');
  });
});
