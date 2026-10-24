## Why

The jewelry maker's first question (https://claude.ai/artifact/5rRkLCGF1roDCUCs4qqjpC) was how to make Claude work directly with Shopify "instead of me copying and pasting". Shopify now has its own connector for Claude, which third-party guides say manages products, prices, stock, discounts and orders. Once the kit has made 30 product images and descriptions, though, nothing connects the two. The user downloads every file, opens every product, pastes the copy and drags in the images. The card designer sells on Big Cartel, which has no Claude connector, and faces the same step by hand.

The kit already solves this shape of problem for Canva: `publish_open_design_artifact_to_canva` writes instructions that use the user's connector when it is connected and fall back to manual import steps when it is not. Shops need the same thing.

## What Changes

- **Verify first (task 1).** Before any code, a live check of Shopify's Claude connector: which tools it lists, whether it can attach product images or edit pages, which Claude plans can use it, and whether it can leave products as drafts. The rest of this change depends on what that check finds, and the design marks which parts depend on it.
- **A `shopify` entry in the integration registry**, tier `official-platform`. It records the claude.ai connector name and capability keys, mapping each key to a tool name only once that tool has been verified.
- **`publish_open_design_artifact_to_shop`** (instructions only, on MCP and VS Code), with inputs `entryPaths` (the designs) and `shop` (`shopify`, `bigcartel`, `etsy` or `other`). It exports what is needed and then composes steps:
  - **Shopify connected:** match each exported row to a product by handle or title, show the user the matches, then set each product's description from their copy and attach its images (if the connector can). New products start as drafts, and prices or stock are never changed unless the user asks. The first few changes are made one at a time and checked with the user.
  - **Not connected, or Big Cartel, Etsy and others:** write a hand-off folder with images named by product (`luna-ring-1.png`), a text file of each product's copy, and for Shopify a product import CSV in Shopify's own format, plus the platform's own upload steps in plain words.
- **Docs**: a "Put your designs in your shop" section in the selling guide, and the tool reference.

Not in this change: building a Shopify app or calling Shopify's API ourselves, theme or page editing, order or stock management.

## Capabilities

### New Capabilities
- `shop-handoff`: getting finished shop images and copy into an online shop, through the user's connector or as upload-ready files.

### Modified Capabilities
- `integration-registry`: a Shopify entry.

## Impact

- `packages/content/local/integrations.json`: the `shopify` entry; capability vocabulary gains `shop-products-write` and `shop-images-upload`, or reuses existing keys if they fit.
- `packages/core/src/generation/` (new `shopHandoffInstructions.ts`, modelled on the Canva instructions), the shared tool definition, the MCP and VS Code registrations and schemas, tests.
- Writes the hand-off folder next to the designs, under the existing export rules.
- Builds on add-shop-and-card-set-recipes, whose per-row exports it hands off.
