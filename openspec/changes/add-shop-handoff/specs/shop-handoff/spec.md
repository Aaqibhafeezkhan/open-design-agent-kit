## ADDED Requirements

### Requirement: Shop Hand-off Instructions
`publish_open_design_artifact_to_shop` SHALL be available on the MCP server and the VS Code extension, with inputs `entryPaths` and `shop` (`shopify`, `bigcartel`, `etsy` or `other`). It SHALL export what the hand-off needs and compose instructions without contacting the shop. For `shopify` it SHALL tell the agent to look for Shopify's connector through `list_open_design_integrations` and its own tools.

#### Scenario: Big Cartel
- **WHEN** the tool is called with `shop: "bigcartel"`
- **THEN** the instructions SHALL give the hand-off folder route with Big Cartel's add-product steps, and SHALL NOT mention a connector

### Requirement: Careful Store Changes
When Shopify's connector is connected, the instructions SHALL require the agent to show the product matches first, make the first three updates one at a time with the user's go-ahead, create new products only as drafts, leave price, stock and visibility unchanged unless asked, and report what changed per product. Images SHALL be attached only when the connector can do so.

#### Scenario: Prices untouched
- **WHEN** the product list's prices differ from the store's
- **THEN** the instructions SHALL tell the agent to leave prices as they are and mention the difference to the user

#### Scenario: Ambiguous match
- **WHEN** two store products match one row
- **THEN** the agent SHALL ask which one, and SHALL write nothing for that row until the user answers

### Requirement: Upload-Ready Hand-off Folder
Without a connected shop connector, or when the user declines one, the tool SHALL write a hand-off folder next to the designs with images named `<product-slug>-<n>.<ext>` and a `copy.md` with one section per product; for Shopify it SHALL also write `products.csv` in Shopify's product import format with image links left empty. The instructions SHALL give the shop's own upload steps in plain words.

#### Scenario: Shopify without the connector
- **WHEN** the tool is called with `shop: "shopify"` and the connector isn't connected or setup is declined
- **THEN** the folder SHALL contain the images, `copy.md` and `products.csv`, and the steps SHALL cover importing the CSV and dragging in the images
