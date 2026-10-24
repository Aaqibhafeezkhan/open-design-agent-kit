## ADDED Requirements

### Requirement: Start From the Seller's Material
The `shop-pack` and `card-set` recipes SHALL first ask for the material the user already has: a brand document, a product or card list, and photos or art. A given brand document SHALL become the user's style through the existing source and style steps before any design is made.

#### Scenario: Brand document given
- **WHEN** a user starts `shop-pack` and attaches a brand document
- **THEN** the agent SHALL make their style from it and use that style for every piece

### Requirement: Confirmed Field Mapping
Each recipe SHALL map the list's columns to design fields and show the mapping to the user in plain words before designing. Every repeated piece SHALL be one design with fields, exported once per row.

#### Scenario: Thirty products
- **WHEN** the product list has 30 rows
- **THEN** each piece SHALL be one design exported with the list as data, giving 30 files per piece

### Requirement: Private Columns Never Shown
The recipes SHALL never bind a column for cost, margin, supplier, wholesale price or internal notes to a design field, and SHALL ask the user before using a column they can't classify.

#### Scenario: Cost column
- **WHEN** the product list has `price` and `cost` columns
- **THEN** `price` MAY be bound to a field and `cost` SHALL NOT appear on any design

### Requirement: Real Products and the User's Art
Product images SHALL frame the user's own photos, and card designs and mockups SHALL use the user's own frame and art. The recipes SHALL NOT generate product photos or card art, and SHALL NOT include frames, logos or icons from published games.

#### Scenario: No photos yet
- **WHEN** the user has no product photos
- **THEN** the agent SHALL lay out the images with marked photo slots and ask for the photos, rather than generating any

### Requirement: Card Set Outputs
The `card-set` recipe SHALL make a front design with fields, one back, and a proof sheet showing every card from the same data. It SHALL keep text inside the safe area and clear of rounded corners, and SHALL run the per-row check so that cards whose text doesn't fit are reported by name.

#### Scenario: Rules text too long
- **WHEN** one card's rules text overflows its box
- **THEN** the check SHALL report that card by its name, and the other cards SHALL still be exported
