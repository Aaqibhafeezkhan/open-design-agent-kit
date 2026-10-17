// 3D review views and evidence (openspec add-3d-critic-loop): for a page that
// exposes `window.odScene.scene`, `camera` and `renderer`, render the four
// review views a critic needs (overview, close-up, low angle, wireframe) by
// pausing the page's loop and rendering directly, compose them into one
// labelled sheet, and measure the overview (pixel metrics, renderer.info).
import { PNG } from 'pngjs';
import type { Browser, Page } from 'puppeteer-core';
import type { Finding } from '../poster/preflight';

export const REVIEW_VIEWS = ['overview', 'closeup', 'low', 'wireframe'] as const;
export type ReviewView = (typeof REVIEW_VIEWS)[number];

/** Software-rendering budget for checks and exports (design D5): above it, a `webgl-budget` warning. */
export const WEBGL_BUDGET = { triangles: 300_000, calls: 400, textures: 64 } as const;

type Vec3 = [number, number, number];

export interface SceneProbe {
  handles: boolean;
  perspective?: boolean;
  bounds?: { min: Vec3; max: Vec3 } | null;
  camera?: { position: Vec3; fov: number; aspect: number };
  focus?: Vec3 | null;
  views?: Record<string, { position: Vec3; target: Vec3 }>;
  /** `odScene.tier` (add-3d-scene): a blockout is judged on layout only. */
  tier?: 'blockout' | 'finished';
}

export interface ReviewCamera {
  position: Vec3;
  target: Vec3;
  wireframe: boolean;
}

export interface PixelMetrics {
  colorEntropyBits: number;
  edgeDensity: number;
  contrast: number;
  dominantColorShare: number;
}

export interface RendererStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

/** What a check reports about a 3D scene, alongside its findings. */
export interface SceneEvidence {
  /** The review views on the sheet, in order. */
  views: ReviewView[];
  metrics?: PixelMetrics;
  renderer?: RendererStats;
  /** Why no review views were rendered, when they weren't. */
  note?: string;
  /** `odScene.tier`, when the page sets it. */
  tier?: 'blockout' | 'finished';
  /** Hero-still measurements, one line per viewport (improve-3d-light-and-framing). */
  hero?: string[];
}

const deg = Math.PI / 180;
const round = (value: number, digits: number): number => Number(value.toFixed(digits));

/** Camera position `dist` from `target` at azimuth `az` (around +y, 0 = +z) and elevation `el`. */
function orbit(target: Vec3, dist: number, az: number, el: number): Vec3 {
  return [target[0] + dist * Math.cos(el) * Math.sin(az), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el) * Math.cos(az)];
}

/**
 * The distance from `target` along the unit direction `dir` (target → camera)
 * at which every corner of the box fits the camera's frustum, plus a margin.
 */
function fitDistance(min: Vec3, max: Vec3, target: Vec3, dir: Vec3, tanV: number, tanH: number, margin = 1.08): number {
  // Camera basis: forward points from the camera at the target.
  const forward: Vec3 = [-dir[0], -dir[1], -dir[2]];
  let right: Vec3 = [forward[1] * 0 - forward[2] * 1, forward[2] * 0 - forward[0] * 0, forward[0] * 1 - forward[1] * 0];
  const rl = Math.hypot(...right);
  right = rl < 1e-6 ? [1, 0, 0] : [right[0] / rl, right[1] / rl, right[2] / rl];
  const up: Vec3 = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
  const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let d = 1e-3;
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        const rel: Vec3 = [x - target[0], y - target[1], z - target[2]];
        // Depth of the corner in front of a camera at distance D is D + dot(rel, forward).
        const along = dot(rel, forward);
        d = Math.max(d, Math.abs(dot(rel, right)) / tanH - along, Math.abs(dot(rel, up)) / tanV - along);
      }
    }
  }
  return d * margin;
}

function direction(az: number, el: number): Vec3 {
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

/**
 * The review cameras for a probed scene (design D3): each fitted to the
 * subject's bounds from its own direction, at the authored camera's azimuth,
 * with `odScene.views` overriding computed views of the same name.
 */
export function computeReviewCameras(probe: SceneProbe, names: readonly ReviewView[] = REVIEW_VIEWS): Record<ReviewView, ReviewCamera> | undefined {
  if (!probe.handles || !probe.perspective || !probe.bounds || !probe.camera) return undefined;
  const { min, max } = probe.bounds;
  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const tanV = Math.tan((probe.camera.fov * deg) / 2);
  const tanH = tanV * (probe.camera.aspect || 1);
  const fitFrom = (target: Vec3, az: number, el: number): number => fitDistance(min, max, target, direction(az, el), tanV, tanH);
  const [px, , pz] = probe.camera.position;
  const dx = px - center[0];
  const dz = pz - center[2];
  const az = Math.hypot(dx, dz) < 1e-6 ? 0 : Math.atan2(dx, dz);

  const overviewDist = fitFrom(center, az, 25 * deg);
  // Low: level with a point just above the base, looking across at the subject.
  const lowTarget: Vec3 = [center[0], min[1] + Math.max(size[1] * 0.08, 1e-3), center[2]];
  const closeTarget: Vec3 = probe.focus ?? [center[0], min[1] + size[1] * 0.67, center[2]];
  const computed: Record<ReviewView, ReviewCamera> = {
    overview: { position: orbit(center, overviewDist, az, 25 * deg), target: center, wireframe: false },
    closeup: { position: orbit(closeTarget, overviewDist * 0.45, az, 20 * deg), target: closeTarget, wireframe: false },
    low: { position: orbit(lowTarget, fitFrom(lowTarget, az + 30 * deg, 0), az + 30 * deg, 0), target: lowTarget, wireframe: false },
    wireframe: { position: orbit(center, overviewDist, az, 25 * deg), target: center, wireframe: true },
  };
  const out = {} as Record<ReviewView, ReviewCamera>;
  for (const name of names) {
    const override = probe.views?.[name];
    out[name] = override ? { position: override.position, target: override.target, wireframe: name === 'wireframe' } : computed[name];
  }
  return out;
}

/**
 * Page-side helpers, installed once: probe the handles, freeze the page's
 * loop (requestAnimationFrame callbacks are held, controls disabled), pose and
 * render a view directly, and restore everything. Plain JS: this package
 * compiles without DOM types, and three.js classes are reached through the
 * page's own objects (`clone()`, `union()`), never imported.
 */
export const REVIEW_PAGE_SCRIPT = `(() => {
  if (window.__odReview) return;
  const isStage = (o) => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.odStage) return true; return false; };
  const mats = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
  const isShadow = (m) => !!m && (m.isShadowMaterial || m.type === 'ShadowMaterial');
  const within = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
  const isSubjectMesh = (o, s) => o.isMesh && !mats(o).some(isShadow) && (s.subject && s.subject.isObject3D ? within(o, s.subject) : !isStage(o));
  const handles = () => {
    const s = window.odScene || {};
    return s.scene && s.scene.isObject3D && s.camera && s.camera.isCamera && s.renderer && typeof s.renderer.render === 'function' ? s : null;
  };
  const boundsOf = (root, skipStage) => {
    let box = null;
    root.updateMatrixWorld(true);
    root.traverseVisible((o) => {
      if (!o.isMesh) return;
      if (skipStage && (isStage(o) || mats(o).some(isShadow))) return;
      let b = null;
      if (o.isInstancedMesh && typeof o.computeBoundingBox === 'function') { o.computeBoundingBox(); b = o.boundingBox ? o.boundingBox.clone() : null; }
      else if (o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b = o.geometry.boundingBox ? o.geometry.boundingBox.clone() : null; }
      if (!b || b.isEmpty()) return;
      b.applyMatrix4(o.matrixWorld);
      box = box ? box.union(b) : b;
    });
    return box;
  };
  const vec = (v) => (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && isFinite(n)) ? v : null);
  // A stage mesh (a wall, a backdrop) between the review camera and its target would hide the subject:
  // hide it for that view. Segment-vs-box slab test on the mesh's world bounds.
  const blocks = (box, from, to) => {
    let t0 = 0, t1 = 1;
    for (const axis of ['x', 'y', 'z']) {
      const d = to[axis] - from[axis];
      if (Math.abs(d) < 1e-9) { if (from[axis] < box.min[axis] || from[axis] > box.max[axis]) return false; continue; }
      let a = (box.min[axis] - from[axis]) / d, b = (box.max[axis] - from[axis]) / d;
      if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return false;
    }
    return true;
  };
  const hideOccludingStage = (s, view) => {
    const from = { x: view.position[0], y: view.position[1], z: view.position[2] };
    const to = { x: view.target[0], y: view.target[1], z: view.target[2] };
    s.scene.updateMatrixWorld(true);
    s.scene.traverse((o) => {
      if (!o.isMesh || !o.visible || !isStage(o) || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const box = o.geometry.boundingBox && o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      // The ground under everything is never the occluder that matters here.
      if (box && box.max.y - box.min.y > 1e-3 && blocks(box, from, to)) o.visible = false;
    });
  };
  let saved = null;
  window.__odReview = {
    probe() {
      const s = handles();
      if (!s) return { handles: false };
      const cam = s.camera;
      const subject = s.subject && s.subject.isObject3D ? s.subject : null;
      const box = boundsOf(subject || s.scene, !subject);
      let focus = null;
      if (s.focus && s.focus.isObject3D) focus = s.focus.getWorldPosition(cam.position.clone()).toArray();
      else focus = vec(s.focus);
      const views = {};
      if (s.views && typeof s.views === 'object') {
        for (const [k, v] of Object.entries(s.views)) {
          const position = v && vec(v.position), target = v && vec(v.target);
          if (position && target) views[k] = { position, target };
        }
      }
      return {
        handles: true,
        perspective: !!cam.isPerspectiveCamera,
        bounds: box ? { min: box.min.toArray(), max: box.max.toArray() } : null,
        camera: { position: cam.position.toArray(), fov: cam.fov || 50, aspect: cam.aspect || 1 },
        focus,
        views,
        tier: s.tier === 'blockout' || s.tier === 'finished' ? s.tier : undefined,
      };
    },
    freeze() {
      const s = handles();
      if (!s || saved) return Promise.resolve(false);
      const raf = window.requestAnimationFrame;
      saved = { raf, held: [], position: s.camera.position.clone(), quaternion: s.camera.quaternion.clone(), up: s.camera.up.clone(), materials: new Map(), visible: new Map(), controls: null, fog: s.scene.fog, background: s.scene.background, clear: null, clearAlpha: s.renderer.getClearAlpha ? s.renderer.getClearAlpha() : 1 };
      window.requestAnimationFrame = (cb) => { saved.held.push(cb); return 0; };
      if (s.controls && 'enabled' in s.controls) { saved.controls = s.controls.enabled; s.controls.enabled = false; }
      // Captions and overlays drawn over the canvas aren't part of the scene; the page background stays.
      const style = document.createElement('style');
      style.id = 'od-review-isolate';
      style.textContent = 'body * { visibility: hidden !important; } canvas, [data-od-webgl], [data-od-webgl] * { visibility: visible !important; }';
      document.head.appendChild(style);
      s.scene.traverse((o) => {
        saved.visible.set(o, o.visible);
        if (o.isMesh) for (const m of mats(o)) {
          if (!saved.materials.has(m)) saved.materials.set(m, m.wireframe);
          // Any Color instance serves as a target for reading the clear color back.
          if (!saved.clear && m.color && m.color.isColor && s.renderer.getClearColor) saved.clear = s.renderer.getClearColor(m.color.clone());
        }
      });
      // A frame already scheduled runs once more (and re-schedules into the held list) before any view is posed.
      return new Promise((r) => raf.call(window, () => raf.call(window, () => r(true))));
    },
    pose(view) {
      const s = handles();
      if (!s || !saved) return null;
      for (const [m, w] of saved.materials) m.wireframe = w;
      for (const [o, v] of saved.visible) o.visible = v;
      s.scene.fog = saved.fog;
      s.scene.background = saved.background;
      if (saved.clear) s.renderer.setClearColor(saved.clear, saved.clearAlpha);
      if (view.wireframe) {
        // Lines read on mid grey, without fog or the page's background.
        s.scene.fog = null;
        s.scene.background = null;
        if (s.renderer.setClearColor) s.renderer.setClearColor(0x808080, 1);
        s.scene.traverse((o) => {
          if (!o.isMesh) return;
          if (isSubjectMesh(o, s)) { for (const m of mats(o)) m.wireframe = true; }
          else o.visible = false;
        });
      }
      if (!view.wireframe) hideOccludingStage(s, view);
      const cam = s.camera;
      cam.up.set(0, 1, 0);
      cam.position.set(view.position[0], view.position[1], view.position[2]);
      cam.lookAt(view.target[0], view.target[1], view.target[2]);
      cam.updateMatrixWorld();
      s.renderer.render(s.scene, cam);
      const info = s.renderer.info || { render: {}, memory: {} };
      const r = s.renderer.domElement.getBoundingClientRect();
      return {
        stats: { calls: info.render.calls || 0, triangles: info.render.triangles || 0, geometries: info.memory.geometries || 0, textures: info.memory.textures || 0 },
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      };
    },
    // The hero still as the page frames it (improve-3d-light-and-framing): the focal subject's world-box
    // corners through the live camera, and for an Object3D focal subject its local extents and axes.
    hero() {
      const s = handles();
      if (!s) return null;
      const cam = s.camera;
      cam.updateMatrixWorld();
      if (cam.updateProjectionMatrix && cam.isPerspectiveCamera) cam.updateProjectionMatrix();
      let focal = null, name = '';
      if (s.focus && s.focus.isObject3D) { focal = s.focus; name = s.focus.name || 'odScene.focus'; }
      else if (s.subject && s.subject.isObject3D) { focal = s.subject; name = s.subject.name || 'odScene.subject'; }
      const box = boundsOf(focal || s.scene, !focal);
      const r = s.renderer.domElement.getBoundingClientRect();
      const rect = { x: r.left, y: r.top, width: r.width, height: r.height };
      if (!box) return { name, fallback: !focal, corners: [], rect };
      const v = cam.position.clone();
      const corners = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        v.set(x, y, z);
        const behind = v.clone().applyMatrix4(cam.matrixWorldInverse).z >= 0;
        v.project(cam);
        corners.push([v.x, v.y, behind]);
      }
      let local;
      if (focal) {
        focal.updateMatrixWorld(true);
        const inv = focal.matrixWorld.clone().invert();
        let lb = null;
        focal.traverseVisible((o) => {
          if (!o.isMesh || !o.geometry || mats(o).some(isShadow)) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          if (!o.geometry.boundingBox || o.geometry.boundingBox.isEmpty()) return;
          const b = o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld));
          lb = lb ? lb.union(b) : b;
        });
        if (lb) {
          const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((a) => v.set(a[0], a[1], a[2]).transformDirection(focal.matrixWorld).toArray());
          const center = box.getCenter(v.clone());
          const viewDir = center.sub(cam.position).normalize().toArray();
          local = { extents: [lb.max.x - lb.min.x, lb.max.y - lb.min.y, lb.max.z - lb.min.z], axes, viewDir };
        }
      }
      return { name, fallback: !focal, corners, local, rect };
    },
    // While frozen at the page's hero pose: render with the background off over a given clear color
    // (clear = null renders as the page does). Pixels that change between two clear colors are background.
    heroRender(clear) {
      const s = handles();
      if (!s || !saved) return false;
      s.scene.background = clear === null ? saved.background : null;
      if (clear === null) { if (saved.clear) s.renderer.setClearColor(saved.clear, saved.clearAlpha); }
      else s.renderer.setClearColor(clear, 1);
      s.renderer.render(s.scene, s.camera);
      return true;
    },
    restore() {
      const s = handles();
      if (!saved) return false;
      const st = saved;
      saved = null;
      if (s) {
        for (const [m, w] of st.materials) m.wireframe = w;
        for (const [o, v] of st.visible) o.visible = v;
        s.scene.fog = st.fog;
        s.scene.background = st.background;
        if (st.clear) s.renderer.setClearColor(st.clear, st.clearAlpha);
        s.camera.position.copy(st.position);
        s.camera.quaternion.copy(st.quaternion);
        s.camera.up.copy(st.up);
        s.camera.updateMatrixWorld();
        if (st.controls !== null && s.controls) s.controls.enabled = st.controls;
        s.renderer.render(s.scene, s.camera);
      }
      const style = document.getElementById('od-review-isolate');
      if (style) style.remove();
      window.requestAnimationFrame = st.raf;
      for (const cb of st.held) st.raf.call(window, cb);
      return true;
    },
  };
})()`;

/** Probes `window.odScene` for the handles review views need. */
export async function probeScene(page: Page): Promise<SceneProbe> {
  await page.evaluate(REVIEW_PAGE_SCRIPT);
  return ((await page.evaluate('window.__odReview.probe()').catch(() => ({ handles: false }))) ?? { handles: false }) as SceneProbe;
}

/** Why a probed three.js page gets no review views, or undefined when it can have them. */
export function reviewUnavailableNote(probe: SceneProbe): string | undefined {
  if (!probe.handles) return 'No review views: expose window.odScene.scene, window.odScene.camera and window.odScene.renderer (the 3d-object ready contract) to get overview, close-up, low-angle and wireframe views.';
  if (!probe.perspective) return 'No review views: they need a PerspectiveCamera.';
  if (!probe.bounds) return 'No review views: no visible mesh to frame (everything is marked userData.odStage, or the scene is empty).';
  return undefined;
}

/**
 * Pixel statistics on a coarse grid, as advisory evidence (design D5).
 * Adapted from majidmanzarpour/threejs-game-skills, skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs
 * (computePixelMetrics; MIT, commit 8286774): see vendored/SOURCE.md.
 */
export function computePixelMetrics(png: Buffer): PixelMetrics {
  const img = PNG.sync.read(png);
  const stepX = Math.max(1, Math.floor(img.width / 160));
  const stepY = Math.max(1, Math.floor(img.height / 90));
  const cols = Math.floor(img.width / stepX);
  const rows = Math.floor(img.height / stepY);
  const luminance = new Float64Array(cols * rows);
  const buckets = new Map<string, number>();
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const o = (gy * stepY * img.width + gx * stepX) * 4;
      const r = img.data[o];
      const g = img.data[o + 1];
      const b = img.data[o + 2];
      luminance[gy * cols + gx] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  const samples = cols * rows;
  const sorted = Array.from(luminance).sort((a, b) => a - b);
  let entropy = 0;
  let dominant = 0;
  for (const count of buckets.values()) {
    const p = count / samples;
    entropy -= p * Math.log2(p);
    dominant = Math.max(dominant, count);
  }
  let edges = 0;
  let checked = 0;
  for (let gy = 0; gy < rows - 1; gy++) {
    for (let gx = 0; gx < cols - 1; gx++) {
      const i = gy * cols + gx;
      if (Math.max(Math.abs(luminance[i] - luminance[i + 1]), Math.abs(luminance[i] - luminance[i + cols])) > 12) edges++;
      checked++;
    }
  }
  return {
    colorEntropyBits: round(entropy, 2),
    edgeDensity: round(checked > 0 ? edges / checked : 0, 3),
    contrast: round(sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.05)], 1),
    dominantColorShare: round(dominant / samples, 3),
  };
}

/** `webgl-budget` warnings for a scene over the software-rendering budget. */
export function budgetFindings(stats: RendererStats): Finding[] {
  const over: string[] = [];
  if (stats.triangles > WEBGL_BUDGET.triangles) over.push(`${stats.triangles.toLocaleString('en-US')} triangles (budget ${WEBGL_BUDGET.triangles.toLocaleString('en-US')})`);
  if (stats.calls > WEBGL_BUDGET.calls) over.push(`${stats.calls} draw calls (budget ${WEBGL_BUDGET.calls})`);
  if (stats.textures > WEBGL_BUDGET.textures) over.push(`${stats.textures} textures (budget ${WEBGL_BUDGET.textures})`);
  if (over.length === 0) return [];
  return [
    {
      check: 'webgl-budget',
      severity: 'warning',
      message: `The scene renders ${over.join(', ')}. Checks and exports render WebGL in software, so heavy scenes are slow and turntables may take minutes: merge or instance repeated meshes, lower segment counts, and share materials and textures.`,
    },
  ];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The review sheet: up to four views in a 2-column grid, each labelled (design D4). */
export async function composeReviewSheet(browser: Browser, shots: Array<{ label: string; png: Buffer }>): Promise<Buffer> {
  const cell = 720;
  const columns = shots.length === 1 ? 1 : 2;
  const figures = shots
    .map((s) => `<figure><img src="data:image/png;base64,${s.png.toString('base64')}" alt=""><figcaption>${escapeHtml(s.label)}</figcaption></figure>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#1b1b1d;font:600 15px/1.2 system-ui,sans-serif;color:#f2f2f2;width:max-content}
.grid{display:grid;grid-template-columns:repeat(${columns},${cell}px);gap:12px}
figure{margin:0;position:relative}
img{display:block;width:${cell}px;height:auto}
figcaption{position:absolute;left:8px;top:8px;padding:3px 8px;border-radius:4px;background:rgba(0,0,0,.65)}
</style></head><body><div class="grid">${figures}</div></body></html>`;
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: cell * columns + 12 * (columns + 1), height: 600, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    const body = await page.$('body');
    return Buffer.from(await body!.screenshot({ type: 'png' }));
  } finally {
    await page.close();
  }
}

/**
 * Renders the requested review views of a probed scene and measures the
 * overview. The page is frozen for the duration and restored afterwards,
 * even when a view fails.
 */
export async function captureReviewViews(
  page: Page,
  probe: SceneProbe,
  names: readonly ReviewView[],
): Promise<{ shots: Array<{ label: ReviewView; png: Buffer }>; evidence: SceneEvidence; findings: Finding[] }> {
  const cameras = computeReviewCameras(probe, names);
  if (!cameras) return { shots: [], evidence: { views: [], note: reviewUnavailableNote(probe), tier: probe.tier }, findings: [] };
  const shots: Array<{ label: ReviewView; png: Buffer }> = [];
  let stats: RendererStats | undefined;
  let metrics: PixelMetrics | undefined;
  await page.evaluate('window.__odReview.freeze()');
  try {
    // The overview is always measured, even when it isn't on the sheet.
    const order: ReviewView[] = names.includes('overview') ? [...names] : ['overview', ...names];
    const overview = computeReviewCameras(probe, ['overview'])!.overview;
    for (const name of order) {
      const view = cameras[name] ?? overview;
      const posed = (await page.evaluate(`window.__odReview.pose(${JSON.stringify(view)})`)) as { stats: RendererStats; rect: { x: number; y: number; width: number; height: number } } | null;
      if (!posed || posed.rect.width < 1 || posed.rect.height < 1) continue;
      const png = Buffer.from(await page.screenshot({ type: 'png', clip: posed.rect }));
      if (name === 'overview' && !stats) {
        stats = posed.stats;
        metrics = computePixelMetrics(png);
      }
      if (names.includes(name)) shots.push({ label: name, png });
    }
  } finally {
    await page.evaluate('window.__odReview.restore()').catch(() => undefined);
  }
  return {
    shots,
    evidence: { views: shots.map((s) => s.label), metrics, renderer: stats, tier: probe.tier },
    findings: stats ? budgetFindings(stats) : [],
  };
}

// ── Hero framing (improve-3d-light-and-framing) ─────────────────────────────

/** What the page reports about its hero still at one viewport (`__odReview.hero()`). */
export interface HeroProbe {
  /** The focal subject's name ('' for the fallback). */
  name: string;
  /** True when neither `odScene.focus` nor `odScene.subject` is an Object3D. */
  fallback: boolean;
  /** The focal world box's eight corners in NDC, with whether each is behind the camera. */
  corners: Array<[number, number, boolean]>;
  /** For an Object3D focal subject: its local extents, its local axes in world space, and the camera-to-subject direction. */
  local?: { extents: Vec3; axes: [Vec3, Vec3, Vec3]; viewDir: Vec3 };
  /** The canvas rectangle in CSS pixels. */
  rect: { x: number; y: number; width: number; height: number };
}

export interface HeroFraming {
  /** Share of the frame covered by the focal box, clamped to the frame (0–1). */
  coverage: number;
  /** Share of the frame's width and height the clamped focal box spans (0–1). */
  span: { width: number; height: number };
  /** Share of the projected focal box outside the frame (0–1); corners behind the camera count as outside. */
  outside: number;
  /** Frame edges the focal box crosses. */
  edges: Array<'left' | 'right' | 'top' | 'bottom'>;
  /** For a flat focal object: the angle in degrees between its face normal and the view direction. */
  faceAngle?: number;
  /** The clamped focal box in canvas pixels. */
  box: { x0: number; y0: number; x1: number; y1: number };
}

export interface FocalLuma {
  inside: number;
  outside?: number;
}

/** Thresholds from the design (D3, D4). */
export const HERO_LIMITS = { minSpan: 0.2, maxOutside: 0.1, flatness: 0.3, edgeOnDeg: 75, lumaRatio: 0.85, lumaFloor: 0.08 } as const;

/** Coverage, clipping and the edge-on angle of the focal subject in the hero still. */
export function heroFraming(probe: HeroProbe): HeroFraming | undefined {
  const front = probe.corners.filter((c) => !c[2]);
  if (front.length === 0) return probe.corners.length ? { coverage: 0, span: { width: 0, height: 0 }, outside: 1, edges: [], box: { x0: 0, y0: 0, x1: 0, y1: 0 } } : undefined;
  const xs = front.map((c) => c[0]);
  const ys = front.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const area = (x1 - x0) * (y1 - y0);
  const [cx0, cx1, cy0, cy1] = [Math.max(-1, x0), Math.min(1, x1), Math.max(-1, y0), Math.min(1, y1)];
  const clamped = Math.max(0, cx1 - cx0) * Math.max(0, cy1 - cy0);
  const behindShare = (probe.corners.length - front.length) / probe.corners.length;
  const outside = Math.max(area > 0 ? 1 - clamped / area : 1, behindShare);
  const edges: HeroFraming['edges'] = [];
  if (x0 < -1) edges.push('left');
  if (x1 > 1) edges.push('right');
  if (y1 > 1) edges.push('top');
  if (y0 < -1) edges.push('bottom');
  const { width: w, height: h } = probe.rect;
  const box = { x0: ((cx0 + 1) / 2) * w, x1: ((cx1 + 1) / 2) * w, y0: ((1 - cy1) / 2) * h, y1: ((1 - cy0) / 2) * h };
  const span = { width: Math.max(0, cx1 - cx0) / 2, height: Math.max(0, cy1 - cy0) / 2 };
  const out: HeroFraming = { coverage: clamped / 4, span, outside, edges, box };
  if (probe.local) {
    const e = probe.local.extents;
    const order = [0, 1, 2].sort((a, b) => e[a] - e[b]);
    if (e[order[0]] < HERO_LIMITS.flatness * e[order[1]]) {
      const n = probe.local.axes[order[0]];
      const d = probe.local.viewDir;
      const cos = Math.min(1, Math.abs(n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / (Math.hypot(...n) * Math.hypot(...d) || 1));
      out.faceAngle = (Math.acos(cos) * 180) / Math.PI;
    }
  }
  return out;
}

/** Below this share of the frame, the lit geometry around the focal subject is too little to compare against. */
const MIN_SURROUND = 0.05;

/**
 * Mean Rec. 709 luma inside and outside the focal box, from a screenshot of the canvas. With the
 * same frame rendered over black and over white with the background off, pixels that differ are
 * background or sky and are left out of the surroundings: a bright backdrop isn't light leading
 * away from the subject. With too little lit geometry around the subject, `outside` is undefined.
 */
export function focalLuma(png: Buffer, box: HeroFraming['box'], overBlack?: Buffer, overWhite?: Buffer): FocalLuma {
  const img = PNG.sync.read(png);
  const k = overBlack && overWhite ? [PNG.sync.read(overBlack), PNG.sync.read(overWhite)] : undefined;
  const mask = k && k[0].width === img.width && k[1].width === img.width && k[0].height === img.height && k[1].height === img.height ? k : undefined;
  let inSum = 0, inN = 0, outSum = 0, outN = 0, all = 0;
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      all++;
      const l = (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) / 255;
      if (x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) { inSum += l; inN++; continue; }
      if (mask) {
        const d = Math.abs(mask[0].data[i] - mask[1].data[i]) + Math.abs(mask[0].data[i + 1] - mask[1].data[i + 1]) + Math.abs(mask[0].data[i + 2] - mask[1].data[i + 2]);
        if (d > 24) continue; // background or sky
      }
      outSum += l; outN++;
    }
  }
  const outside = outN > 0 && outN >= MIN_SURROUND * all ? round(outSum / outN, 3) : undefined;
  return { inside: round(inN ? inSum / inN : 0, 3), outside };
}

const pct = (n: number) => (n > 0 && n < 0.01 ? `${(n * 100).toFixed(1)}%` : `${Math.round(n * 100)}%`);
const focalLabel = (p: HeroProbe) => (p.fallback ? 'the scene (no odScene.focus)' : `focal "${p.name}"`);

/** `framing` and `light` warnings for one viewport (design D3–D5). */
export function heroFindings(viewport: string, probe: HeroProbe, f: HeroFraming, luma?: FocalLuma): Finding[] {
  const out: Finding[] = [];
  const who = focalLabel(probe);
  const warn = (check: string, message: string) => out.push({ check, severity: 'warning', message, viewport });
  if (f.outside >= 1) warn('framing', `The hero still doesn't show ${who}: it is outside the frame or behind the camera. Aim views.hero${viewport === 'mobile' ? ' (or views.heroPortrait)' : ''} at it.`);
  else {
    if (Math.max(f.span.width, f.span.height) < HERO_LIMITS.minSpan) warn('framing', `${cap(who)} spans only ${pct(f.span.width)} of the hero still's width and ${pct(f.span.height)} of its height. Move the camera closer or narrow the FOV until it spans roughly a third to two-thirds of the frame${viewport === 'mobile' ? '; frame portrait separately with views.heroPortrait or the fit snippet' : ''}.`);
    // A whole scene (no focal subject) runs off the frame by nature: clipping is evidence only then.
    if (!probe.fallback && f.outside > HERO_LIMITS.maxOutside) warn('framing', `${pct(f.outside)} of ${who} is cut off at the ${listEdges(f.edges)} of the hero still. Pull back or re-aim${viewport === 'mobile' ? ' for portrait (views.heroPortrait)' : ''}.`);
  }
  if (f.faceAngle !== undefined && f.faceAngle > HERO_LIMITS.edgeOnDeg) warn('framing', `${cap(who)} is flat and seen edge-on (${Math.round(f.faceAngle)}° from its face) in the hero still. Show its face at a three-quarter angle, 30–55° off.`);
  if (luma && luma.outside !== undefined && luma.outside > HERO_LIMITS.lumaFloor && luma.inside < HERO_LIMITS.lumaRatio * luma.outside) {
    warn('light', `${cap(who)} is darker than its surroundings in the hero still (mean brightness ${luma.inside} vs ${luma.outside}). Aim the key light at it, or darken the surroundings, so the light leads to it.`);
  }
  return out;
}

function listEdges(edges: string[]): string {
  if (edges.length === 0) return 'frame edge';
  const words = edges.length === 1 ? edges[0] : `${edges.slice(0, -1).join(', ')} and ${edges[edges.length - 1]}`;
  return `${words} edge${edges.length > 1 ? 's' : ''}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One evidence line per viewport. */
export function formatHeroLine(viewport: { name: string; width: number; height: number }, probe: HeroProbe, f: HeroFraming | undefined, luma?: FocalLuma): string {
  const head = `Hero still (${viewport.name} ${viewport.width}×${viewport.height}): `;
  if (!f) return `${head}nothing to measure (${focalLabel(probe)} has no visible meshes).`;
  const parts = [`${focalLabel(probe)} spans ${pct(f.span.width)} of the width and ${pct(f.span.height)} of the height (bounding box)`];
  parts.push(f.outside > 0.01 ? `${pct(f.outside)} cut off${f.edges.length ? ` at the ${f.edges.join('/')}` : ''}` : 'fully in frame');
  if (f.faceAngle !== undefined) parts.push(`flat, ${Math.round(f.faceAngle)}° from its face`);
  if (luma) parts.push(luma.outside !== undefined ? `brightness ${luma.inside} vs ${luma.outside} in the lit scene around it (${round(luma.inside / Math.max(luma.outside, 1e-3), 2)}×)` : `brightness ${luma.inside} (little lit scene around it to compare)`);
  let line = head + parts.join('; ') + '.';
  if (probe.fallback) line += ' Set odScene.focus to the object the scene is about for a sharper measurement.';
  return line;
}

/**
 * Measures the page's own hero still at each viewport (design D1): `rotate` off, the page's loop
 * left to pose and resize, then the focal projection and a canvas screenshot. Restores `rotate`
 * and the first viewport.
 */
export async function measureHero(page: Page, viewports: ReadonlyArray<{ name: string; width: number; height: number }>): Promise<{ findings: Finding[]; lines: string[] }> {
  const findings: Finding[] = [];
  const lines: string[] = [];
  await page.evaluate('window.__odHeroRotate = window.odScene && window.odScene.rotate; if (window.odScene && "rotate" in window.odScene) window.odScene.rotate = false;');
  try {
    for (const v of viewports) {
      await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: 1 });
      await page.evaluate('window.scrollTo(0, 0)');
      await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 100)))))');
      const probe = (await page.evaluate('window.__odReview && window.__odReview.hero()').catch(() => null)) as HeroProbe | null;
      if (!probe || probe.rect.width < 1 || probe.rect.height < 1) continue;
      const framing = heroFraming(probe);
      let luma: FocalLuma | undefined;
      if (framing && framing.outside < 1 && (await page.evaluate('window.__odReview.freeze()'))) {
        // Frozen at the hero pose (overlays hidden): the frame over black and over white with the background off, then as the page draws it.
        try {
          const shot = async (clear: string) => {
            await page.evaluate(`window.__odReview.heroRender(${clear})`);
            return Buffer.from(await page.screenshot({ type: 'png', clip: probe.rect }));
          };
          const overBlack = await shot('0x000000');
          const overWhite = await shot('0xffffff');
          luma = focalLuma(await shot('null'), framing.box, overBlack, overWhite);
        } finally {
          await page.evaluate('window.__odReview.restore()').catch(() => undefined);
        }
      }
      if (framing) findings.push(...heroFindings(v.name, probe, framing, luma));
      lines.push(formatHeroLine(v, probe, framing, luma));
    }
  } finally {
    await page.evaluate('if (window.odScene && "rotate" in window.odScene && window.__odHeroRotate !== undefined) window.odScene.rotate = window.__odHeroRotate;').catch(() => undefined);
    if (viewports[0]) await page.setViewport({ width: viewports[0].width, height: viewports[0].height, deviceScaleFactor: 1 });
  }
  return { findings, lines };
}

/** The 3D evidence as text lines for the check result. */
export function formatSceneEvidence(evidence: SceneEvidence): string[] {
  const lines: string[] = [];
  if (evidence.views.length > 0) lines.push(`3D review sheet: ${evidence.views.join(', ')} (one image). Use it to judge form, materials, light, framing and contact from every side.`);
  if (evidence.hero) lines.push(...evidence.hero);
  if (evidence.metrics) {
    const m = evidence.metrics;
    lines.push(
      `3D evidence (overview, advisory): color entropy ${m.colorEntropyBits} bits, edge density ${m.edgeDensity}, contrast ${m.contrast}, dominant color ${Math.round(m.dominantColorShare * 100)}% of pixels. Entropy under ~3 or one color over ~60% suggests a sparse or flat frame; contrast under ~60 suggests washed-out light.`,
    );
  }
  if (evidence.renderer) {
    const r = evidence.renderer;
    lines.push(`Renderer: ${r.calls} draw calls, ${r.triangles.toLocaleString('en-US')} triangles, ${r.geometries} geometries, ${r.textures} textures.`);
  }
  if (evidence.note) lines.push(evidence.note);
  if (evidence.tier === 'blockout') lines.push(BLOCKOUT_NOTE);
  if (evidence.views.length > 0) lines.push(evidence.tier === 'blockout' ? BLOCKOUT_CRITIQUE : CRITIQUE_REMINDER);
  return lines;
}

/**
 * Said in the check result itself, where the agent decides it's done
 * (add-3d-critic-loop): a clean check only means the scene renders.
 */
export const CRITIQUE_REMINDER =
  "NOT DONE YET (3D): a clean check only means the scene renders, not that it looks right. Before telling the user it's done, get a critique of this review sheet and the desktop/mobile screenshots against the user's brief: from a subagent if your host has one (the Agent tool in Claude Code, runSubagent in VS Code), otherwise in a separate critic pass that judges only these images and the brief. Use the scorecard from the skill you're following (3d-object or 3d-scene): form, materials, light, composition (judged on the desktop/mobile shots), stage, fidelity, technical, each 0–3, plus its automatic failures, and at least three flaws, each with the view, where, and a fix; treat any framing and light warnings above as composition and light flaws. Fix them, check again and get a new critique until every category is at least 2 with no automatic failure, for at most three critique rounds; then tell the user the scores and anything left. (If you are the critic, just score and list the flaws.)";

/** A blockout (odScene.tier = "blockout"; add-3d-scene): boxes and simple forms with the final layout, camera and light. */
export const BLOCKOUT_NOTE = 'This scene is a BLOCKOUT (odScene.tier = "blockout"): judge layout, scale and framing only. A blockout is never the final design.';

/** The critique request for a blockout: one round on layout and composition, then build the finished scene. */
export const BLOCKOUT_CRITIQUE =
  "NOT DONE YET (3D blockout): get one critique of this review sheet and the desktop/mobile screenshots on layout, scale and composition only, from a subagent if your host has one (the Agent tool in Claude Code, runSubagent in VS Code), otherwise in a separate critic pass. Fix the layout, then build the finished scene (set odScene.tier to \"finished\"), check it again and run the full critique from the 3d-object or 3d-scene skill. Never present a blockout to the user as the final design. (If you are the critic, just score and list the flaws.)";

/** The scene spec block a 3d-scene page carries (add-3d-scene). */
export const SCENE_SPEC_SELECTOR_RE = /<script[^>]*type\s*=\s*["']application\/od-scene\+json["']/i;

/** A `scene-spec` warning for a page made from the 3d-scene skill without its scene spec block. */
export function sceneSpecFindings(entryContent: string, sourceSkillId: string | undefined): Finding[] {
  if (!sourceSkillId || !/(^|:)3d-scene(:|$)/.test(sourceSkillId) || SCENE_SPEC_SELECTOR_RE.test(entryContent)) return [];
  return [
    {
      check: 'scene-spec',
      severity: 'warning',
      message: 'This 3d-scene page has no scene spec (<script type="application/od-scene+json">). Add it with explicit, inferred, units, layout, views (including hero), path and duration if it moves, assets and seed, and place objects and the camera from it.',
    },
  ];
}
