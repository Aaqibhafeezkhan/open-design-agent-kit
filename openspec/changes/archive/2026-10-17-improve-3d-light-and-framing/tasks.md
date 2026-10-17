## 1. Check: hero framing measurement

- [x] 1.1 Add `hero()` to `REVIEW_PAGE_SCRIPT` in `packages/core/src/export/sceneReview.ts`. It resolves the focal subject (focus Object3D → subject → non-stage meshes, with a name and a fallback flag), returns the world-box corners projected through the live camera, the canvas rectangle, and for an Object3D focus its local extents and the world direction of its thinnest axis
- [x] 1.2 Add pure functions in `sceneReview.ts`:
  - `heroFraming(projection)`: coverage, outside share, clipped edges and edge-on angle, with corners behind the camera counted as outside;
  - `focalLuma(png, rect)`: inside and outside mean Rec. 709 luma;
  - `heroFindings(...)`: `framing` and `light` warnings at the design's thresholds (span under 20% of both width and height, 10%, 0.3 flatness, 75°, 0.85× with a 0.08 floor);
  - `formatHeroLine(...)`
- [x] 1.3 Add `measureHero(page, viewports)`: for each viewport, set it, set `odScene.rotate = false`, wait three animation frames, call `hero()` and screenshot the canvas. Then restore `rotate` and the first viewport
- [x] 1.4 Wire it into `checkArtifact.ts` after the review capture, in page mode, skipped with `views: false`. Merge its findings, tagged by viewport, and put the evidence lines after the review-sheet line
- [x] 1.5 Update the critique reminder so it treats `framing` and `light` warnings as composition and light flaws
- [x] 1.6 Unit tests in `packages/core/src/test/unit/sceneReview.test.ts`:
  - coverage and clipping, including corners behind the camera;
  - edge-on versus three-quarter flat objects;
  - a chess board seen from above not flagged;
  - the luma split and its floor;
  - the finding thresholds;
  - the evidence-line text, including the fallback suggestion
- [x] 1.7 Integration check on real pages (the mock three.js fixture has no projection, so `hero()` skips there): the T4 spike scene with `focus` = the gantry gives edge-on (88°) and coverage `framing` warnings at both viewports; T2 with `focus` = the set gives only a bottom-clipping warning; the face-on and three-quarter cases are covered by unit tests

## 2. Skills

- [x] 2.1 `3d-scene/SKILL.md`: a "Light" section with the five setups (`studio`, `daylight`, `interior-lamp`, `fire-lit`, `dusk`) and their r160 + ACES numbers, the practical-light rule, the focal-brightest rule, the ambient cap, contact shadows and the stage-group rule
- [x] 2.2 `3d-scene/SKILL.md`: `focal` in the scene spec, `odScene.focus` set from it, `views.heroPortrait`, a fit-to-subject snippet (bounding sphere → distance for the FOV and aspect), the three-quarter rule for flat focal objects, and "fix `framing`/`light` warnings before the critique"
- [x] 2.3 `3d-object/SKILL.md`: pick a light setup (`studio` by default), use `focus` as the focal subject, portrait framing, and never put the object inside a stage group
- [x] 2.4 Verify the numbers in the light setups by rendering T4 (`interior-lamp`) and T2 (`fire-lit`) once each, and adjust them (the courtyard keeps its own tuned dusk lights; `dusk` is not yet rendered as written)

## 3. Examples

- [x] 3.1 Courtyard example (`3d-scene`): add `focal` and `odScene.focus`, plus `heroPortrait` if mobile coverage needs it; check it with no `framing`/`light` warnings
- [x] 3.2 `3d-object` examples: set `focus` and fix any `framing` warning the new check raises
- [x] 3.3 Rebuild the content and MCP server bundles, and run the unit suite (the known `deckExport` timeout aside)

## 4. Rerun

- [x] 4.1 Rerun T2 and T4 from the spike state with the updated skills: fix them until the check has no `framing`/`light` warnings, then run up to three critic rounds
- [x] 4.2 Record the results in `docs/test-cases/3d/` (a run report plus rows in the README results table), compared with the 2026-10-16 run and the 2026-10-17 spike
