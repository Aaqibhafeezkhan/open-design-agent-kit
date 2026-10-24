## ADDED Requirements

### Requirement: Print-House Profile Catalog
The content SHALL include a print-house catalog. Each profile SHALL have an id, a label, a website, a source page for its requirements, a check date, one or more format entries (catalog format id, exact width and height in px, file type, dpi), and a backs rule (`per-card`, `shared` or `none`).

#### Scenario: Profile read back
- **WHEN** the profile `boardgamesmaker` is read
- **THEN** it SHALL give `trading-card` at 822×1122 px PNG, 300 dpi, with its source page and check date

### Requirement: Print-House Build Guard
The content check SHALL fail on a profile with no source or check date, a format id not in the format catalog, a pixel size whose aspect ratio differs from the format's bleed box by more than the bleed allows, or a duplicate id, naming the profile and the problem.

#### Scenario: Wrong aspect ratio
- **WHEN** a profile lists `trading-card` at 1000×1000 px
- **THEN** the content check SHALL fail naming that profile and the size

### Requirement: Print Houses Are Discoverable
The agent SHALL be able to list the print-house profiles (id, label, formats) through a tool, so it can offer the user's printer by name and say when their printer isn't listed.

#### Scenario: Printer not listed
- **WHEN** the user names a printer with no profile
- **THEN** the listing SHALL let the agent see that, and the agent can export at 300 dpi and tell the user to check the printer's size
