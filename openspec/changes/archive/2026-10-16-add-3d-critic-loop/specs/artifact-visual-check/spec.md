## MODIFIED Requirements

### Requirement: Visual Check Tool
The system SHALL provide a `check_open_design_artifact` tool, taking `entryPath` (required) and optional `viewports`, `slides`, `maxImages` and `views`, that loads a registered HTML-based artifact (`html`, `deck-html`, `mini-app`, `svg`) in the export browser and returns screenshots as image content together with preflight findings. It SHALL NOT write files under the artifact directory or change the artifact manifest. It SHALL wait for render readiness the same way export does.

#### Scenario: Check after generating a landing page
- **WHEN** the agent calls `check_open_design_artifact` on a registered landing page
- **THEN** the result SHALL contain the formatted findings as text and at least one screenshot as image content, and no file SHALL be created or modified

#### Scenario: Unsupported renderer
- **WHEN** the artifact's renderer is `markdown` or `react-component`
- **THEN** the tool SHALL return an `unsupported-kind` error naming the supported renderers

#### Scenario: No browser
- **WHEN** no Chromium-family browser is configured or installed
- **THEN** the tool SHALL return the same structured `no-browser` error as export and SHALL NOT download a browser

### Requirement: CLI Check Command
The `open-design-agent-kit` CLI SHALL provide `check <entryPath>`, accepting `--viewport <name:WxH>` (repeatable), `--slides`, `--max-images`, `--views <list|none>`, `--screenshots <dir>`, `--browser`, `--workspace` and `--fail-on <error|warning>`. It SHALL print the formatted findings and any 3D evidence, write images to `--screenshots` when given, and exit non-zero only on a load or browser failure, or when `--fail-on` is set and a finding at or above that severity exists.

#### Scenario: CI gate
- **WHEN** `check page.html --fail-on error` runs and a `horizontal-scroll` error is found
- **THEN** the findings SHALL be printed and the process SHALL exit non-zero

#### Scenario: Warnings only
- **WHEN** `check page.html` runs without `--fail-on` and finds warnings
- **THEN** the process SHALL exit 0

#### Scenario: Review views to disk
- **WHEN** `check scene.html --views overview,low --screenshots shots` runs on a 3D object that exposes scene handles
- **THEN** a review sheet showing the overview and low views SHALL be written to `shots`

## ADDED Requirements

### Requirement: 3D Review Views
When a checked page exposes `window.odScene.scene`, `camera` and `renderer` after `odScene.ready`, the check SHALL render review views of the scene: `overview` (three-quarter view at about 25° elevation fitted to the subject), `closeup` (closer, aimed at `odScene.focus` or the subject's upper third), `low` (just above the subject's base) and `wireframe` (the overview with non-stage materials in wireframe). The subject SHALL be `odScene.subject` or else the union of mesh bounds excluding meshes marked `userData.odStage = true` and meshes with a `ShadowMaterial`; `odScene.views` entries SHALL override computed views of the same name. Views SHALL be rendered by pausing the page's animation loop and controls and rendering directly, and the camera, controls, materials and loop SHALL be restored afterwards. The views SHALL be returned as one labelled contact-sheet image, placed second in page mode (after the first viewport's first screen and before every other screenshot), with other screenshots filling the remaining image budget. `views` SHALL accept a list of view names or `false`; `false` SHALL return no review sheet. A three.js page without handles SHALL be checked as before, with a note saying which handles enable review views.

#### Scenario: Default 3D check
- **WHEN** a 3D object that exposes scene handles is checked with default options
- **THEN** the images SHALL be the desktop screenshot, then one sheet labelled with the overview, closeup, low and wireframe views, then the mobile screenshot, and findings SHALL cover both default viewports

#### Scenario: Turntable that moves the camera
- **WHEN** the page sets the camera every frame in its animation loop
- **THEN** each review view SHALL still show the camera position the check computed

#### Scenario: Stage excluded from framing
- **WHEN** a chess set stands in a hall whose meshes are marked `userData.odStage = true`
- **THEN** the overview SHALL be fitted to the set, not the hall

#### Scenario: Page without handles
- **WHEN** a three.js page exposes only `odScene.ready`
- **THEN** the check SHALL return today's screenshots and a note naming `odScene.scene`, `odScene.camera` and `odScene.renderer`

### Requirement: 3D Evidence
When review views are rendered, the check result SHALL report, as advisory text that is not a finding, pixel metrics of the overview view (color entropy in bits, edge density, luminance contrast as p95 − p5, and dominant-color share) and renderer statistics after the overview render (draw calls, triangles, geometries, textures). It SHALL report a `webgl-budget` warning when the scene exceeds 300,000 triangles, 400 draw calls or 64 textures, stating that the budget is for software-rendered checks and exports. The pixel-metric formula's provenance (adapted from majidmanzarpour/threejs-game-skills, MIT) SHALL be recorded.

#### Scenario: Sparse framing evidence
- **WHEN** the overview of a small object on a flat background is measured
- **THEN** the result text SHALL include its color entropy, edge density, contrast and dominant-color share, and no finding SHALL be raised from those metrics alone

#### Scenario: Heavy scene
- **WHEN** the scene renders 450,000 triangles
- **THEN** a `webgl-budget` warning SHALL name the triangle count and the 300,000 budget
