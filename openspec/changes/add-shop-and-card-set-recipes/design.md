## Context

A local recipe is a `SKILL.md` with frontmatter (name, descriptions, triggers, `od.mode`, craft requirements) and a body the agent follows. Surfaces list recipe ids in `surfaces.json`, and goals list surfaces. Data-bound export fills `[data-od-field]` elements per row, preflight runs per row, and a fluid design can be exported at several shapes per row.

## Decisions

**1. One design per piece, filled per row.** The product image, the detail card and the post are each one design with fields, exported with the product list as `data`, not one design per product. That keeps 30 products in one style and makes a change to the list a re-export, not a redesign. The same holds for card fronts.

**2. Field mapping is confirmed once.** The recipe reads the list's header row (CSV or XLSX), proposes a mapping to fields (`title`, `price`, `material`, `photo`…; `name`, `cost`, `rules`…), and shows it to the user in plain words before designing. Photo and art columns hold workspace-relative paths. When the list has no photo column, the recipe asks the user to put photos in a folder named after each product and fills the column itself.

**3. Public and private columns.** Columns whose header names a cost, margin, supplier, wholesale price or note are private: never bound to a field. A column the recipe can't classify triggers one question listing it. This is recipe text plus a rule in the recipe's checklist, not code.

**4. The user's photos and art, framed.** Product images frame the photo on a background from their style (crop, padding, shadow, a short label), so the jewelry is the real piece. Card mockups place the exported front into an HTML/CSS sleeve, hand or fan; no image generation. Both recipes say so to the user when they offer mockups.

**5. Proof sheet.** `card-set` makes a contact-sheet design showing every card small, from the same data, so the user can spot a wrong cost or a typo before paying for a print run.

**6. Surfaces and goals.**

| Surface | Label | Entries | Questions |
|---|---|---|---|
| `shop` | Online shop | `shop-pack` | What do you sell, and where (Shopify, Big Cartel, Etsy, other)? Do you have a product list and photos? |
| `cards` | Game cards | `card-set` | Which game or card size, and which print house? Do you have the card list and art? |

| Goal | Label | Surfaces |
|---|---|---|
| `sell-online` | Sell online | `shop`, `social`, `email`, `campaign` |
| `make-cards` | Make cards to print and sell | `cards`, `social` |

## Risks / Trade-offs

- [Proxy cards for published games raise IP questions] → the recipe never ships official frames, logos or icons; it lays out the user's own frame and art, and says once that the user is responsible for what they print and sell.
- [Long rules text in small cards] → the frame uses fluid type steps within the format's minimum type size; the check flags overflow per row so the user can shorten a card.
- [Photos at different sizes and lighting] → the product image design crops to cover and sets a consistent background; the recipe tells the user once that consistent photos matter more than design.
