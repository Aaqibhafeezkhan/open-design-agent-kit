# S1 · Fur creature (stretch)

**Based on:** [3D GPU Fur Simulation](https://aistudio.google.com/learn/gemini-4-argon-showcase) ([preview image](https://www.gstatic.com/aistudio-static/applets/3d-gpu-fur-simulation/image.png)): a round magenta fluffball with ears and big glossy eyes, with dense, soft, individually lit fur, on black.

**What we build:** the creature as a still and a short turntable. No fur physics, AR camera or environment switching.

**Skill:** `3d-object`.

**What it tests:** where rendering stops working. Fur needs a heavy technique (shell texturing: dozens of stacked, alpha-tested copies of the mesh), which strains software WebGL in export and the check. A failure here is a useful result: it shows how export and the check report a scene that's too heavy.

## Inputs

None.

## Prompt

> Make a 3D hero shot of a cute round fluffball creature with two small ears and big glossy black eyes, covered in dense, soft magenta fur that catches the light at the edges. Black background, turning slowly. Export a still and a 6-second turntable MP4.

## Answers, if asked

- Technique: up to the agent.

## Must have

- [ ] It reads as fur from the overview: a soft, fibrous edge against the background, not a smooth or noisy sphere.
- [ ] The eyes sit on the fur surface and stay clear of it.
- [ ] The check and still export finish. Record how long each took.
- [ ] Turntable: record whether it finished, its duration and its frame rate.

## Watch for

- The check or export timing out in software WebGL. Note which one, and whether the finding says why.
- Fur faked with a noise texture on a smooth sphere: reads fine head-on but not at the silhouette.
- Shells visible as stacked layers at a low angle.
