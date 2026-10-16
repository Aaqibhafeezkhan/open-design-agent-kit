## MODIFIED Requirements

### Requirement: 3D Review Views
When a checked page exposes `window.odScene.scene`, `camera` and `renderer` after `odScene.ready`, the check SHALL render review views of the scene: `overview` (three-quarter view at about 25° elevation fitted to the subject), `closeup` (closer, aimed at `odScene.focus` or the subject's upper third), `low` (just above the subject's base) and `wireframe` (the overview with non-stage materials in wireframe). The subject SHALL be `odScene.subject` or else the union of mesh bounds excluding meshes marked `userData.odStage = true` and meshes with a `ShadowMaterial`; `odScene.views` entries SHALL override computed views of the same name. In every view except `wireframe`, stage meshes whose bounds lie between the review camera and its target SHALL be hidden for that view, so a wall or backdrop never blocks the subject. Views SHALL be rendered by pausing the page's animation loop and controls and rendering directly, and the camera, controls, materials and loop SHALL be restored afterwards. The views SHALL be returned as one labelled contact-sheet image, placed second in page mode (after the first viewport's first screen and before every other screenshot), with other screenshots filling the remaining image budget. `views` SHALL accept a list of view names or `false`; `false` SHALL return no review sheet. A three.js page without handles SHALL be checked as before, with a note saying which handles enable review views.

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

#### Scenario: A hall wall between the low camera and the set
- **WHEN** a chess set stands in a hall whose side wall, marked `userData.odStage = true`, lies between the computed low-view camera and the set
- **THEN** the low view SHALL show the set, with that wall hidden for the view and shown again afterwards
