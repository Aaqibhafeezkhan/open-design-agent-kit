## Context

`add-3d-object` gave us the `odScene` ready contract (`ready`, `rotate`, `rotationSeconds`), software WebGL for checks and exports, and the `webgl` finding for blank or contextless canvases. `add-visual-check` returns screenshots at the desktop and mobile viewports and tells the agent to fix errors, look at the images, and stop after two fix rounds.

The 2026-10-15 baseline showed the limits of that loop for 3D:

- **One camera angle.** The check shows the authored view only. T2's floating plinth and slab knights showed up only from a low angle.
- **The scene can't be reached.** Neither the kit nor a person at the console can toggle wireframe, set the camera or read `renderer.info`.
- **No bar to clear.** "Look at the screenshots" has no rubric, so an agent with a clean check stops. Both baseline cases stopped after one round with obvious flaws: T2 had no chessboard squares at all.

Inputs to this design:

- **Google's Gemini 4 Argon 3D guide, workflow 3.** An adversarial critic subagent after each round looks at four shots (three-quarter overview, close-up, low angle, wireframe), lists at least three flaws and scores the scene. The loop repeats until the score clears a high bar.
- **majidmanzarpour/threejs-game-skills (MIT).** It has a 0–3 visual scorecard with thresholds and automatic failures, pixel metrics computed on a coarse grid, and render budgets taken from `renderer.info`.
- **OpenMontage (AGPL).** We take the ideas only, never text or code. A critique must cite evidence, scan for other instances of the same class of flaw, and propose a fix.

## Goals / Non-Goals

**Goals:**

- The agent, and a critic, can see a 3D design from four standard views in one check call, at no extra image cost.
- The check reports objective 3D evidence: pixel metrics and renderer statistics.
- A bounded critic loop with a rubric runs on every host, using the host's native subagent where one exists.
- Existing 3D artifacts keep working unchanged.

**Non-Goals:**

- A critic loop for non-3D surfaces. That's planned as a follow-up once this one has proved itself.
- Reference-image matching (camera and horizon from a photo, overlays) and the `3d-scene` surface. Those are later changes.
- Automatic geometric checks such as floating-object or interpenetration detection. The low-angle and wireframe views make these visible to the critic instead.
- Trimming the universal craft rules out of 3D briefs. The baseline flagged it (114 KB brief); it's a separate change.
- An LLM call made by the kit. The critic is the host's own agent; the kit only supplies evidence and the rubric.

## Decisions

### D1. Expose scene handles instead of a page-implemented `setView`

The skill's ready contract gains `odScene.scene`, `odScene.camera` and `odScene.renderer`. It may also add `controls`, `subject` (the Object3D to frame), `focus` (an Object3D or `[x, y, z]` for the close-up) and `views` (named `{ position, target }` overrides). The kit drives everything from these handles.

*Alternative:* the page implements `setView(name)` and `setWireframe(on)`. Rejected: every agent would re-implement camera fitting, and a wrong implementation hides exactly the flaws the views exist to show. Handles take one line in the page, and the kit's single tested implementation does the rest.

### D2. The kit stops the loop and renders directly

To capture a view, the kit does the following:

1. Calls `renderer.setAnimationLoop(null)` and sets `controls.enabled = false` when present.
2. Saves the camera's position, quaternion and target, and the materials' `wireframe` flags.
3. Positions the camera, calls `renderer.render(scene, camera)` directly, and screenshots the canvas. `preserveDrawingBuffer` is already required by the skill.
4. Restores everything afterwards.

This is necessary because pages move the camera inside their own loop: T2's turntable set the camera every frame. A direct render also works under motion export's virtual clock.

*Alternative:* ask pages to respect a "camera locked" flag. Rejected: it's fragile, and the contract is already easy to get wrong.

### D3. Views computed from the subject's bounds

The kit works out the views itself:

- **Subject.** It uses `odScene.subject`, or else the union of mesh bounds, skipping meshes with `userData.odStage === true` or a `ShadowMaterial`. The skill tells the agent to mark the ground and any environment as stage, so the views frame the object and not the hall.
- **Fit distance.** Each view's distance is the smallest at which all eight corners of the subject's box fit the camera's frustum from that view's direction, plus an 8% margin.
- **The four views**, all at the authored camera's azimuth unless noted:

  | View | Camera |
  |---|---|
  | `overview` | 25° elevation, fitted to the subject |
  | `closeup` | 0.4× the fit distance, aimed at `focus` or else the subject's upper third |
  | `low` | level with a point 8% of the subject's height above its base, azimuth +30° |
  | `wireframe` | the overview camera, with every non-stage material set to `wireframe` |

- **Overrides.** `odScene.views[name]` replaces the computed view of the same name.

### D4. One 2×2 contact sheet

The four views render at 720×450 each and are composed into one labelled 1440×900 sheet, using the same HTML-sheet approach as the deck contact sheet. In page mode the sheet goes second, right after the first viewport's first screen, and the other screenshots fill whatever budget remains. With today's default of 3 images, a 3D page returns the desktop shot, the sheet and the mobile shot. The first draft had the sheet replace the mobile shot, but keeping it costs nothing at the default limit and still shows how the scene frames on a tall canvas.

`views` takes a list of view names to choose which ones go on the sheet, or `false` to turn the sheet off. Without handles, the result carries a note on how to enable the views.

### D5. Evidence: pixel metrics and renderer statistics

**Pixel metrics.** These are computed on the overview with the coarse-grid formula from threejs-game-skills (MIT, attributed in `vendored/SOURCE.md`): color entropy in bits, edge density, luminance contrast (p95 − p5) and dominant-color share. They are advisory text in the result and never findings on their own. The baseline showed why: T2 measured "rich" while its board was missing.

**Renderer statistics.** These come from `renderer.info` after the overview render: calls, triangles, geometries, textures.

**`webgl-budget` warning.** It fires above the software-rendering budget: 300k triangles, 400 draw calls, 64 textures. The 300k limit is higher than the skill's 200k guidance, so that a scene within the guidance never warns. The budget is set for SwiftShader exports, not GPUs, and the message says so.

### D6. A critic loop in the skill, using native subagents

The `3d-object` skill gains a "Critique" section, which runs after the check is clean:

- **Who critiques.**
  - **Claude Code:** the Agent tool.
  - **VS Code / Copilot:** the `runSubagent` tool, when the host provides it.
  - **Codex, or no subagent available:** the same agent runs a separate critic pass that judges only the sheet and the brief, with no knowledge of its own code.

  The critic calls `check_open_design_artifact` itself, so its evidence is independent of the builder.
- **What the critic returns.**
  - A score of 0–3 for each of seven categories: form, materials, light, composition, stage, fidelity to the brief, technical.
  - Any automatic failures.
  - At least three flaws. Each names the view it's visible in and where, and gives a concrete fix.
  - After finding one flaw, a scan for others of the same class.
- **Pass bar.** Every category ≥2 and no automatic failure.
- **Bounds.** At most three critic rounds; then the agent reports the remaining flaws to the user. This keeps Argon's push without its half-hour unbounded runs.

The scorecard text is ours, adapted in structure from threejs-game-skills' 10-category, 0–3 card. Game-only categories (HUD, enemies, rewards) are dropped, and fidelity and stage are added.

*Alternative:* put the critic in the kit as an MCP sampling call. Rejected: it isn't supported on every host, it costs the user an extra model call outside the agent, and it goes against the preference for native mechanisms.

### D7. Stage rule

The stage requirement changes from "a ground plane, nothing else" to: a ground plane by default, plus an environment when the brief asks for one, marked `userData.odStage = true` and kept darker and less detailed than the subject. That resolves the T2 conflict without starting the `3d-scene` surface.

## Risks / Trade-offs

- [Agents forget the handles] → Make them part of the "required" ready-contract block in the skill and in every example. The check notes their absence on any page that uses three.js.
- [Bounds include giant helper meshes (sky domes, huge planes) and the overview zooms out] → The stage flag, `ShadowMaterial` exclusion, and `odScene.subject` as an override.
- [Fitting to a bounding sphere frames wide, flat subjects too loosely: T2's board looked lost in its own fog] → Each view's distance comes from projecting the box's eight corners for that view's direction, with an 8% margin. The wireframe view renders without fog or the page background, on mid grey, so dark subjects stay readable.
- [Wireframe on post-processing scenes] → The direct `renderer.render` bypasses an `EffectComposer`, so views show the raw scene. That's acceptable for critique, and documented.
- [Critic rounds add time; each SwiftShader check is ~25–35 s] → At most three rounds; views add four direct renders (about 1 s each), not page reloads.
- [The scorecard is subjective] → Every flaw needs evidence (a view and a location) and a fix, and the pass bar uses categories, not a single number. The test cases' human scores calibrate it.
- [Composition judged on the kit's own framing] → The review views are fitted by the check, so they always fill the frame. The T1 rerun showed a critic scoring composition from the overview and missing a small authored frame. The skill therefore judges composition, and the 40% rule, on the desktop and mobile screenshots, which use the authored camera.
- [Critic scores vary between rounds: T2's form and materials went 2 → 1 with little change] → Pass on categories and automatic failures, not a total; keep the round limit; the test cases record each round's scores so drift is visible.
- [Hosts without subagents get a weaker, self-graded critic] → It's documented in the skill and accepted for now; the test-case results table records the host so this shows up.

## Migration Plan

The change is additive. Pages without handles behave exactly as today plus one note line. The three examples are updated in the same change, so remixes start compliant. Rollback is a revert of the change; no stored data changes.

## Open Questions

- Should the critic loop generalize to every surface (decks, posters, pages) with surface-specific scorecards? This is likely, after T1/T2 show the gain.
- Should the sheet also be written when exporting a still, as a "review" export for humans? It's deferred until we see whether people ask for it.
