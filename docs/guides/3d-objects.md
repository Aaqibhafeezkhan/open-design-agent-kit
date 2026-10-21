# 3D objects and product shots

Ask for a product, a logo or an object in 3D, and the agent builds a three.js scene: studio-lit, colored from your [design system](design-systems.md), resting on a soft shadow and turning slowly. Use it as a hero visual, or export a still, a transparent cut-out for slides, or a turntable video. For several objects in a setting (a room, a courtyard, a diorama), see [3D scenes](3d-scenes.md).

## Before you start

- Nothing to install to make or preview a scene. three.js loads from a pinned CDN build (`three@0.160.0` on jsDelivr), so viewing needs a connection.
- Checking and exporting need an installed Chrome, Edge or Chromium ([why](export-images.md#before-you-start)). No GPU is needed: exports render WebGL in software.
- Turntable videos need **ffmpeg** (see [Export animations](export-animations.md#before-you-start)).

## Start

> Make a 3D hero shot of our speaker: a soft cylinder with a glowing ring on top, in our brand colors.

> Turn `brand/logo.svg` into a brushed-gold 3D mark that turns slowly.

> A product shot of `models/headphones.glb` on a light stage. Then give me a transparent PNG and a 10-second turntable MP4.

In VS Code, the gallery's **New design → 3D object** tile asks what the object is and where it's going. To start from a working scene, remix one of the examples: `od:prototype:3d-object:example` (a speaker built from shapes), `od:prototype:3d-object-logo` (an extruded logo) or `od:prototype:3d-object-glb` (a model loaded from a `.glb`). See [Remix and the gallery](remix-and-gallery.md).

## What happens

1. **The agent picks how to make the object:**
   - **From shapes:** turned profiles for bottles, speakers and cups; extruded and bevelled shapes; rounded boxes for devices.
   - **From a logo:** your SVG mark, extruded with a bevel. It needs filled paths (outlines alone don't extrude).
   - **From your model:** a `.glb` or `.gltf`, copied under `assets/` next to the design. Draco-compressed models work. Whatever the model's size, units or origin, it's set on the ground and framed automatically. Models over 50 MB load slowly; the agent suggests compressing them first (`npx @gltf-transform/cli optimize in.glb out.glb --compress draco`).
2. **It builds the scene** as one HTML page: physically based materials in your design system's colors, studio lighting from a generated room, or a real sky from [Poly Haven](3d-scenes.md#free-assets-from-poly-haven) when reflections matter (glass, chrome, glossy paint), a ground shadow, orbit controls (drag to turn it, scroll to zoom), and a turntable that makes one full turn every 6–12 seconds. If you ask for a setting (a stone hall, a desk), it's built as a quieter environment behind the object.
3. **It checks the result** with [`check_open_design_artifact`](../reference/tools.md#check_open_design_artifact). Besides the screenshot, the check reports `webgl` when a scene couldn't render:
   - an **error** when the canvas has no WebGL context;
   - a **warning** when the canvas is one flat color, usually because the model didn't load (look for a `broken-asset` finding next to it).

   The check also returns a **review sheet**: the object from four views in one image (a three-quarter overview, a close-up, a low angle that shows anything floating, and a wireframe). It also reports how heavy the scene is, with a `webgl-budget` warning when it's too heavy for software rendering.
4. **A critic reviews it.** A clean check only means the page renders. So before calling it done, the agent asks a critic to judge the review sheet against your brief: a subagent in Claude Code and in VS Code when one is available, otherwise a separate review pass. The critic scores seven areas from 0 to 3: form, materials, light, composition, stage, fidelity to your brief and technical quality. It also lists at least three concrete flaws with fixes, such as "low view: the board floats above its base". Some flaws fail the design outright: something you asked for is missing, the object floats, or it's lost in an empty frame. The agent fixes the flaws and asks again, until every area scores 2 or more, or for at most three rounds. Then it tells you the scores and anything still open.

## Exports

Ask for what you need, for example "export a transparent PNG and a turntable GIF". The agent calls [`export_open_design_artifact`](../reference/tools.md#export_open_design_artifact):

| You want | How it's exported |
| --- | --- |
| A still | `format: "png"`, at a preset or size. The turntable stops and the object returns to its best angle first. `selector: "#stage"` captures the scene without the caption. |
| A transparent cut-out | The scene's background is switched off, then `format: "png"` with `transparent: true`. You get a PNG of the object and its shadow on nothing, ready to drop onto a slide or page. |
| A turntable | `format: "mp4"`, `"webm"` or `"gif"`. The scene sets `odScene.duration` to one full turn, so the export is exactly one loop with no duration to pass. See [Export animations](export-animations.md). |

> **From the CLI:** `npx @feimacode/open-design-agent-kit export .open-design/bottle/bottle.html --format png --transparent`, or `--format mp4` for a turntable. See the [CLI reference](../reference/cli.md).

## How rendering works

Exports, checks and turntable videos open the page in a headless browser. For pages that use WebGL (a canvas marked `data-od-webgl`, or a three.js import), the browser starts with software WebGL (SwiftShader), so it works on machines without a GPU: CI, WSL, servers. It's slower than a GPU, so scenes keep to about 200,000 triangles.

Each scene tells the exporter when it's ready: it sets `window.odScene.ready`, a promise that resolves once the model and textures have loaded and the first frame is drawn. The exporter waits for it (within the usual 15-second limit), so a still never catches the scene half-loaded. For stills it then sets `odScene.rotate = false`, which puts the object back at its authored angle.

The scene also exposes `odScene.scene`, `camera` and `renderer`. The check uses them to render the review views, which it frames on the object and not on the ground or environment (marked `userData.odStage`). It pauses the page's own animation while it does, then puts everything back.

## Limits

- three.js comes from the CDN, including in `standalone` exports, so the scene needs a connection to display. A Poly Haven HDRI or texture the object uses is listed in the page's `application/od-assets+json` block, so a `standalone` export with `embedAssets`, and a [Claude artifact](share-and-publish.md#a-claude-artifact), carry it inside the file.
- No text-to-3D generation: objects are built from shapes, logos or your own models.

## Related

[3D scenes](3d-scenes.md) · [Export images](export-images.md) · [Export animations](export-animations.md) · [Design systems](design-systems.md) · [Troubleshooting](../troubleshooting.md#a-3d-scene-is-blank-webgl)
