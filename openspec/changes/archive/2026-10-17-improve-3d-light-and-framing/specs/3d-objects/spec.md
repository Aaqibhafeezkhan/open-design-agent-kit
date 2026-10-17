## MODIFIED Requirements

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
