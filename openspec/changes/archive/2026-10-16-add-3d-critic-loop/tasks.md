## 1. Review views in core

- [x] 1.1 In `packages/core/src/export/sceneReview.ts` (new, beside `webgl.ts`), add a page-side probe that reports whether `odScene.scene`, `camera` and `renderer` are present after `ready`, and the scene's subject bounds (from `odScene.subject`, or the union of mesh bounds skipping `userData.odStage` and `ShadowMaterial` meshes)
- [x] 1.2 Compute the `overview`, `closeup`, `low` and `wireframe` cameras from the bounds, the camera's field of view, the authored azimuth and `odScene.focus`; apply `odScene.views` overrides (design D3)
- [x] 1.3 Implement the capture: pause the animation loop and controls, save the camera, target and wireframe flags, render each view directly, screenshot the canvas, then restore everything (design D2)
- [x] 1.4 Compose the selected views into one labelled 2×2 contact sheet (1440×900) with the existing sheet approach (design D4)
- [x] 1.5 Unit tests for the view math (fit distance, elevation, stage exclusion, overrides) and for restore-after-capture on a fixture page whose loop moves the camera

## 2. 3D evidence

- [x] 2.1 Port the coarse-grid pixel metrics (entropy, edge density, contrast, dominant share) from threejs-game-skills' `inspect-threejs-canvas.mjs` into `sceneReview.ts` with an attribution comment, and record it in `packages/core/src/vendored/SOURCE.md` (MIT, commit `8286774`)
- [x] 2.2 Read `renderer.info` after the overview render (calls, triangles, geometries, textures) and add the `webgl-budget` warning (300k triangles, 400 calls, 64 textures; message says the budget is for software rendering)
- [x] 2.3 Unit tests: metrics on synthetic PNGs (flat vs. busy), and budget findings at and over each limit

## 3. Check integration

- [x] 3.1 Add `views?: string[] | false` to `CheckArtifactOptions`, with validation (known names, 1–4) and the default of all four for pages with handles
- [x] 3.2 In page mode, put the review sheet second, after the first viewport's first screen, with other screens filling the remaining budget; add `scene3d` (views, metrics, renderer stats) to the result and the "how to enable views" note for three.js pages without handles
- [x] 3.3 Format the 3D evidence in the findings text shared by every host
- [x] 3.4 Wire `views` into the VS Code tool schema, the MCP tool schema and the CLI (`--views <list|none>`, written with `--screenshots`)
- [x] 3.5 Tests: `checkArtifact.test.ts` cases for a page with handles (desktop + sheet), `views: false`, a page without handles (the note), and a turntable that moves the camera

## 4. Skill and examples

- [x] 4.1 Update `packages/content/local/skills/3d-object/SKILL.md`: the handles in the required ready-contract block; `userData.odStage` and the environment rule (D7); `subject` and `focus`
- [x] 4.2 Add the "Critique" section: the seven-category 0–3 scorecard with automatic failures, the critic brief (call the check itself; at least 3 flaws with view, location and fix; scan for same-kind flaws), the host mapping (Agent tool, `runSubagent`, separate critic pass), the pass bar and the 3-round limit
- [x] 4.3 Record the scorecard's adapted-from-threejs-game-skills provenance in `docs/contributing/upstream-ports.md`
- [x] 4.4 Update the `3d-object`, `3d-object-glb` and `3d-object-logo` examples to expose the handles and mark their stage meshes; confirm each passes the check with a review sheet
- [x] 4.5 Run the content sync for every host's assets and make sure `check-content-sync` passes

## 5. Docs

- [x] 5.1 `docs/reference/tools.md` and `docs/reference/cli.md`: the `views` option, `--views`, the 3D evidence, `webgl-budget`
- [x] 5.2 `docs/guides/3d-objects.md`: the review views, the critic rounds and what the user sees at the end (scores, remaining flaws)
- [x] 5.3 `docs/test-cases/3d/README.md`: take the four review shots from the check's sheet instead of by hand

## 6. Verify

- [x] 6.1 Typecheck, lint and unit tests across core, mcp-server, cli and vscode
- [x] 6.2 Rerun T1 and T2 from `docs/test-cases/3d/` with the new skill (same host and model as the baseline), record the rows and compare with `baseline-2026-10-15.md`: expect the T2 missing board and the T1 glass and framing flaws to be caught by the critic
- [x] 6.3 `openspec validate add-3d-critic-loop --strict`
