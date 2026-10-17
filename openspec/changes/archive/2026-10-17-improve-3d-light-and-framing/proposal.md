## Why

Every 3D test run so far has failed on light and composition, even after three critic rounds, while form and fidelity improved (`docs/test-cases/3d`: the baseline, the critic-loop rerun, the 3D-scene run and the Blender spike of 2026-10-17).
- **Mobile frames:** they were unbalanced in every run.
- **T4's start gantry:** the hero camera sees it edge-on.
- **Lamp-lit and fire-lit scenes:** their light doesn't come from the lamp or the fire.

The skills have one lighting recipe (an HDRI plus a sun) and one camera (`views.hero`) for every aspect ratio. The critic is the only judge of framing, and its scores drift from round to round, so fixes go back and forth.

## What Changes

- **Hero framing measurements in the check.** For a 3D page with scene handles, the check measures the hero shot at each checked viewport. It uses the page's own camera, with `odScene.rotate = false`, as a still export would. For the focal subject it measures:
  - the share of the frame it fills;
  - whether it is clipped at a frame edge;
  - whether a flat focal object is seen edge-on;
  - its mean brightness against the rest of the frame.

  It raises `framing` warnings (subject too small, clipped, or edge-on) and a `light` warning (the focal subject is darker than its surroundings). It also adds a line of evidence per viewport, so the critic and the agent work from the same numbers in every round.
- **A focal subject.** It is `odScene.focus` when that is an Object3D, otherwise `odScene.subject`, otherwise the non-stage scene. The scene spec gains `focal`, naming the layout item the scene is about, and the skill directs the page to pass that object as `odScene.focus`.
- **Light setups in the 3D skills.** The skills get five named setups with numbers: `studio`, `daylight`, `interior-lamp`, `fire-lit` and `dusk`. Each gives the key, fill and rim light, the environment, exposure and shadow settings. The skills also get rules:
  - A visible lamp or fire is the key light and is aimed at the focal subject.
  - The focal subject is the brightest area that isn't itself a light source.
  - Every object resting on a surface gets a contact shadow.
  - Ambient light stays well below the key.
- **Framing per aspect ratio.** `views.heroPortrait` is used when the canvas is taller than wide. A fit-to-subject snippet sets the camera distance so the focal subject fills a target share of the frame at any aspect. The skills add a rule to show a flat focal object's face at a three-quarter angle, never edge-on.
- **Props are never stage.** The skills add a rule: objects the scene is about must not be inside a group marked `userData.odStage`. This was found in the Blender spike, where the review views hid a prop as a stage occluder.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `artifact-visual-check`: a new requirement, **3D Hero Framing**, covering the per-viewport measurements, the warnings and the evidence lines. **3D Evidence** changes so that its critique request treats framing and light warnings as composition and light flaws.
- `3d-scenes`: **Scene Spec** gains `focal`. A new requirement, **Light and Framing Guidance**, covers the light setups, the practical-light rule, contact shadows, `views.heroPortrait`, the fit snippet and the stage rule.
- `3d-objects`: **3D Object Skill** gains the same light setups (where they apply to a single object), `views.heroPortrait` and the focal handle.

## Impact

- **Core:** `packages/core/src/export/sceneReview.ts` gets the page-side hero measurement, the projection and edge-on test, and the luminance split. `checkArtifact.ts` runs it per viewport and merges its findings and evidence. Unit tests in `packages/core/src/test/unit/sceneReview.test.ts`.
- **Content:** `packages/content/local/skills/3d-scene/SKILL.md` and `3d-object/SKILL.md`. The `3d-scene` example (the courtyard) and the `3d-object` examples get `focal`/`focus` and `heroPortrait` where they need them, and must pass the new measurements.
- **Docs:** a rerun of T2 and T4 recorded in `docs/test-cases/3d/`.
- **No new dependencies, no tool schema changes:** `odScene` fields are optional, and older pages are checked as before, just without hero framing lines when they have no handles.
