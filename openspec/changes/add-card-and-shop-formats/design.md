## Context

`CanvasFormat` already has everything a print card needs except a corner radius: trim size in mm, bleed, safe inset, minimum type size and a file label. US sizes use `US_BLEED` (0.125 in); ISO sizes use 3 mm. Print exports make a PDF of the bleed box with TrimBox and BleedBox set, and preflight checks the safe area, the bleed size and the type size against the format.

## Decisions

**1. The new formats.** Sizes are trim in mm; bleed is per side.

| id | Label | Trim | Bleed | Safe inset | Corner radius | Min type | fileLabel |
|---|---|---|---|---|---|---|---|
| `a5` | A5 (148×210 mm) | 148 × 210 | 3 | 5 | | 8 pt | `A5` |
| `a6` | A6 (105×148 mm) | 105 × 148 | 3 | 4 | | 7 pt | `A6` |
| `a7` | A7 (74×105 mm) | 74 × 105 | 3 | 3 | | 6 pt | `A7` |
| `postcard-4x6` | Postcard 4×6 in | 101.6 × 152.4 | 3.175 | 4 | | 7 pt | `postcard` |
| `business-card` | Business card (85×55 mm) | 85 × 55 | 3 | 3 | | 6 pt | `business-card` |
| `business-card-us` | Business card 3.5×2 in | 88.9 × 50.8 | 3.175 | 3.175 | | 6 pt | `business-card-us` |
| `trading-card` | Trading card 2.5×3.5 in | 63.5 × 88.9 | 3.175 | 3.175 | 3.175 | 6 pt | `trading-card` |
| `tarot-card` | Tarot card 2.75×4.75 in | 69.85 × 120.65 | 3.175 | 3.175 | 3.175 | 6 pt | `tarot-card` |
| `mini-card` | Mini card 1.75×2.5 in | 44.45 × 63.5 | 3.175 | 3.175 | 3.175 | 5 pt | `mini-card` |

Screen (starting values, confirmed in task 1.1):

| id | Label | Size | Safe inset | fileLabel |
|---|---|---|---|---|
| `shop-product` | Shop product image (square) | 2048 × 2048 px | 96 | `product` |
| `shop-banner` | Shop banner (wide) | 1920 × 800 px | 120 | `shop-banner` |
| `shop-collection` | Collection banner | 1920 × 600 px | 120 | `collection-banner` |

Card formats are `multiCard`, so a set can be designed as several cards in one file. Shop formats are left out of the default shape sheet (`inDefaultSheet: false`), as the banner sizes are.

Sources: trading card 2.5 × 3.5 in with 0.125 in bleed, safe zone and about 1/8 in corner radius (4OVER4 trading card guide); poker card 63.5 × 88.9 mm with 36 px bleed at 300 dpi (Board Games Maker). Tarot and mini sizes are common print-house sizes and are checked in task 1.1.

**2. Corner radius is advice plus a check, never a clip.** The design is authored and exported with square corners: the print house rounds the cut. The canvas section says "the corners are cut round (r = 3.2 mm): keep text and key art at least the safe inset from the trim, and clear of the corners". The preview may draw the rounded trim as a guide. Preflight warns (not errors) when a text element's box overlaps the area between the square trim corner and the radius, inset by the safe inset.

Alternative: clip the card to the rounded shape in the export. Rejected: print houses want square art with bleed, and a clipped corner would leave white in the bleed.

**3. Shop sizes are generic.** One square product size fits Shopify, Big Cartel and Etsy if it is large enough. The labels say "Shop", not a platform name, and the recipe picks among them. Platform-specific sizes are added only if a platform needs one the generic sizes miss.

## Risks / Trade-offs

- [The format list grows to about 40 entries, which is long in tool descriptions] → `formatCatalogSummary()` stays one line per format; group print sizes in the docs table.
- [Shop sizes change over time] → they are screen formats with a source note in the code comment, like the social sizes.
- [The unknown-format scenario in poster-formats uses `a7`, which now exists] → the scenario moves to an id that will never exist.
