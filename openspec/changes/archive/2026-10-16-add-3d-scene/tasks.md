## 1. Poly Haven asset search

- [x] 1.1 `packages/core/src/assets/polyHaven.ts`: fetch with the kit's User-Agent and a 10 s timeout; a per-process cache of `/assets?type=` lists; local matching on id, name, tags and categories ranked by matches then downloads; `/files/<id>` parsed into the URLs a page needs per type and resolution (HDRI `.hdr`; texture diff/nor_gl/rough/arm JPGs; model `.gltf` plus includes)
- [x] 1.2 `find3dAssets` and a text formatter (`formatFound3dAssets`): results with license, credit line, a no-match hint, and the fail-soft fallback advice
- [x] 1.3 Unit tests against recorded API responses (lists, files for an HDRI, a texture and a model), the cache, no-match, and network failure (injected fetch)
- [x] 1.4 Register `find_open_design_3d_assets` in VS Code (`package.json` tool contribution, tool class, registry) and in the MCP server, with the same description

## 2. Core 3D support

- [x] 2.1 Motion export duration resolution: `window.odScene.duration` (a positive number) after `data-duration`, reported as "from the 3D scene"; test with a fixture page
- [x] 2.2 Check: report `odScene.tier === "blockout"` in the 3D evidence and switch the critique request to its blockout wording; note a missing `application/od-scene+json` block on pages registered from `od:prototype:3d-scene`; tests

## 3. Content

- [x] 3.1 `packages/content/local/skills/3d-scene/SKILL.md`: intent, plan-first workflow (scene spec, layout preview), blockout then finish, ready contract and stage marking, camera path and `odScene.duration`, assets via the tool (CDN and offline copies), budgets, the cookbook, register/check/critique/export; `od.craft.requires: [color, anti-ai-slop]`
- [x] 3.2 `3d-object` skill: the HDRI option and the transmission warning; mention `find_open_design_3d_assets`
- [x] 3.3 Example `3d-scene` (stone courtyard at dusk: Poly Haven HDRI, textures, lantern model, an 8–12 s camera path), with `open-design.json`; it passes the check with a review sheet and exports a still and a short MP4
- [x] 3.4 `local/surfaces.json`: a "3D scene" tile (entry `3d-scene`, two questions)
- [x] 3.5 Record the cookbook's provenance in `docs/contributing/upstream-ports.md`
- [x] 3.6 Overlay and host generation; drift checks pass

## 4. Docs

- [x] 4.1 `docs/guides/3d-scenes.md` (new; linked from `docs/README.md` and the 3D objects guide), tool reference entry, `export-animations.md` duration rule
- [x] 4.2 `docs/test-cases/3d/README.md`: T2, T3 and T4 point at the `3d-scene` skill

## 5. Verify

- [x] 5.1 Typecheck, lint and unit tests across packages; `openspec validate add-3d-scene --strict`
- [x] 5.2 Run T4 (desk diorama, as a stand-in until desk photos exist: a generic desk) and rerun T2 with the new skill and the critic loop (same host and model as before); record rows in the test-case README and compare with the 2026-10-15 rerun
