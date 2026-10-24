## ADDED Requirements

### Requirement: Shopify Entry
The integration registry SHALL contain a `shopify` entry with tier `official-platform`, its claude.ai connector name, capability keys for updating products and uploading product images, each mapped to a verified tool name or `null`, the caveat that it writes to a live store, and a manual fallback pointing to the shop hand-off folder.

#### Scenario: Image upload not verified
- **WHEN** the connector's image tool hasn't been verified
- **THEN** the entry SHALL map the image capability to `null` and `toolsVerified` SHALL be false
