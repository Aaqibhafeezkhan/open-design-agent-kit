## Context

The 3D work so far:

- `add-3d-object` added a single-object skill with the `odScene` ready contract, software WebGL and turntable export.
- `add-3d-critic-loop` added review views, 3D evidence, the scorecard and the critic loop, plus a "NOT DONE YET (3D)" request in the check result.
- `match-upstream-craft-selection` made briefs resolve craft per skill.

The 2026-10-15 rerun showed the critic's fixes running into limits of the medium: no real environment light, no textures, no models beyond lathe and extrude, and no recipe for a setting.

Inputs:

- **Google's Gemini 4 Argon 3D guide.**
  - Workflow 1: align on direction before building.
  - Workflow 6: ground proportions with a 2D plan in meters first.
  - The guide says Three.js alone covers most scenes, with Blender for bespoke hero models.
- **threejs-game-skills (MIT).** A shader cookbook, material roles, budgets and instancing.
- **OpenMontage (AGPL; ideas only).**
  - Fidelity tiers, blockout versus production, where a blockout is never the final result.
  - Explicit versus inferred constraints.
  - A world spec with a timed camera path.
  - CC0 asset kits with recorded provenance.
- **Poly Haven.**
  - Every asset is CC0: no attribution, redistribution allowed.
  - Its public API is free for commercial use and needs no key. It requires a User-Agent or Referer naming the software, and a light "Powered by Poly Haven" credit wherever live API results are shown. That credit isn't needed for the assets themselves.
  - Its CDN `dl.polyhaven.org` answers with `access-control-allow-origin: *`.
  - `/assets?type=…` lists metadata; `/files/<id>` lists file URLs by format and resolution.

## Goals / Non-Goals

**Goals:**
- Settings, dioramas and flythroughs as one self-contained page.
- Real environment light, PBR textures and real models without API keys or installs.
- A planning step that keeps layout and proportions honest.
- Flythroughs export to video by themselves.
- Everything works under the existing check, review views and critic loop.

**Non-Goals:**
- Games, physics, player input.
- Headless Blender (a later change).
- Reference-photo matching (a later change).
- Kenney kits: they ship as zip downloads, not CDN files; a later change if needed.
- WebGPU.
- Text-to-3D.
- Mirroring Poly Haven content into the extension.

## Decisions

### D1. A second skill, not a bigger `3d-object`

`3d-object` stays the fast path for one object and a turntable. `3d-scene` covers settings and has a different workflow: plan, blockout, then finish. Sharing one recipe would make both briefs longer and blur the critique, since "composition" means different things for a product shot and for a room. Both skills keep the same ready contract, so the check, review views, motion export and critic work unchanged.

### D2. The scene spec lives in the page

The agent writes `<script type="application/od-scene+json">` with:

- `explicit`: what the user actually asked for;
- `inferred`: details the agent added;
- `units: "m"`;
- `layout`: named objects with position, size and rotation;
- `views`: named camera `{ position, target, fov }`;
- `path`: camera keyframes `{ t, position, target }` in seconds, plus `duration`;
- `assets`: source, id, URL and license for each asset;
- `seed`.

The page reads the block to place objects and drive the camera, so the spec and the render can't drift apart.

Keeping it in the page fits our self-contained artifacts and survives copy, remix and export. A sidecar JSON was the alternative: rejected, because it's one more file to keep in step, and `standalone` export would need to inline it.

The skill also tells the agent to show the user the layout first, as a table or a top-down SVG for spatially exact scenes (Argon workflow 6), before building, unless the brief is simple.

### D3. Fidelity tiers

`window.odScene.tier` is `"blockout"` or `"finished"`, defaulting to finished when absent.

- **Blockout:** boxes and simple forms with the final layout, camera and light. It's for checking proportions and framing quickly.
- **What the check does:** for a blockout, the review text says so, and the critique request says a blockout is never presented as the final design.
- **Flow:** the skill builds a blockout first for any scene with more than about five objects, gets one critique on layout and composition only, then finishes.

### D4. A camera path driven by time

The camera pose is computed from time along `path`, with smooth interpolation between keyframes, the way the turntable is computed from time. That makes it frame-exact under motion export's virtual clock. `odScene.duration` gives the path's length.

Motion export uses `odScene.duration` when no `duration` is passed, ahead of the CSS and Web animation rules. Pages that set `rotationSeconds` and no `duration` keep today's behavior.

For stills, `odScene.rotate = false` (already set by export) holds the camera at `views.hero`, or else at the path's first keyframe.

### D5. Assets from Poly Haven through one search tool

`find_open_design_3d_assets({ query, type: "hdri" | "texture" | "model", limit?, resolution? })`:

- **What it calls:** `GET https://api.polyhaven.com/assets?type=…`. Results are cached for the process's life and filtered locally by query terms against id, name, tags and categories, then ranked by matches and downloads. For up to `limit` hits (default 5, maximum 10) it calls `/files/<id>`.
- **What it returns per hit:** id, name, categories, dimensions for models, the thumbnail URL, and file URLs at the requested resolution (default `1k`; `2k` allowed).
  - HDRIs: `.hdr`.
  - Textures: the diffuse, normal-GL, roughness and AO-roughness-metal maps as JPG.
  - Models: the `.gltf` plus its included `.bin` and texture URLs.
- **Every result also carries** the license (CC0) and the line "Powered by Poly Haven (polyhaven.com)".
- **Every request sends** `User-Agent: open-design-agent-kit (+https://github.com/feimacode/open-design-agent-kit)`, with a 10-second timeout.
- **Failures** (offline, an API change) return a short error. The skill then falls back to procedural materials and `RoomEnvironment`.

Why a tool: an agent can't reliably guess Poly Haven file URLs, and the `/files` response is large. The tool returns only what a scene needs.

The alternative was a curated catalog synced into content. Rejected: it's bulk copying of their data, which their terms warn against, and it goes stale. A live search per request is what the API is for.

### D6. Loading from the CDN, with offline copies

Scenes reference `dl.polyhaven.org` URLs directly:
- HDRIs through `RGBELoader` and `PMREMGenerator`;
- textures through `TextureLoader`, with `colorSpace` set on diffuse maps;
- models through `GLTFLoader`, measuring and rescaling them as the GLB example already does.

**Model includes need a URL map.** A Poly Haven `.gltf` refers to its `.bin` and textures by relative paths such as `textures/x_diff_1k.jpg`, but on the CDN those files live in other folders. Loading the `.gltf` URL alone gives 404s for the textures (verified 2026-10-16). The tool therefore returns `includes`, mapping each relative path to its real URL. The page passes `GLTFLoader` a `LoadingManager` whose `setURLModifier` swaps each relative request for its mapped URL. Offline copies that keep the relative layout need no map.

Export and check already wait for `odScene.ready` and report failed loads as `broken-asset`.

For offline or long-lived designs, the skill says to download the files into `assets/` with the agent's own terminal, keep the folder layout a glTF expects, and point the page at the local copies. Provenance stays in the scene spec's `assets` list in both cases.

### D7. Budgets for software rendering

The `webgl-budget` limits stay as they are (300k triangles, 400 draw calls, 64 textures). The skill adds:
- instancing for anything repeated more than 10 times;
- 1k textures by default, 2k only for the hero object;
- at most one shadow-casting light;
- at most two post-processing passes;
- a 300k-triangle budget for the whole scene.

### D8. The cookbook

A compact section of the `3d-scene` skill, about 6 KB, ports the parts of `threejs-aaa-graphics-builder/references/shader-cookbook.md` that matter for scenes. Each recipe is checked against three r160 import paths. The recipes are:
- real versus fake glass (transmission is unreliable in software WebGL);
- a fresnel rim with `onBeforeCompile`;
- a gradient sky dome;
- a cheap contact-shadow blob;
- a post chain (`EffectComposer`, `UnrealBloomPass`, `OutputPass`).

Provenance goes in `upstream-ports.md`.

The `3d-object` skill gets only the glass note and the HDRI option, not the whole cookbook.

### D9. Craft

`3d-scene` declares `od.craft.requires: [color, anti-ai-slop]`, the same as `3d-object`.

## Risks / Trade-offs

- [Poly Haven's API or CDN changes or goes down] → The tool fails soft with an error. The skill falls back to procedural materials. Pages show `broken-asset` for missing files. The tool's response parsing is unit-tested against recorded responses.
- [Large textures slow software rendering] → 1k by default, budgets, and the `webgl-budget` warning.
- [HDR files are 1.5–6 MB at 1k] → Accepted: they load once per page, and the skill says to prefer 1k.
- [Scenes need the network to view] → The same as three.js today; offline copies are documented.
- [Agents skip the planning step] → The scene spec is required by the ready contract; the check notes its absence on a `3d-scene` page.
- [Model scale varies] → The skill requires measuring and rescaling every model to its layout size, as `3d-object-glb` does.

## Migration Plan

Additive. `3d-object` pages keep working. The motion-export duration rule only applies when `odScene.duration` is set.

## Open Questions

- Should the preview's Tweaks panel offer knobs from the scene spec (sun angle, exposure, camera)? That's the Argon guide's workflow 4. Deferred: Tweaks works on CSS variables today.
- Should a `progress.html` gallery of review sheets across rounds be written? Deferred.
