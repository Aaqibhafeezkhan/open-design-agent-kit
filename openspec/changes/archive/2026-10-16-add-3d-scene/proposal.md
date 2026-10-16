## Why

The critic loop (`add-3d-critic-loop`) finds flaws faster than hand-built three.js shapes can fix them. In the 2026-10-15 rerun, neither test case passed in three rounds. T1's glass never got a highlight, because there's no real environment light to reflect. T2's knights and stone stayed plain, because there are no textures or models to draw on. The `3d-object` skill is also scoped to one object on an empty stage. Settings, dioramas and camera flythroughs, which most of the Gemini 4 Argon showcase is about (T2's hall, T3's ruins, T4's desk), have no recipe at all.

## What Changes

- **New skill `3d-scene`:** several objects in a setting, such as a diorama, a room, a courtyard, a small landscape or a tabletop, as stills or a camera flythrough. It's built on the same ready contract, review views and critic loop as `3d-object`.
  - **Plan first:** the agent writes a scene spec (an `application/od-scene+json` block in the page) with the explicit requests kept apart from the agent's own inferences, a layout in meters, the camera views, a timed camera path and the asset list. The page renders from that spec.
  - **Fidelity tiers:** `odScene.tier` is `blockout` (layout only) or `finished`. The check says when a page is still a blockout, and the critique treats a blockout as not done.
  - **Budgets and instancing** for software rendering, and a compact shader and material cookbook adapted from threejs-game-skills (MIT): real versus fake glass, rim light, contact shadows, a sky dome and a post-processing chain, all checked against three r160.
- **CC0 assets from Poly Haven:**
  - **New tool `find_open_design_3d_assets`:** it searches Poly Haven's public API for HDRIs, textures and models. It returns direct CDN file URLs at 1k and 2k, sizes, the CC0 license and a "Powered by Poly Haven" credit. It writes nothing.
  - **Loading:** scenes load these files from `dl.polyhaven.org`, which allows cross-origin requests, the same way they load three.js from jsDelivr. Agents can also download them into `assets/` for offline use.
- **`3d-object` can use real light:** an HDRI from Poly Haven is allowed for environment lighting and reflections, which fixes the glass highlight. `RoomEnvironment` stays the default.
- **Camera flythroughs export by themselves:** motion export takes the length from `window.odScene.duration` when no `duration` is passed.
- A **3D scene** tile in the surface picker, and one remixable example: a small stone courtyard at dusk with a Poly Haven lantern, using its textures and HDRI.

## Capabilities

### New Capabilities

- `3d-scenes`: the `3d-scene` skill: the scene spec, fidelity tiers, the camera path, asset sourcing, budgets, the cookbook and the example.
- `3d-asset-sources`: the `find_open_design_3d_assets` tool and the rules for using Poly Haven assets (CDN loading, offline copies, credit).

### Modified Capabilities

- `3d-objects`: the skill may light from a Poly Haven HDRI, and a check of a blockout scene says so.
- `motion-export`: duration resolution adds `window.odScene.duration`, ahead of the CSS and Web animation rules.
- `artifact-visual-check`: review views hide stage meshes that block the review camera (found while running T2 in its hall).

## Impact

- Content:
  - `packages/content/local/skills/3d-scene/SKILL.md` (new), with `od.craft.requires` declared.
  - The new example.
  - `local/surfaces.json` (the new tile).
  - `3d-object/SKILL.md`.
  - Provenance for the cookbook in `docs/contributing/upstream-ports.md`.
- Core:
  - A Poly Haven client (`fetch`, a User-Agent identifying the kit, in-memory caching per process).
  - `odScene.duration` in motion export's duration resolution.
  - `odScene.tier` noted by the check.
- Tools: `find_open_design_3d_assets` in the VS Code tool registry and `package.json`, the MCP server, and the docs.
- Network: the tool makes live API calls (one query per search). Scenes need the CDN to view, as three.js already does.
- No new npm dependencies.
- Validation: rerun T2 (chess in its hall) and run T4 (desk diorama) from `docs/test-cases/3d/` with the new skill, critic loop included.
