# Sell what you make

From a list of what you sell and your own photos or art, make everything a small shop or a card game needs, all in one style: product images, a store banner, a card for the parcel, posts, or a full card set ready for the print house. Each piece is one design filled in for every product or card, so a new product or a fixed typo is a re-export, not a redesign.

## Before you start

- A list: one row per product or card, as a CSV or a spreadsheet. The agent can write it with you if you don't have one.
- Your photos or art in a folder. The agent frames your real photos and lays out your own art; it never generates product photos or card art.
- An installed Chrome, Edge or Chromium, for checking and exporting ([why](export-images.md#before-you-start)).

## Start

Ask in your own words: "I sell handmade jewelry on Shopify, here's my product list and photos, make my product images and a care card", or "I design cards for my board game and print at Board Games Maker, here's the card list".

The agent asks what you already have: your brand or style (a brand document, a logo, your site), the list, and the photos or art. A brand document becomes [your style](design-systems.md) first, and every piece uses it. In the [design picker](../reference/tools.md#surfaces) these are **Online shop** and **Game cards**, under the goals **Sell online** and **Make cards to print and sell**.

## Your list and its columns

Before designing, the agent reads the list's header row and shows, in one short list, which column goes where: `title`, `price` and `photo` on the product image, `name`, `cost` and `rules` on a card. It waits for your OK.

- **Private columns stay private.** A column for cost, margin, supplier, wholesale price, stock or notes is never put on a design or in your shop.
- A column it can't place gets one question, rather than a guess.
- Photo and art columns hold file paths. If there are none, the agent asks you to put each product's photo in `photos/`, named after it, and fills the column itself.

## Your shop

| Piece | Format | One per product |
|---|---|---|
| Product image | `shop-product` (2048×2048 px) | yes |
| Store banner | `shop-banner` (1920×800 px) | no |
| Collection header | `shop-collection` (1920×600 px) | one per collection |
| Care or thank-you card for the parcel | `a6`, `business-card`, `postcard-4x6` (print) | optional |
| Launch post | `ig-portrait`, `ig-square` | for new products |

Every product image uses the same crop, background and label, so the shop looks like one brand. Consistent photos (same light, same background) matter more than the design. The parcel card exports as a [print-ready PDF](posters.md#print-ready-pdfs), or as images at 300 dpi.

Each piece is checked for every product before export: a title too long for its box is named by product. Then one export gives one file per product, named after it. See [one per row from a spreadsheet](posters.md#one-per-row-from-a-spreadsheet).

## Game cards

The front is one design at the card's size, with the art and frame running into the bleed and the name, cost and rules inside the safe area. Printers cut card corners round, so the check warns when a cost or icon sits in a corner (`corner-clearance`).

- **The back** is a second card in the same file, `data-od-side="back"`. It's written once for the whole set, unless the printer wants one back per card.
- **Long rules text** shrinks a little to fit, never below the minimum type size. A card that still doesn't fit is named in the check, so you can shorten it.
- **The proof sheet** shows every card small on one page, from the same list, so you can spot a wrong cost or a typo before paying for a print run.
- **Mockups** for your shop or socials put the exported fronts in a sleeve, a hand or a fan, drawn in HTML and CSS.

Card sizes are `trading-card` (2.5×3.5 in, poker size), `tarot-card` and `mini-card`. To send them to the printer, see [Send cards to a print house](posters.md#send-cards-to-a-print-house): with a printer the kit knows, such as Board Games Maker, each face comes out at its exact upload size.

The agent uses only your frame and art, never frames, logos or icons from published games. You're responsible for what you print and sell.

## Put your designs in your shop

When the images are done, the agent offers to put them in your shop with [`publish_open_design_artifact_to_shop`](../reference/tools.md#publish_open_design_artifact_to_shop). It never changes your shop without asking.

- **Shopify, with its connector.** If you've connected Shopify in Claude (**Settings > Connectors**), the agent matches your list to your store's products and shows you the matches before changing anything. It updates the first three products one at a time, waiting for your go-ahead each time, creates new products only as drafts, and leaves prices, stock and visibility as they are unless you ask. At the end it lists what changed. Whether the connector can attach images hasn't been checked yet; if it can't, the agent gives you the images to drag in.
- **Every shop, by hand.** Otherwise the agent writes a folder next to your designs, `for-shopify/` (or `for-bigcartel/`, `for-etsy/`), with each product's images named after it, `copy.md` with each product's title, price and description, and for Shopify a `products.csv` to import. The agent gives you your shop's own steps: for Shopify, **Products > Import** with the CSV (products arrive unpublished), then drag each product's images into **Media**.

## What you get

```
.open-design/product/product.html                   ← one product image design
.open-design/product/exports/product-luna-ring.png  ← one per product
.open-design/product/for-shopify/luna-ring-1.png    ← named for the shop
.open-design/product/for-shopify/copy.md
.open-design/product/for-shopify/products.csv
.open-design/cards/cards.html                       ← front and back
.open-design/cards/exports/cards-goblin-front.png   ← each face, at the printer's size
.open-design/cards/exports/cards-back.png
```

## Related

[Posters and print](posters.md) · [Social media posts](social-posts.md) · [Connect other services](integrations.md) · [Design systems](design-systems.md)
