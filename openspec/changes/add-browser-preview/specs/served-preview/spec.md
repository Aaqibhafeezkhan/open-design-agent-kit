## ADDED Requirements

### Requirement: Bridge Shared With the Browser Preview
The preview bridge and its message protocol SHALL be built from `packages/core/src/preview` for both the VS Code Artifact Preview and the browser preview. The bridge's `select` message SHALL carry the selector from the robust selector strategy (element-comments), the element's text excerpt and its rect in document coordinates. Ids the bridge assigns for Edit patch targeting (`data-od-id="auto-…"`) SHALL NOT be stored in comments and SHALL be removed when the document is serialized for saving.

#### Scenario: Same selector in both hosts
- **WHEN** a user clicks the same element in the VS Code preview and in the browser preview
- **THEN** both SHALL report the same selector

#### Scenario: No invented ids in saved source
- **WHEN** a user comments on an element in the VS Code preview and then saves an Edit elsewhere in the design
- **THEN** the saved file SHALL NOT gain a `data-od-id="auto-…"` attribute on the commented element
