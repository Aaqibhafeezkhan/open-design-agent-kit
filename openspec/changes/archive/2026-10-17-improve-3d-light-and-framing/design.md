## Context

`add-3d-critic-loop` gave the check a review sheet (four kit-computed views) and advisory overview metrics. `add-3d-scene` added the scene spec, assets and a `views.hero` still. The four runs since (`docs/test-cases/3d`) show the critic reliably catches *broken* things. Light and composition still stayed at 1 in every run, and the critic's light and composition requests drifted between rounds.

The review views can't show the problem: they are fitted by the kit, not authored. The design's still and mobile shots, where composition is judged, get no measurement at all. Today the page's `views.hero` is one camera for every aspect ratio, and the skills offer one lighting recipe.

Constraints:
- **Rendering:** checks use software WebGL, so measurements must be cheap, with no extra render passes beyond a screenshot.
- **Optional fields:** the `odScene` contract only grows by optional fields, so old pages keep working.
- **No three.js import in core:** page-side code reaches three.js through the page's own objects, plain JS in `REVIEW_PAGE_SCRIPT`.

## Goals / Non-Goals

**Goals:**
- Objective, repeatable numbers for the hero still at each checked viewport: focal size, clipping, edge-on, and focal-vs-surround brightness, as warnings plus evidence.
- Skill guidance specific enough to act on: numeric light setups, the practical-light rule, contact shadows, a portrait hero and a fit snippet.
- A way to name the focal subject (`odScene.focus` as an Object3D, `focal` in the scene spec).

**Non-Goals:**
- Automatically re-framing or re-lighting a page. The agent edits; the check measures.
- Judging aesthetics (rule of thirds, color harmony). The critic still does that.
- Measuring the turntable or flythrough over time; only the still pose is measured.
- A Tweaks light panel (a later change, on the served-preview bridge).

## Decisions

### D1. Measure the page's own hero camera, per viewport, with `rotate = false`
After the review sheet, for each checked viewport in page mode:
1. Set the viewport and set `odScene.rotate = false`.
2. Let the page's own loop run three animation frames, so its resize handler sets the aspect and portrait FOV, and its pose code holds the hero view.
3. Call `__odReview.hero()`, which reads the live `camera` matrices.
4. Screenshot the canvas rectangle for the brightness split.
5. Restore `rotate` and the first viewport afterwards.

*Why not compute a camera from `views.hero` in the kit?* Pages adapt the hero to aspect in their own code (FOV widening, `heroPortrait`). Only the page's camera is the still the user gets. *Alternative rejected:* measuring the existing desktop and mobile screenshots. They are mid-animation, and we have no projection for them.

### D2. The focal subject
The focal subject is chosen in this order:
1. `odScene.focus` when it is an Object3D.
2. Otherwise `odScene.subject`.
3. Otherwise the union of non-stage meshes (the review subject).

A `[x, y, z]` focus is a point, and is only used for the close-up as today. The scene spec's `focal` names a `layout` item. The skill tells the page to set `odScene.focus` to that object; the check does not parse the spec for this, because the page owns the object.

When the focal subject is the fallback, the evidence line says so and suggests setting `odScene.focus`.

### D3. Projection-based measures
Project the eight corners of the focal subject's world bounding box with the camera's view-projection matrix, giving a screen rectangle in normalized device coordinates (NDC).
- **Span:** the share of the frame's width and height that the clamped rectangle spans, plus its area share as evidence. Span, not area, decides the warning: a subject spanning 28% of the frame's height reads well yet covers only about 5% of its area (found on the T4 rerun, where an area bar of 6% flagged a well-framed gantry). It's a bounding-box measure, so it overstates sparse subjects.
- **Clipping:** the share of the projected rectangle outside the frame, and which edges are crossed. Corners behind the camera count as clipped.
- **Edge-on:** only for an Object3D focus. Compute its bounds in its *local* frame. When the thinnest local extent is under 0.3 × the middle extent, the object is flat, and its face normal is that local axis in world space. It is edge-on when the angle between the face normal and the direction from the camera to the subject's center exceeds 75°. A chess board seen from above at 3/4 (normal up, about 35° elevation) passes; T4's gantry seen along the road (normal along the road, camera across it) fails.

Thresholds:

| Measure | Warning when | Severity |
|---|---|---|
| Span | under 20% of both the width and the height at a viewport | `framing` warning |
| Clipping | over 10% of the rectangle outside the frame | `framing` warning |
| Edge-on | flat focal object over 75° from its face | `framing` warning |
| Span near 100% | — | evidence only (a close crop can be intentional) |

### D4. Focal brightness
From the canvas screenshot at that viewport, split pixels into those inside and outside the clamped focal rectangle, and compare mean Rec. 709 luma.
- **Warning:** a `light` warning when the inside mean is under 0.85 × the outside mean, and the outside mean is above 0.08, so that dark scenes aren't flagged for noise.
- **Light sources:** emissive light sources inside the focal subject count as part of it; that's intended. A brazier behind the board is outside the focal subject, so a brighter brazier correctly flags that "the light leads away from the focal point".
- **Evidence:** the ratio is reported either way.

*Alternative rejected:* "the brightest 2% of pixels must be in focus". Flames and windows are legitimately brightest, so it would be too noisy.

### D5. Findings and evidence
- **Findings:** `framing` and `light` findings are warnings, never errors, tagged by viewport like other page findings.
- **Evidence:** one line per viewport, after the review-sheet line, for example: `Hero (mobile 390×844): focal "start line" fills 3% of the frame, in frame, edge-on (82° from its face); focal brightness 0.31 vs 0.36 around it (0.86×).`
- **Critique request:** it gains "treat framing and light warnings as composition and light flaws", so the critic and the agent see the same numbers.
- **Opting out:** `views: false` skips the hero measurement as well as the sheet.

### D6. Skill content
- **Light setups:** five setups with numbers (light type, color temperature or hex, intensity, position relative to the subject, shadow settings, exposure, environment strength): `studio`, `daylight`, `interior-lamp`, `fire-lit`, `dusk`. Intensities are given for three r160's physically correct units with ACES tone mapping. Each was checked by rendering T4 (`interior-lamp`), T2 (`fire-lit`) and the courtyard (`dusk`) once.
- **Rules:** practical light is the key and is aimed at the focal subject; the focal subject is the brightest non-emissive area; there's a contact shadow under every resting object (cookbook blob or shadow map); hemisphere or ambient light at no more than 0.3 × the key; and no prop inside an `odStage` group.
- **Framing:** `views.heroPortrait` (used when `aspect < 1`), and a fit snippet that solves the camera distance along the hero direction so the focal bounding sphere fills a target share (about 35% of the frame's smaller dimension) for the current FOV and aspect. Flat focal objects are shown at a three-quarter angle (30–55° off their face).

## Risks / Trade-offs

- [Bounding-box coverage overstates sparse or long subjects, such as a track loop] → A low 20% span bar, and evidence that says "of its bounding box"; the skill tells pages to set `focus` to the compact focal group, not the whole track.
- [Pages whose loop doesn't honor `rotate = false`] → Measure anyway, and note in the evidence that the camera may be mid-move. The ready contract already requires `rotate`.
- [Extra check time: one more set-viewport, frames and a screenshot per viewport] → About 1–2 s per viewport in software WebGL, small next to the review views.
- [Brightness split is fooled by a bright backdrop that is intentional (a window)] → It's a warning with numbers, not an error; the critic judges.
- [Light-setup numbers tuned on three r160 may not carry over to other versions] → Skills pin r160; the numbers are stated for r160.

## Open Questions

- Should a `framing` warning on desktop count as an automatic critic failure? For now, no: the critic weighs it. Revisit after the rerun.
