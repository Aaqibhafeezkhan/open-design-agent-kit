# 3d-objects Specification

## Purpose
3D objects and product shots: a three.js skill with a ready contract (including scene handles for review views), software-WebGL-aware rendering with the `webgl` check, transparent PNG export, turntable guidance for motion export, and a scorecard with a bounded critic loop before a design is reported done.
## Requirements
### Requirement: 3D Object Skill
The catalog SHALL include a local `3d-object` skill producing a self-contained three.js scene (pinned `three@0.160.0` from jsDelivr). The scene SHALL have:
- either a procedural object or a user-supplied `.glb`/`.gltf` from the workspace;
- physically based materials using the design system's palette;
- studio lighting from a generated environment (or, when real reflections matter, a Poly Haven HDRI found with `find_open_design_3d_assets`), set up from the skill's named light setups (`studio` by default, with `daylight`, `interior-lamp`, `fire-lit` and `dusk` where the brief sets a scene);
- a ground shadow, orbit controls and an optional transparent background;
- an auto-rotating turntable driven by `requestAnimationFrame`.

The scene SHALL stand on a ground plane. When the brief asks for a setting around the object, the skill SHALL allow an environment that is marked `userData.odStage = true` and kept darker and less detailed than the subject; the object itself SHALL never be inside a stage group.

The scene's canvas SHALL carry `data-od-webgl`, and the page SHALL expose `window.odScene` with:
- a `ready` promise that resolves after assets load and the first frame renders;
- a writable `rotate` flag;
- the handles `scene`, `camera` and `renderer`.

It MAY also expose `controls`, `subject` (the Object3D to frame), `focus` (an Object3D, used as the focal subject for the check's hero measurements, or `[x, y, z]` for close-ups only) and `views` (named `{ position, target }` camera overrides). The skill SHALL direct the agent to frame portrait canvases separately (a `heroPortrait` view or the fit snippet), so the object fills the mobile frame as it does the desktop one. Every `3d-object` example SHALL follow this contract.

#### Scenario: Product shot from the user's model
- **WHEN** the user asks for a hero shot of `models/headphones.glb`
- **THEN** the brief SHALL direct the agent to load that file with GLTFLoader from the artifact's assets and to expose `odScene.ready` together with the `scene`, `camera` and `renderer` handles

#### Scenario: Object in a setting
- **WHEN** the brief asks for a chess set in a stone hall
- **THEN** the skill SHALL allow the hall as an environment and direct the agent to mark its meshes `userData.odStage = true` so that review views frame the set, not the hall

#### Scenario: Glass needs real reflections
- **WHEN** the brief's object is clear glass
- **THEN** the skill SHALL allow lighting from a Poly Haven HDRI so the glass shows highlights, and SHALL warn that `transmission` renders unreliably in software WebGL

#### Scenario: Mobile framing
- **WHEN** a 3D object is checked at the mobile viewport
- **THEN** the skill's guidance SHALL have the page frame the object for the portrait aspect, and the check's hero measurement SHALL report its coverage there

### Requirement: WebGL-Aware Rendering
Export, the visual check and motion export SHALL launch the browser with software WebGL enabled when the artifact has a `[data-od-webgl]` element or imports `three`, and only then. When `window.odScene.ready` exists, loading SHALL wait for it within the readiness timeout; for still captures, `odScene.rotate` SHALL be set to `false` before capture when present.

#### Scenario: Export on a machine without a GPU
- **WHEN** a 3D object artifact is exported to PNG in a headless environment with no GPU
- **THEN** the scene SHALL render and the PNG SHALL NOT be blank

### Requirement: WebGL Check
Export and the visual check SHALL report `webgl` as an error for a `[data-od-webgl]` canvas whose WebGL context couldn't be created, and as a warning when the canvas's sampled pixels are uniform after readiness.

#### Scenario: Model failed to load
- **WHEN** the GLB path is wrong and the canvas stays a flat color
- **THEN** the check SHALL report a `webgl` warning naming the canvas, alongside the `broken-asset` finding for the model

### Requirement: Transparent Image Export
Image export SHALL accept `transparent: true`, which captures a PNG without the page background, and SHALL warn when every pixel of the result is opaque.

#### Scenario: Product cut-out
- **WHEN** a 3D object with a transparent scene background is exported with `transparent: true`
- **THEN** the PNG SHALL have transparent pixels around the object

### Requirement: Turntable Guidance
The skill SHALL document turntable exports as `format` `mp4` or `gif` with `duration` equal to one full rotation at the scene's rotation speed, so the loop is seamless.

#### Scenario: Turntable GIF
- **WHEN** the user asks for a turntable GIF of the scene
- **THEN** the agent SHALL export with `format: "gif"` and a `duration` of exactly one rotation

### Requirement: 3D Visual Scorecard
The `3d-object` skill SHALL define a visual scorecard with seven categories (form, materials, light, composition, stage, fidelity to the brief, technical), each scored 0 (placeholder), 1 (basic), 2 (finished) or 3 (showcase), and SHALL list automatic failures that fail the scorecard regardless of scores: an element the brief names is missing or unrecognizable, the subject is an unrefined primitive placeholder, fog, darkness or glow stands in for missing geometry, the subject floats above or passes through what it rests on, the subject fills less than 40% of the desktop screenshot's height (the authored camera, since review views are framed by the check) without a stated reason, or the check reports an error. The scorecard passes when every category scores at least 2 and no automatic failure stands. Its provenance (structure adapted from majidmanzarpour/threejs-game-skills, MIT) SHALL be recorded.

#### Scenario: Missing named element
- **WHEN** a chess-set brief's board renders with no squares
- **THEN** the scorecard SHALL fail on the automatic failure "an element the brief names is missing", whatever the category scores are

#### Scenario: Passing scene
- **WHEN** every category scores 2 or 3 and no automatic failure applies
- **THEN** the scorecard SHALL pass

### Requirement: Bounded Critic Loop
After `check_open_design_artifact` reports no errors for a 3D object, the skill SHALL direct the agent to obtain a critique before reporting the design done: from a subagent where the host provides one (the Agent tool in Claude Code, `runSubagent` in VS Code), otherwise from a separate critic pass that judges only the check's review views and the brief. The critic SHALL call `check_open_design_artifact` itself, score the scorecard, and list at least three flaws, each naming the view it is visible in and where, with a concrete fix, scanning for further instances of each flaw's kind. The agent SHALL fix the flaws and repeat the check and critique until the scorecard passes, for at most three critic rounds, and SHALL then tell the user the final scores and any flaws that remain.

#### Scenario: Clean check, visible flaws
- **WHEN** the check reports no findings but the critic finds the glass opaque and the lake oversized
- **THEN** the agent SHALL fix both and run another critic round instead of reporting the design done

#### Scenario: Round limit
- **WHEN** the scorecard still fails after three critic rounds
- **THEN** the agent SHALL stop iterating and report the remaining flaws and scores to the user

#### Scenario: Host without subagents
- **WHEN** the host provides no subagent tool
- **THEN** the agent SHALL run the critic pass itself, judging only the review views and the brief

