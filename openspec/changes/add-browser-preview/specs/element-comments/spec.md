## ADDED Requirements

### Requirement: Robust Element Selector
When a comment is created in either preview, its `selector` SHALL be the first of these that matches exactly one element in the document: a unique, non-generated `id`; a stable attribute present in the source (`data-od-id`, `data-testid`, `data-od-node`, `data-od-slide`, `name`, `aria-label`); tag plus non-utility classes, scoped under the nearest ancestor anchored this way; the positional `nth-of-type` chain. `elementId` SHALL be set only when the element's `data-od-id` exists in the source; the preview SHALL NOT invent ids for comments.

#### Scenario: Element with a unique id
- **WHEN** the user comments on `<section id="pricing">`
- **THEN** the comment's selector SHALL be `section#pricing`

#### Scenario: Utility classes are skipped
- **WHEN** the user comments on a button whose classes are `btn-primary px-4 md:px-6`
- **THEN** the selector SHALL NOT contain `md:px-6` and SHALL match only that button

#### Scenario: Nothing stable
- **WHEN** the element has no id, stable attribute or distinguishing class
- **THEN** the selector SHALL be the `nth-of-type` chain, and `elementId` SHALL be absent

### Requirement: Comment Context Fields
Each new comment SHALL record, in addition to the existing fields: `text`, the element's whitespace-collapsed text, at most 120 characters; `rect`, its box in document coordinates in CSS pixels; `viewport`, the preview viewport size; and, when a crop was captured, `screenshot`, the crop's path relative to the entry's folder. The fields SHALL be optional when read, so sidecars written before this change stay valid.

#### Scenario: Old sidecar
- **WHEN** a sidecar written before this change is read
- **THEN** its comments SHALL load, show their pins when they resolve, and be returned by `get_open_design_artifact`

### Requirement: Cropped Element Screenshot
When a comment is saved in the browser preview, the system SHALL save a PNG of the element plus 24 CSS pixels of surrounding context, clamped to the viewport, long edge at most 800 px, with no preview highlight or pin in it, to `<entry>.comments/<commentId>.png`. In a browser window it drives, it SHALL capture what the user sees. Otherwise it SHALL re-render the entry headless at the comment's viewport and mark the comment's crop as re-rendered. Without any Chromium-family browser it SHALL save the comment without a crop. Deleting a comment SHALL delete its crop.

#### Scenario: Crop of the visible state
- **WHEN** the user opens a tab in the design and comments on an element inside it, in an app window
- **THEN** the saved crop SHALL show that element with the tab open and SHALL NOT show the selection highlight

#### Scenario: Default browser
- **WHEN** the preview runs in the default browser and a Chromium-family browser is installed
- **THEN** the comment SHALL get a crop re-rendered headless and SHALL be marked as re-rendered

#### Scenario: No browser for crops
- **WHEN** no Chromium-family browser is available
- **THEN** the comment SHALL be saved with selector, text and rect and without `screenshot`

### Requirement: Safe Concurrent Sidecar Writes
Every writer of `<entry>.comments.json` (VS Code preview, browser preview, MCP tools) SHALL read, merge by comment `id` keeping the later `updatedAt`, and write atomically through a temporary file and rename. A preview SHALL send only the comments it changed.

#### Scenario: Two previews add comments
- **WHEN** a comment is added in the VS Code preview and another in the browser preview of the same entry at about the same time
- **THEN** the sidecar SHALL contain both comments

### Requirement: Resolving Comments
`register_open_design_artifact` SHALL accept an optional `resolvedCommentIds` and mark those comments `resolved` in the entry's sidecar. Unknown ids SHALL be reported in the result and SHALL NOT fail the registration.

#### Scenario: Agent addresses a comment
- **WHEN** the agent fixes the element a comment points at and re-registers the artifact with that comment's id in `resolvedCommentIds`
- **THEN** the comment's status SHALL be `resolved` and it SHALL no longer appear in `openComments`
