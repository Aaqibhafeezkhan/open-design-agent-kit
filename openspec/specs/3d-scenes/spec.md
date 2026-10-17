# 3d-scenes Specification

## Purpose
Small 3D worlds: a `3d-scene` skill that plans a scene spec first, builds a blockout then a finished scene, drives a time-based camera path for flythroughs, sources CC0 assets, stays within software-rendering budgets, and goes through the same review views and critique loop as 3D objects; with a remixable courtyard example and a surface tile.
## Requirements
### Requirement: 3D Scene Skill
The catalog SHALL include a local `3d-scene` skill (`od:prototype:3d-scene`, `od.craft.requires` `color` and `anti-ai-slop`) producing a self-contained three.js page (pinned `three@0.160.0`) of several objects in a setting — a diorama, room, courtyard, small landscape or tabletop — as stills or a camera flythrough. It SHALL follow the `3d-object` ready contract (`data-od-webgl`, `window.odScene` with `ready`, `rotate`, `scene`, `camera`, `renderer`), mark sky, ground and backdrop meshes `userData.odStage = true` where they would distort framing, and use the same check, review views and critique loop. It SHALL state budgets for software rendering (instancing for anything repeated more than ten times, 1k textures by default, at most one shadow-casting light, at most two post-processing passes, about 300,000 triangles) and include a compact material and shader cookbook (real and fake glass, fresnel rim, gradient sky dome, contact shadow, a post-processing chain) verified against three r160, whose provenance (adapted from majidmanzarpour/threejs-game-skills, MIT) SHALL be recorded.

#### Scenario: A courtyard at dusk
- **WHEN** the user asks for a small stone courtyard at dusk with a lantern
- **THEN** the brief SHALL be the `3d-scene` skill's, and the agent SHALL plan the scene spec before building

#### Scenario: One object
- **WHEN** the user asks for a product shot of one object
- **THEN** the `3d-object` skill SHALL remain the recommended entry

### Requirement: Scene Spec
A `3d-scene` page SHALL contain a `<script type="application/od-scene+json">` block holding:
- `explicit`: what the user asked for;
- `inferred`: what the agent added;
- `units`: `"m"`;
- `layout`: named objects with position, size and rotation;
- `focal`: the name of the `layout` item, or group of items, that the scene is about;
- `views`: named cameras with `position`, `target` and `fov`, including `hero` and, when the design is viewed in portrait, `heroPortrait`;
- `path` (optional): camera keyframes `{ t, position, target }` in seconds, with `duration`;
- `assets`: each with `source`, `id`, `url` and `license`, and `scale` for models made at real size and shrunk;
- `seed`.

The page SHALL place objects and drive the camera from this block, and SHALL set `window.odScene.focus` to the Object3D named by `focal`. The skill SHALL direct the agent to show the user the layout (a table, or a top-down SVG with meter dimensions for spatially exact scenes) before building, unless the brief is simple. The check SHALL note when a page using the `3d-scene` skill has no scene spec.

#### Scenario: Spec and render agree
- **WHEN** the agent moves the lantern in the scene spec's `layout`
- **THEN** the rendered lantern SHALL move with it, without a second edit elsewhere in the page

#### Scenario: Missing spec
- **WHEN** a page registered from `od:prototype:3d-scene` has no `application/od-scene+json` block
- **THEN** the check result SHALL say the scene spec is missing

#### Scenario: Focal subject named
- **WHEN** a desk diorama's spec has `"focal": "start-line"`
- **THEN** the page SHALL set `odScene.focus` to the start-line group, and the check's hero measurements SHALL be of that group

### Requirement: Fidelity Tiers
A 3D page MAY set `window.odScene.tier` to `"blockout"` or `"finished"` (default `"finished"`). When the check finds `tier: "blockout"`, its result SHALL say the page is a blockout and its critique request SHALL say a blockout is judged on layout, scale and framing only and is never presented as the final design. The `3d-scene` skill SHALL direct the agent to build a blockout first for scenes of more than about five objects, get one critique on layout and composition, then finish.

#### Scenario: Blockout checked
- **WHEN** a scene with `odScene.tier = "blockout"` is checked
- **THEN** the result SHALL name it a blockout and the critique request SHALL say it isn't the final design

### Requirement: Camera Path
When the scene spec has a `path`, the page SHALL compute the camera pose from time along the keyframes (smoothly interpolated), so motion export renders it frame-exactly, SHALL set `window.odScene.duration` to the path's length in seconds, and, when `odScene.rotate` is `false`, SHALL hold the camera at `views.hero` (else the first keyframe).

#### Scenario: Flythrough video
- **WHEN** a scene with a 12-second path is exported with `format: "mp4"` and no `duration`
- **THEN** the video SHALL be 12 seconds long and follow the path

#### Scenario: Still of a flythrough scene
- **WHEN** the same scene is exported as a PNG
- **THEN** the image SHALL show the `hero` view

### Requirement: Scene Example and Surface
The catalog SHALL include a remixable `3d-scene` example (a small stone courtyard at dusk lit by a Poly Haven HDRI, with Poly Haven textures and a Poly Haven lantern model) that passes the check with a review sheet, and the surface picker SHALL offer a "3D scene" tile whose entry is `3d-scene`.

#### Scenario: Remix the courtyard
- **WHEN** the user remixes the `3d-scene` example
- **THEN** the copy SHALL render with its assets loading from the Poly Haven CDN and pass the check with no errors

### Requirement: Light and Framing Guidance
The `3d-scene` skill SHALL give five named light setups with numeric settings for three r160 with ACES tone mapping: `studio`, `daylight`, `interior-lamp`, `fire-lit` and `dusk`. Each setup SHALL give the key, fill and rim lights (type, color, intensity and placement relative to the focal subject), the environment and its strength, exposure, and shadow settings.

The skill SHALL state these rules:
- A light source visible in the scene (a lamp, a fire, a window) is the key light and is aimed at the focal subject.
- The focal subject is the brightest area that isn't itself emitting light.
- Hemisphere or ambient light stays at most 0.3 × the key.
- Every object resting on a surface has a contact shadow.
- Objects the scene is about are never inside a group marked `userData.odStage`.

For framing, the skill SHALL:
- direct the page to use `views.heroPortrait` when the canvas aspect is under 1;
- give a fit-to-subject snippet that sets the camera distance along the view direction so the focal subject fills a target share of the frame at the current FOV and aspect;
- tell the agent to show a flat focal object (a sign, a gantry, a screen) 30–55° off its face, never edge-on;
- tell the agent to fix the check's `framing` and `light` warnings before asking for a critique.

#### Scenario: Lamp-lit desk
- **WHEN** the brief is a desk diorama lit by a desk lamp
- **THEN** the skill SHALL direct the `interior-lamp` setup, with a spot light at the lamp head aimed at the focal subject as the key

#### Scenario: Portrait still
- **WHEN** the scene is checked at the mobile viewport
- **THEN** the page SHALL pose `views.heroPortrait` when the spec has one, otherwise the fit snippet's portrait framing

#### Scenario: Prop inside the hall group
- **WHEN** the agent adds a brazier to a hall group marked `userData.odStage`
- **THEN** the skill's rule SHALL direct adding the brazier to the scene, outside the stage group

