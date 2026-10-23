## ADDED Requirements

### Requirement: Readable Export Names in the Visible Layout
In the visible layout, exports SHALL be written in the design's own folder instead of an `exports/` subfolder, named `<design>-<size>.<ext>`, where `<size>` is the format's `fileLabel` from the format registry (for example `A4`, `instagram-post`, `story`), or `<design>.<ext>` when the export has no size. In the classic layout, export paths SHALL stay as they are.

#### Scenario: Print PDF in the visible layout
- **WHEN** the user exports `Open Design/seed-swap-flyer/seed-swap-flyer.html` as a PDF with preset `a4`
- **THEN** `Open Design/seed-swap-flyer/seed-swap-flyer-A4.pdf` SHALL be written and listed in the result

#### Scenario: One file per spreadsheet row
- **WHEN** the user exports name badges with `data` and `nameField: "name"`, and a row's name is "Ana Lopez"
- **THEN** that row's image SHALL be named `name-badge-Ana-Lopez.png` in the design's folder

#### Scenario: Classic layout unchanged
- **WHEN** the same export runs in a Claude Code project
- **THEN** the PDF SHALL be written under `.open-design/seed-swap-flyer/exports/` as before

### Requirement: Row, Index and Shape Sheet Names
In the visible layout, spreadsheet-row exports SHALL add the row name to the export name, multi-image exports SHALL keep their two-digit index, and a shape sheet SHALL be named `<design>-all-sizes.png`.

#### Scenario: Shape sheet
- **WHEN** the user asks to see the seed swap flyer in every size
- **THEN** the sheet SHALL be written as `seed-swap-flyer-all-sizes.png` in the design's folder

### Requirement: Exports Don't Overwrite Other Files
An export SHALL NOT overwrite a file in the design's folder that the manifest doesn't record as an earlier export of that design; it SHALL add `-2` (then `-3`, and so on) to the name instead.

#### Scenario: Name already taken by a supporting file
- **WHEN** `seed-swap-flyer-A4.pdf` exists in the design's folder and isn't recorded as an export
- **THEN** the export SHALL be written as `seed-swap-flyer-A4-2.pdf`
