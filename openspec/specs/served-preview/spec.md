# served-preview Specification

## Purpose
How the VS Code artifact preview loads a design (from a loopback server, or as an embedded copy) and how Comment, Edit and Export → Figma reach the page through a preview-only bridge.
## Requirements
### Requirement: Served Preview
When `openDesign.experimental.servedPreview` is true (default false), the artifact preview SHALL load the design from a loopback HTTP server started for that preview. The server SHALL:
- bind to `127.0.0.1`;
- serve only files inside the design's workspace folder;
- require a random path token of at least 128 bits on every request;
- serve the entry document from the editor's current buffer;
- close when the preview closes.

The preview SHALL reach the server through `vscode.env.asExternalUri`. If the server can't start, the preview SHALL fall back to the embedded copy and log a warning.

#### Scenario: Inline handlers work
- **WHEN** a design wires its tabs with inline `onclick` attributes and the setting is on
- **THEN** clicking a tab in the preview's View mode SHALL run the handler, as it does in a browser

#### Scenario: Token required
- **WHEN** a request reaches the preview server without the preview's path token
- **THEN** the server SHALL respond 404 and serve no file

#### Scenario: Unsaved edits are shown
- **WHEN** the design's editor buffer has unsaved changes
- **THEN** the served entry SHALL reflect the buffer, not the file on disk

### Requirement: Preview Bridge
Every artifact preview, served or embedded, SHALL inject a preview-only bridge script into the design. The preview SHALL use it, over `postMessage`, for everything Comment, Edit and Export → Figma need from the page:
- pick mode;
- hover and selection;
- element rectangles;
- element snapshots;
- comment pin positions;
- applying an edit patch and returning the serialized source;
- Figma capture.

The bridge and anything it adds to the page SHALL be marked preview-only and SHALL NOT appear in saved source.

#### Scenario: Comment on a served page
- **WHEN** the setting is on and the user clicks an element in Comment mode
- **THEN** the element SHALL be highlighted, the comment input SHALL open, and the saved comment SHALL carry that element's id, selector and HTML hint

#### Scenario: Edit on a served page
- **WHEN** the setting is on and the user changes an element's text in Edit mode and saves
- **THEN** the design's file SHALL contain the new text and SHALL NOT contain the bridge script or any other preview-only element

#### Scenario: Highlights follow scrolling
- **WHEN** an element is selected and the user scrolls the design
- **THEN** the selection highlight and comment pins SHALL stay aligned with their elements

#### Scenario: Figma capture on a served page
- **WHEN** the setting is on and the user chooses Export → Figma
- **THEN** the capture SHALL be taken from the served page and sent to the extension

#### Scenario: Same behaviour on the embedded copy
- **WHEN** the setting is off
- **THEN** Comment, Edit and Export → Figma SHALL work through the bridge on the embedded copy, with the same results as before this change

### Requirement: Bridge Messages Are Untrusted
The preview SHALL accept bridge messages only from its own iframe's window. It SHALL act on a patch result or capture result only when the reply's request id matches a request the preview sent and hasn't yet settled. It SHALL send a page-supplied source to the extension only in response to a user action that issued that request. Strings from the page SHALL be escaped before being shown.

#### Scenario: Unsolicited patch result
- **WHEN** the design's own script posts a `patched` message with a new source that the preview never requested
- **THEN** the preview SHALL ignore it and the design's file SHALL NOT change

#### Scenario: Message from another frame
- **WHEN** a frame nested inside the design posts a bridge message
- **THEN** the preview SHALL ignore it

### Requirement: Embedded Copy Where the Bridge Doesn't Reach
With the setting on, the preview SHALL use the embedded copy while Tweaks is open or when the design is a fluid poster. It SHALL use the served page otherwise, including in Comment and Edit modes.

#### Scenario: Comment mode stays served
- **WHEN** the setting is on and the user switches from View to Comment
- **THEN** the preview SHALL keep showing the served page

#### Scenario: Tweaks uses the embedded copy
- **WHEN** the setting is on and the user opens Tweaks
- **THEN** the preview SHALL show the embedded copy until Tweaks is closed

### Requirement: Bridge Availability
If the bridge doesn't report ready after a page loads, the preview SHALL show Comment and Edit as unavailable for that page with a short explanation, instead of letting clicks do nothing.

#### Scenario: Page blocks the bridge
- **WHEN** a design's own script prevents the bridge from starting
- **THEN** choosing Comment or Edit SHALL show that they are unavailable for this design

### Requirement: Edit Writes Only Changed Styles
When the user saves in the Edit panel, the preview SHALL include in the style patch only the Style fields whose value the user changed from the prefilled one.

#### Scenario: Text-only edit
- **WHEN** the user changes only an element's text in the Edit panel and saves
- **THEN** the saved element SHALL have the new text and SHALL NOT gain any inline style

