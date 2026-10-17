# artifact-visual-check Specification

## Purpose
Let the agent see what it built: render a registered artifact in the export browser and return size-capped screenshots plus preflight findings, for pages across viewports (with a horizontal-scroll check), card designs at their format size, and decks slide by slide, plus a review sheet and 3D evidence for three.js scenes that expose their handles, delivered natively as images on every host, from the CLI, and as a check-before-done step in the agent instructions.
## Requirements
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

### Requirement: Page Checks Across Viewports
For page artifacts with no `[data-od-card]` element, the tool SHALL check each viewport in `viewports`, defaulting to desktop 1440×900 and mobile 390×844. It SHALL run the preflight checks and the `horizontal-scroll` check at each viewport, tag each finding with the viewport name, and return at least one screenshot per viewport within the image limit. For artifacts with `[data-od-card]` elements, it SHALL check each card at its own size, as export does, and ignore `viewports`.

#### Scenario: Default viewports
- **WHEN** a page with no card is checked without `viewports`
- **THEN** findings SHALL be tagged `desktop` or `mobile`, and the images SHALL include one labelled `desktop` and one labelled `mobile`

#### Scenario: Card artifact
- **WHEN** an Instagram-portrait poster with one `data-od-card` is checked
- **THEN** one image of the card at 1080×1350 (downscaled per the image limit) SHALL be returned and no viewport tags SHALL appear

### Requirement: Horizontal Scroll Check
In viewport checks, the system SHALL report `horizontal-scroll` when the document is wider than the viewport by more than 1 px, naming the element that extends furthest past the right edge. It SHALL ignore elements inside containers whose `overflow-x` is `auto` or `scroll`, and fixed-position elements moved off-screen with a transform. Severity SHALL be `error` for viewports up to 480 px wide and `warning` otherwise. Card and poster exports SHALL NOT run this check.

#### Scenario: Fixed-width table on a phone
- **WHEN** a page contains a 900 px-wide table and is checked at the mobile viewport
- **THEN** a `horizontal-scroll` error tagged `mobile` SHALL name the table

#### Scenario: Intentional carousel
- **WHEN** the only content wider than the viewport sits inside an `overflow-x: auto` container
- **THEN** no `horizontal-scroll` finding SHALL be reported

### Requirement: Per-Slide Deck Checks
For `deck-html` artifacts, the tool SHALL step through the slides with the deck capture navigation, run preflight on each slide, tag findings with their 1-based slide number, and return the slides as a contact-sheet image of at most 12 slides. `slides` SHALL select which slides to check, validated like export's slide numbers. When the slide count can't be determined, it SHALL check the page as a single view and add a warning saying so.

#### Scenario: Text overflow on slide 4
- **WHEN** slide 4 of a 10-slide deck has a clipped paragraph
- **THEN** an `overflow` finding tagged slide 4 SHALL be returned, along with one contact-sheet image of slides 1–10

#### Scenario: Large deck
- **WHEN** a 30-slide deck is checked without `slides`
- **THEN** all 30 slides SHALL be preflighted, the contact sheet SHALL show slides 1–12, and the text SHALL say how to pass `slides` to see the others

### Requirement: Bounded Image Cost
Each returned image SHALL have a long edge of at most 1568 px and SHALL be JPEG encoded. A call SHALL return at most `maxImages` images (default 3, maximum 6); `maxImages: 0` SHALL return findings only. When images are dropped to meet the limit, the text SHALL list what was omitted.

#### Scenario: Tall page, default limit
- **WHEN** a 6000 px-tall page is checked at the two default viewports
- **THEN** at most 3 images SHALL be returned, each with a long edge of at most 1568 px, and the text SHALL note the parts that were not included

#### Scenario: Findings only
- **WHEN** the tool is called with `maxImages: 0`
- **THEN** no image content SHALL be returned and the findings SHALL be complete

### Requirement: Images Delivered Natively per Host
The VS Code tool SHALL return the findings text as a `LanguageModelTextPart` followed by one `LanguageModelDataPart.image` per screenshot. The MCP server SHALL return a `text` content item followed by one `image` content item (base64 data with its MIME type) per screenshot. The text part SHALL always contain the complete findings, so a client that ignores images still gets the full check.

#### Scenario: MCP client
- **WHEN** an MCP client calls `check_open_design_artifact`
- **THEN** the response content SHALL start with a `text` item and contain one `image` item per screenshot, with `mimeType: "image/jpeg"`

#### Scenario: Other MCP tools unchanged
- **WHEN** any other tool is called on the MCP server
- **THEN** its response SHALL be the same single `text` content item as before

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

### Requirement: Check-Before-Done Guidance
The instructions shipped to every host (VS Code chat instructions, the Claude Code and Codex `open-design` skills) SHALL tell the agent to call `check_open_design_artifact` after creating or substantially editing an artifact and before reporting it as done; to fix every `error`; to review the images for composition problems the checks can't measure; to stop after at most two fix rounds and tell the user about any remaining findings, except that for a 3D design with a review sheet the agent SHALL run the critique the check result asks for, for up to three critique rounds; and, when the result is `no-browser`, to skip the check and tell the user once that visual checking needs Chrome, Edge or Chromium.

#### Scenario: Instruction sources stay in sync
- **WHEN** the instruction files are generated or checked for drift
- **THEN** each host's instructions SHALL contain the check-before-done guidance naming `check_open_design_artifact`

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

