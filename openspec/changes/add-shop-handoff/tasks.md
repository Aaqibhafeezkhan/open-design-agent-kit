## 1. Verify

- [ ] 1.1 Connect Shopify's Claude connector to a development store; record its tool list, whether it can attach images, create drafts and edit pages, and which Claude plans can use it (Not done: needs a Shopify development store connected in Claude. Capabilities stay null until then.)
- [ ] 1.2 Update design.md decision 1 with the findings, and trim the spec's conditional parts accordingly (Waits on 1.1.)

## 2. Registry

- [x] 2.1 `integrations.json`: `shopify` entry (tier, claude.ai connector name, capability keys with verified tool names or `null`, caveats, manual fallback); registry guard passes; generated integration docs updated

## 3. Tool

- [x] 3.1 `shopHandoffInstructions.ts`: connected route (match, confirm, stepwise updates, drafts, report) and hand-off route; tests for each shop value
- [x] 3.2 Hand-off folder writer: images named by product, `copy.md`, Shopify `products.csv` with a pinned header; tests
- [x] 3.3 Register `publish_open_design_artifact_to_shop` on MCP and VS Code; schemas; tool reference docs

## 4. Docs and verification

- [x] 4.1 Selling guide: "Put your designs in your shop"
- [ ] 4.2 Development store: 5 products updated through the connector with confirmations; the hand-off folder imported by CSV (Waits on a development store.)
