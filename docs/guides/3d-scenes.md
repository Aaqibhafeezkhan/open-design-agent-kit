# 3D scenes

Ask for a small world, such as a corner of a room, a stone courtyard at dusk, a tabletop diorama or a little landscape, and the agent builds it as one three.js page. It plans the scene first, lights it with a real sky, textures it with free CC0 assets, and gives you a still or a camera flythrough video. For a single product or logo, see [3D objects](3d-objects.md).

## Before you start

- Nothing to install. three.js and the assets load from CDNs, so viewing needs a connection unless you ask for offline copies.
- Checking and exporting need an installed Chrome, Edge or Chromium; videos also need **ffmpeg** (see [Export animations](export-animations.md#before-you-start)). No GPU is needed.

## Start

> A small stone courtyard at dusk: cobblestones, rough stone walls on three sides, a brass lantern on a post, two wooden planters. Then a still and a 10-second flythrough.

> A cozy reading corner: an armchair, a floor lamp, a rug and a bookshelf, warm evening light.

> A miniature desk diorama with a laptop, a mug and a plant, seen from above at three-quarters.

In VS Code, the gallery's **New design → 3D scene** tile asks what the setting is and whether you want a still or a video. To start from a working scene, remix `od:prototype:3d-scene:example`, the courtyard. See [Remix and the gallery](remix-and-gallery.md).

## What happens

1. **The agent plans.** It writes a scene spec into the page: what you asked for, kept apart from what it filled in, a layout in meters, the camera views, a camera path and the assets. For anything non-trivial it shows you the layout first. For spatially exact scenes, such as a real place or a recreated photo, it draws a top-down plan with measurements and waits for your OK.
2. **It finds assets.** [`find_open_design_3d_assets`](../reference/tools.md#find_open_design_3d_assets) searches Poly Haven for a sky, textures (stone, wood, plaster) and models (a lantern, a chair, a plant).
3. **It builds a blockout first** for bigger scenes: simple boxes at the final positions, with the final camera and light. A critic checks the layout and framing before any detail goes in.
4. **It builds the finished scene** from the spec: textured surfaces, models scaled to their real sizes, sky light plus one sun for shadows, and a slow camera move if you asked for one.
5. **It checks and critiques it.** The check returns a review sheet (overview, close-up, low angle, wireframe) and how heavy the scene is. A critic scores it against your brief and lists flaws to fix, for up to three rounds, as for [3D objects](3d-objects.md#what-happens). Then the agent tells you the scores and anything still open.

## Free assets from Poly Haven

[Poly Haven](https://polyhaven.com) publishes about 1,000 HDRIs, 900 textures and 500 models, all **CC0**: free for any use, including commercial, with no attribution required. The agent:

- loads them straight from Poly Haven's CDN, so nothing is copied into your repo;
- uses 1k files by default, and 2k only for the hero object;
- records every asset (id, URL, license) in the scene spec;
- downloads them into the design's `assets/` folder if you want the design to work offline.

The tool itself only searches. Poly Haven's API terms ask apps to show "Powered by Poly Haven" with live search results, and the tool's results include that line.

## Exports

| You want | How it's exported |
| --- | --- |
| A still | `format: "png"`. The camera holds at the scene's hero view. |
| A flythrough | `format: "mp4"`, `"webm"` or `"gif"`. The length comes from the camera path (`odScene.duration`), so no duration is needed. Frames are exact. |

Software rendering is slow for scenes: a 10-second 960×540 flythrough takes a few minutes. Scenes keep within about 300,000 triangles; the check warns (`webgl-budget`) when one doesn't.

## Limits

- No games, physics or player controls.
- Models come from Poly Haven, from your own `.glb`, or are built from shapes. There's no text-to-3D generation.
- Scenes load three.js and assets from CDNs, including `standalone` exports, unless you ask for offline copies.

## Related

[3D objects](3d-objects.md) · [Export animations](export-animations.md) · [Remix and the gallery](remix-and-gallery.md) · [Tools: find_open_design_3d_assets](../reference/tools.md#find_open_design_3d_assets)
