## MODIFIED Requirements

### Requirement: Campaign Collection and Sheet
Campaign pieces SHALL be registered into one collection with `screenRole` set to their channel, and the flow SHALL finish by writing `exports/campaign-sheet.png`: every exported shape plus the first screen of each page-type piece, labelled, with a red dot on any piece that has preflight errors. Next to it the export SHALL write `exports/campaign-sheet.json` listing each tile in sheet order with its label, its shape preset id or member entry path, the exported file it shows (when there is one) and its error findings.

#### Scenario: Sheet shows a failing banner
- **WHEN** the `banner-mobile` export has an `overflow` error
- **THEN** its tile on the campaign sheet SHALL carry the error dot

#### Scenario: Sidecar matches the sheet
- **WHEN** a campaign export writes `exports/campaign-sheet.png` with seven tiles
- **THEN** `exports/campaign-sheet.json` SHALL list the same seven tiles in the same order, with the `banner-mobile` tile carrying its `overflow` finding
