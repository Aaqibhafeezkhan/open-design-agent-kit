## MODIFIED Requirements

### Requirement: Named Canvas Format Catalog
The system SHALL provide one catalog of named canvas formats, shared by brief preparation, export, adaptation and the workflow prompts. Each format SHALL define a stable kebab-case id, a label, a medium (`screen` or `print`), width and height with a unit (`px` for screen, `mm` trim for print), a safe inset, and as applicable a bleed, a minimum type size, a corner radius (print), a byte budget (screen) and a default recipe.

#### Scenario: Social formats match the existing workflow
- **WHEN** the catalog entry `ig-portrait` is read
- **THEN** it SHALL be a screen format of 1080×1350 px with an 8000000-byte budget and default recipe `od:prototype:poster-hero`

#### Scenario: Print format carries print parameters
- **WHEN** the catalog entry `a3` is read
- **THEN** it SHALL be a print format of 297×420 mm with a bleed and a minimum type size

### Requirement: Formats Are Discoverable
The system SHALL let the agent see the available format ids and their sizes without guessing. The `prepare_open_design_brief`, `export_open_design_artifact` and `adapt_open_design_artifact` tool descriptions SHALL list the format ids, and an unknown id SHALL produce an error that lists the valid ids.

#### Scenario: Unknown format id
- **WHEN** any tool is called with `format` or `preset` `"a9-sticker"`
- **THEN** the call SHALL fail with a message listing the valid format ids

## ADDED Requirements

### Requirement: Required Formats
The catalog SHALL contain at least: the social formats from the social-post workflow; the print formats A0 to A7 (A5, A6 and A7 new), US Letter, Tabloid, 18×24 in, 24×36 in, a 4×6 in postcard and business cards in ISO and US sizes; the card formats trading card (2.5×3.5 in), tarot card (2.75×4.75 in) and mini card (1.75×2.5 in); and the screen formats shop product image, shop banner and collection banner.

#### Scenario: Trading card
- **WHEN** the catalog entry `trading-card` is read
- **THEN** it SHALL be a print format of 63.5×88.9 mm with a 3.175 mm bleed, a safe inset and a 3.175 mm corner radius

#### Scenario: Shop product image
- **WHEN** the catalog entry `shop-product` is read
- **THEN** it SHALL be a square screen format with the file label `product`

### Requirement: Rounded Corners in Canvas Instructions
When a print format has a corner radius, both the fixed and the fluid canvas sections SHALL state the radius, that the print house cuts the corners round, that the design keeps square corners with full bleed, and that text and key art stay clear of the corners.

#### Scenario: Trading card brief
- **WHEN** a brief is prepared with `format: "trading-card"`
- **THEN** the canvas section SHALL mention the 3.2 mm corner radius and keeping text clear of the corners, and SHALL NOT tell the agent to round the card itself
