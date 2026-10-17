# Blender spike, 2026-10-17

Can the agent model custom objects in headless Blender, export them as `.glb` files and drop them into our three.js scenes, so the critic loop gets better forms than three.js primitives give? This spike tests that on T2 (Gothic chess) and T4 (desk diorama), starting from the final scenes of the [3D scene run](run-2026-10-16-3d-scene.md). The host was Claude Code with Claude Opus 5.5. A fresh critic subagent ran one round per scene with the `3d-scene` scorecard.

## Setup

- **Install:** the official Blender 5.2.2 Linux build from download.blender.org, checksum verified, unpacked to `~/.local/opt/` (no `sudo`). Headless works out of the box with `blender -b -P script.py -- <outdir>`; `bpy` uses Python 3.13 inside Blender.
- **Pattern:** the agent writes a Python script, runs Blender in its own terminal, and exports a `.glb` into the design's `assets/` folder. The page loads it with `GLTFLoader` from a relative URL. The check and critic needed no changes.
- **Scripts:** [blender-spike/](blender-spike/): `od_blender.py` holds the shared helpers (reset, materials, lathe, booleans, triangle count, glTF export with a JSON report, a quick Cycles preview); the other three files build the models.

## What was built

| Model | Replaces | Technique | Build time | Triangles | Passes |
|---|---|---|---|---|---|
| Gothic knight (T2) | Poly Haven `chess_set` knight | Bezier side profile, extruded and bevelled, tapered; ears and mane locks; voxel remesh to fuse; booleans for the eyes, nostrils and mouth; decimated | about 50 s | 24,000 (360k before decimating) | 3 |
| Iron brazier (T2) | a lathe bowl on 3 cylinders | lathe bowl, Bezier scroll legs, brace ring, rivets; **procedural hammered iron baked** to color+AO, roughness and normal maps (1k); emissive coals | 49 s (33 s baking) | 38,000 | 2 |
| Start gantry (T4) | 2 box posts + a box banner | lattice-truss towers and beam, concrete footings, START text mesh, 5 start lights, sagging checkered banner (generated image) | 38 s with the kart | 11,000 | 1 |
| Kart with driver (T4) | (none; the case needs one) | lathe tyres and rims, chassis, side pods, nose, number board, steering wheel, seated driver | (same run) | 7,400 | 2 |

The gantry and kart were modeled at real size and scaled to 1:87 with one `SCALE` constant, so the case's 1:150 step is a one-number change. The extra passes fixed my own mistakes, each visible in the Cycles preview: a blown-out preview light, banding from hard cut-offs in the head shaping, coals placed through the bowl wall, the kart axle through the nose, and a mis-rotated number.

## Critic results (one round each)

| Case | Form | Mat. | Light | Comp. | Stage | Fidelity | Tech. | Automatic failures |
|---|---|---|---|---|---|---|---|---|
| T2 | 2 | 1 | 2 | 1 | 2 | 2 | 3 | black knights unrecognizable from the hero view; mobile frame unbalanced |
| T4 | 2 | 2 | 1 | 1 | 2 | 2 | 3 | pencils (Poly Haven stationery) look like they float; gantry banner not visible in the hero still |

What the critics said about the Blender models:
- **Brazier:** "the best-crafted object in the scene… reads as wrought ironwork". Its weak points are the three.js cone flames and its size relative to the hall.
- **Gantry:** "the best-crafted part of the scene… a believable model-railway-grade piece". But the hero camera sees it edge-on, so the still wastes it.
- **Karts:** they read as karts close up, but at 1:87 they're specks of about 15 px in the hero still, and too blocky to hold up close.
- **Knight:** "a thin extruded silhouette with flat sides and a blunt muzzle, not carved". The black knights seen from behind read as arches. **It's worse than the Poly Haven knight it replaced**, which had fixed form and fidelity in the last run.

## Verdict

- **Blender earns its place for hard-surface and constructed props that no CC0 library has:** trusses, ironwork, vehicles, signage. Two of the three such models became the best-crafted object in their scene on the first or second try, and the code reads like normal modeling.
- **For organic hero shapes it loses to a curated asset.** A profile-extrude knight can't match a scanned or sculpted model. The order should be: search assets first, model in Blender when nothing fits, and fall back to three.js primitives last.
- **Baking works headless and is the most promising part for the stuck materials score.** Procedural node materials (noise, Voronoi bump, AO) became plain glTF textures in about 30 s, and the iron read as iron. The same route could bake the varnished wood, ivory and stone that keep scoring 1.
- **It doesn't move light or composition.** Both scenes still fail on framing (an edge-on gantry, specks at 1:87, unbalanced mobile frames) and light. Those remain the main blockers, as in every earlier run.

## Findings for the kit

1. **Props must not be children of a stage group.** T2's brazier sat inside the hall group (`userData.odStage`), so the review camera aimed at it hid its iron as an occluder and left the coals floating. The `3d-scene` skill should say to add props to the scene, not to stage groups. The check could also refuse to hide a mesh that contains the view's own target.
2. **Model at real size and scale at load,** recording the scale in the scene spec (`"scale": "1:87"` on the asset).
3. **Set a triangle budget per instance.** Four 24k knights took T2 to 208k triangles. A helper should decimate to a budget given by the caller (about 6–8k for a repeated piece).
4. **Preview before exporting.** A 700 px Cycles render (5–10 s) caught every one of my modeling bugs before they reached the scene. Script plus preview plus a look is the inner loop; the check and critic are the outer loop.
5. **Glancing views need a check:** a thin, wide object seen edge-on in `views.hero` (the gantry) could get a warning, or the skill could tell the agent to aim the hero view at the focal object's face.

## If we build it (`add-blender-bridge`)

- Detect Blender (a `blender` on PATH, the snap, `~/.local/opt/blender-*`, or `OPEN_DESIGN_BLENDER`); without it, the skill falls back to assets and three.js.
- Ship `od_blender.py`-style helpers: export with a JSON report (bounds, triangles, bytes), a decimate-to-budget helper, bake-to-glTF, and a preview render.
- Add skill guidance on when to use Blender (constructed props with no asset; not organic heroes) and the stage-group rule.
- Effort: small to medium. It's content plus one helper file; the tools need no change.
