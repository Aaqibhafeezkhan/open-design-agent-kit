## ADDED Requirements

### Requirement: Backs With Rows
In a data-bound export, a back with no `data-od-field` SHALL be written once for the whole export as `<base>-back.<ext>`, and a back with fields SHALL be filled and written per row. Per-row preflight SHALL check both faces, and each finding SHALL say which face it is on.

#### Scenario: Card set with a shared back
- **WHEN** a trading card with a static back is exported as PNG from a 60-row spreadsheet
- **THEN** 60 front images and one back image SHALL be written

#### Scenario: Numbered backs
- **WHEN** the back has a `data-od-field="number"` element
- **THEN** a back image SHALL be written for every row, filled from that row
