## Why

Two real sellers asked how to use Claude to run a small creative business, and both hit the same wall: the kit has no size for what they make.

- **A jewelry maker opening a Shopify store** (handmade stainless steel, made to order) needs square product images, store banners, and small printed pieces for the parcel: care cards, thank-you notes, earring display cards. Report: https://claude.ai/artifact/5rRkLCGF1roDCUCs4qqjpC.
- **A card designer** makes proxy and alt-art cards for Grand Archive, has a print house print and ship them, and sells on Big Cartel. They need a trading card at 63.5 × 88.9 mm with bleed, rounded corners and a safe area. Report: https://claude.ai/artifact/KYu5gm3xnWPV3DkNjpwF7X.

The format catalog (`packages/core/src/poster/formats.ts`) goes from social sizes in pixels straight to A4 and up in print. Its smallest print size is A4, it has no card sizes, and it has no shop image sizes. Print exports, bleed, crop marks, safe-area and minimum-type checks all exist; they only lack the sizes. Cards also have rounded corners, which no check knows about, so a set number or cost placed in a corner gets cut.

## What Changes

- **Small print formats**: A5, A6, A7, 4 × 6 in postcard, and business card in ISO (85 × 55 mm) and US (3.5 × 2 in) sizes. The business card size also covers jewelry display cards and swing tags.
- **Card formats**: standard trading card (2.5 × 3.5 in, the size sleeves are made for), tarot (2.75 × 4.75 in) and mini (1.75 × 2.5 in), with US bleed, a safe inset, and a new `cornerRadius` (1/8 in).
- **Shop image formats**, as screen formats: a square product image, a wide shop banner, and a collection banner. The exact pixel sizes are confirmed against Shopify's, Big Cartel's and Etsy's help pages before they ship (task 1.1). The design names starting values.
- **`cornerRadius` in the catalog and the canvas instructions.** A format may set a corner radius in mm. The canvas section says to keep text and key art clear of the rounded corners, and the preview can show the rounded trim.
- **Corner clearance check.** Preflight gains `corner-clearance`, a warning for text whose box enters a rounded corner's cut area inside the trim.
- **File labels** for every new format, so exports beside the design read `luna-ring-product.png`, `care-card-A6.pdf`, `phantasmagoria-trading-card.png`.
- **Docs**: the format table in `docs/reference/` and the poster guide list the new sizes.

Not in this change: exporting card images at a print house's pixel size, card backs (add-print-house-images), recipes that use these sizes (add-shop-and-card-set-recipes).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `poster-formats`: the catalog gains small print, card and shop sizes, and an optional corner radius.
- `export-preflight`: a corner clearance check for formats with rounded corners.

## Impact

- `packages/core/src/poster/formats.ts`: new entries, `cornerRadius` on `CanvasFormat`, the canvas section text; unit tests (the fileLabel uniqueness test covers the new labels).
- `packages/core/src/export/artifactPreflight.ts` (or wherever the safe-area check lives): `corner-clearance`; tests.
- Tool descriptions that list format ids pick the new ones up from `formatCatalogSummary()`.
- `packages/vscode/package.json` schema enums that list format ids, if any; docs.
