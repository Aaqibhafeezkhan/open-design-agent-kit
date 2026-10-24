## ADDED Requirements

### Requirement: Corner Clearance Check
When the export's format has a corner radius, preflight SHALL report a `corner-clearance` warning for each text element whose box comes closer than the safe inset to the rounded trim edge at a corner (the quarter circle of the format's corner radius). The warning SHALL name the element and the corner. Other formats SHALL get no such finding.

#### Scenario: Cost printed in the corner
- **WHEN** a trading card has its cost text 1 mm from the top-left trim corner
- **THEN** preflight SHALL report a `corner-clearance` warning naming that element and the top-left corner

#### Scenario: Text well inside
- **WHEN** every text element on a trading card sits at least 6 mm from the trim
- **THEN** preflight SHALL report no `corner-clearance` finding
