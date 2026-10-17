## ADDED Requirements

### Requirement: 3D Hero Framing
When the check renders review views for a page in page mode, it SHALL also measure the page's hero still at each checked viewport:
- **Camera:** the measurement SHALL use the page's own camera after setting that viewport, setting `odScene.rotate = false` and letting the page draw at least three animation frames. Afterwards it SHALL restore `rotate` and the first viewport.
- **Focal subject:** `odScene.focus` when it is an Object3D, otherwise `odScene.subject`, otherwise the review subject (non-stage meshes).

From the projection of the focal subject's world bounding box, it SHALL compute:
- **span and coverage:** the share of the frame's width and height the clamped box spans, and its share of the frame's area;
- **clipping:** the share of the projected box outside the frame, and which edges it crosses, with corners behind the camera counting as outside;
- **edge-on:** for an Object3D focus whose thinnest local extent is under 0.3 × its middle extent, the angle between that local axis in world space and the camera-to-subject direction.

From a screenshot of the canvas, it SHALL compute the mean luma inside and outside the clamped focal rectangle.

It SHALL raise these warnings, tagged by viewport:
- a `framing` warning when the box spans under 20% of both the frame's width and its height, when more than 10% of the projected box is outside the frame, or when a flat focal object is more than 75° from its face;
- a `light` warning when the focal mean luma is under 0.85 × the surrounding mean and the surrounding mean is above 0.08.

It SHALL add one evidence line per viewport stating:
- the focal subject (its name, or that it is the fallback, with a suggestion to set `odScene.focus`);
- its span and clipped edges;
- the edge-on angle when measured;
- the brightness ratio.

`views: false` SHALL skip this measurement.

#### Scenario: Gantry seen edge-on
- **WHEN** a page's `odScene.focus` is a start gantry 7 units wide, 4.7 tall and 0.9 deep, and the hero camera's direction to it is 85° from its 0.9-unit (thin) axis
- **THEN** the check SHALL raise a `framing` warning saying the focal subject is seen edge-on, for each viewport where that holds

#### Scenario: Subject too small on mobile
- **WHEN** the focal subject's projected box spans 12% of the mobile frame's width and 9% of its height, and 25% of the desktop frame's height
- **THEN** a `framing` warning SHALL be raised for mobile only, and both viewports' evidence lines SHALL state the span

#### Scenario: Light leads away from the subject
- **WHEN** the focal chess set's mean luma is 0.24 and the rest of the frame's is 0.33
- **THEN** a `light` warning SHALL be raised that names both values

#### Scenario: Turntable measured as a still
- **WHEN** a page orbits the camera every frame while `rotate` is true
- **THEN** the measurement SHALL be taken with `rotate` false at the hero pose, and `rotate` SHALL be true again after the check

#### Scenario: No focus set
- **WHEN** a page exposes scene handles but no `focus` or `subject`
- **THEN** the measurement SHALL use the non-stage meshes, and the evidence line SHALL suggest setting `odScene.focus`

## MODIFIED Requirements

### Requirement: 3D Evidence
When review views are rendered, the check result SHALL report, as advisory text that is not a finding:
- pixel metrics of the overview view: color entropy in bits, edge density, luminance contrast as p95 − p5, and dominant-color share;
- renderer statistics after the overview render: draw calls, triangles, geometries and textures.

It SHALL report a `webgl-budget` warning when the scene exceeds 300,000 triangles, 400 draw calls or 64 textures, stating that the budget is for software-rendered checks and exports. With a review sheet, the result text SHALL end with a request to critique the design before reporting it done, and that request SHALL tell the critic to treat `framing` and `light` warnings as composition and light flaws. The pixel-metric formula's provenance (adapted from majidmanzarpour/threejs-game-skills, MIT) SHALL be recorded.

#### Scenario: Sparse framing evidence
- **WHEN** the overview of a small object on a flat background is measured
- **THEN** the result text SHALL include its color entropy, edge density, contrast and dominant-color share, and no finding SHALL be raised from those metrics alone

#### Scenario: Critique requested where the agent decides
- **WHEN** a check returns a 3D review sheet with no errors
- **THEN** the result text SHALL say the design isn't done until it passes a critique, and name the scorecard, the pass bar and the three-round limit; and it SHALL tell a critic reading it to score only

#### Scenario: Measurements reach the critic
- **WHEN** a check returns a review sheet together with a `framing` warning
- **THEN** the critique request SHALL say to treat `framing` and `light` warnings as composition and light flaws

#### Scenario: Heavy scene
- **WHEN** the scene renders 450,000 triangles
- **THEN** a `webgl-budget` warning SHALL name the triangle count and the 300,000 budget
