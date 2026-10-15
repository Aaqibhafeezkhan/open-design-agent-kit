# 3D test cases

Manual quality benchmarks for 3D designs, based on apps from Google's [Gemini 4 Argon Builders Showcase](https://aistudio.google.com/learn/gemini-4-argon-showcase) (October 2026). Each case adapts a showcase app to what the kit makes: a self-contained three.js design to look at and export, not a game. We don't copy the showcase apps. Their preview images are linked only as a quality bar.

Run every case once on the current `3d-object` skill to set a baseline, then again after each 3D change lands, to measure the gain:

| Change | Cases it should move |
|---|---|
| Critic loop + multi-angle check | All |
| Reference-image matching (camera, horizon, grid overlay) | T3, T4 |
| `3d-scene` surface (several objects, environments, camera paths) | T2, T3, T4 |
| Optional headless Blender bridge | T2, T3 |

## Cases

| # | Case | Based on | What it tests most |
|---|---|---|---|
| [T1](t1-pocket-world-terrarium.md) | Pocket world terrarium | Pocket World Terrarium | Glass, wood and a small diorama as one object; baseline |
| [T2](t2-wizard-chess.md) | Gothic chess set | Wizard Chess 3D | A set of turned pieces, stone and gold materials, an environment behind the object |
| [T3](t3-chaco-canyon.md) | Pueblo Bonito reconstruction | Chaco Canyon 3D Ruins | Plan first, then extrude; proportions that stay true |
| [T4](t4-desk-diorama.md) | Desk diorama | Desk Racer | Matching a real photo's camera and scale |
| [T5](t5-arcade-cabinet.md) | Branded arcade cabinet | Pixel Arcade | Product shot with live screen content, skinned by the design system |
| [S1](s1-fur-creature.md) | Fur creature (stretch) | 3D GPU Fur Simulation | Shader-heavy rendering; where software WebGL stops |

## How to run a case

1. Open a fresh workspace (or a new folder) with the kit installed. Note the host and model: VS Code + Copilot, Claude Code or Codex.
2. Put the case's inputs where its page says, then paste its prompt as written. Answer any questions the agent asks with the case's answers; don't steer otherwise.
3. Let the agent finish, including its own check. Don't fix anything by hand.
4. Take the four review shots below, run the exports the case lists, and score it.

### The four review shots

These come from the critic workflow in Google's [3D guide](https://aistudio.google.com/learn/building-3d-games-and-worlds-with-gemini-4-argon) (workflow 3):

1. **Overview:** three-quarter view of the whole composition.
2. **Close-up:** surface detail and textures.
3. **Low angle:** near ground level, to show whether objects sit on the ground or float.
4. **Wireframe:** the geometry, to show blocky shapes and parts passing through each other.

The check returns all four as one review sheet when the scene exposes `odScene.scene`, `camera` and `renderer`: run `check <entry> --screenshots <dir>` and keep `3d-views-overview-closeup-low-wireframe.jpg`. For a scene without the handles (as in the 2026-10-15 baseline), orbit the preview by hand for shots 1–3; the wireframe can't be taken.

### Score

| Measure | How |
|---|---|
| Check | `check_open_design_artifact` findings: count the errors and warnings, and list the `webgl` ones |
| Exports | Each export the case lists succeeds (yes/no). A transparent still has transparent pixels; a turntable loops without a jump |
| Flaws | At least three concrete visual flaws from the four shots (boxy shapes, floating parts, clipped shadows, flat materials, wrong proportions) |
| Quality, 1–10 | One score each for **form** (silhouette and proportion), **materials**, **light**, **framing**, and **fidelity** to the brief or reference |
| Process | Agent rounds (render → fix cycles), wall time, and whether the agent stopped early or ran on |

Google's critic bar is 9/10. Read the showcase preview as roughly 9, and a recognizable but plain scene as about 5.

## Results

Keep the screenshots out of git. Add one row per run here:

| Date | Case | Kit version / change | Host + model | Check (E/W) | Exports | Form | Mat. | Light | Framing | Fidelity | Rounds | Time | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-15 | T1 | `d0fb134` baseline | Claude Code + Opus 5.5 | 0/0 | 3/3 | 6 | 5 | 6 | 4 | 5 | 1 | check 25 s, turntable 2.5 min | Milky glass, oversized lake, unreadable props, empty frame. [Details](baseline-2026-10-15.md) |
| 2026-10-15 | T2 | `d0fb134` baseline | Claude Code + Opus 5.5 | 0/0 | 2/2 | 5 | 5 | 5 | 6 | 3 | 1 | check 34 s, turntable 5 min | No chessboard squares, slab knights, floating plinth. [Details](baseline-2026-10-15.md) |
| 2026-10-15 | T1 | `add-3d-critic-loop` | Claude Code + Opus 5.5, critic subagent | 0/0 | 3/3 | 7 | 6 | 6 | 4 | 7 | 3 critic rounds (fail) | turntable 1 min 44 s | Glass, lake, houses and lighthouse fixed; glass highlight and ground still weak. [Details](rerun-2026-10-15-critic-loop.md) |
| 2026-10-15 | T2 | `add-3d-critic-loop` | Claude Code + Opus 5.5, critic subagent | 0/0 | 2/2 | 6 | 6 | 6 | 7 | 7 | 3 critic rounds (fail) | turntable 5 min 36 s | Board, runes, plinth and framing fixed; white knights and materials still weak. [Details](rerun-2026-10-15-critic-loop.md) |
