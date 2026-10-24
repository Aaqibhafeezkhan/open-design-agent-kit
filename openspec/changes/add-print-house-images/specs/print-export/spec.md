## ADDED Requirements

### Requirement: Print Images at a Resolution
A PNG or JPEG export of a print format SHALL render the bleed box at `dpi` (default 300, allowed 150 to 600) and SHALL record that dpi in the image metadata. `dpi` SHALL be refused together with `scale` and for screen formats. An export whose either side would exceed 8192 px SHALL fail before rendering, naming the largest dpi that fits.

#### Scenario: Trading card at 300 dpi
- **WHEN** a `trading-card` design is exported as PNG with no `dpi`
- **THEN** the image SHALL be 825×1125 px with 300 dpi in its metadata, and the result SHALL state both

#### Scenario: A0 too large
- **WHEN** an `a0` design is exported as PNG with `dpi: 300`
- **THEN** the export SHALL fail before rendering and name the largest dpi that fits in 8192 px

### Requirement: Export to a Print House's Size
`export_open_design_artifact` SHALL accept `printHouse` naming a print-house profile. It SHALL use the profile's entry for the design's format, write the profile's file type at its exact pixel size by removing only bleed, and name the profile's source in the result. A format the printer doesn't take SHALL fail, listing the formats it does take.

#### Scenario: Card for Board Games Maker
- **WHEN** a `trading-card` design is exported with `printHouse: "boardgamesmaker"`
- **THEN** a PNG of exactly 822×1122 px SHALL be written, with the trim centred, and the result SHALL link the printer's requirements page

#### Scenario: Wrong format for the printer
- **WHEN** an `a4` design is exported with `printHouse: "boardgamesmaker"`
- **THEN** the export SHALL fail, naming `trading-card` as the format that printer takes

### Requirement: Card Backs
A card marked `data-od-side="back"` SHALL be the back of the front card before it, or of every front when the design has one back. Image exports SHALL write `<name>-front.<ext>` and `<name>-back.<ext>`. A PDF export SHALL place each back after its front unless the print-house profile says otherwise. A design with no back SHALL export as before.

#### Scenario: Front and back
- **WHEN** a trading card design with a front and a back is exported as PNG
- **THEN** two files SHALL be written, one ending `-front.png` and one ending `-back.png`
