## Why

Both sellers come with the material already in hand, and the kit makes them start from a blank brief anyway:

- **The jewelry maker** (https://claude.ai/artifact/5rRkLCGF1roDCUCs4qqjpC) has a brand document, a product list with costs, draft page copy and product photos. They need the same set of pieces for every product: a square product image, a detail card for the listing, and a post for launch day. They also need collection banners and the paper that goes in the parcel (care card, thank-you note, earring display card).
- **The card designer** (https://claude.ai/artifact/KYu5gm3xnWPV3DkNjpwF7X) has card art and a list of cards. They need a frame laid out for name, cost, type, rules text, art and set number; every card filled from the list; one back; and listing images that show the card in a sleeve or fanned out as a set.

The kit already has the hard parts: a style from a source document, one export per spreadsheet row, print checks, social posts. What's missing is a recipe that asks for these materials and runs the steps in the right order. There's also no goal a seller would pick: "Sell or run a small shop" leads to posters and menus for a café, and nothing mentions cards.

## What Changes

- **Two new local recipes** in `packages/content/local/skills/`:
  - `shop-pack`: brand document, product list and photos in. For every product it makes a square product image that frames their own photo (never a generated one), a detail card and a launch post. For the shop it makes a homepage banner, collection banners, an A6 care card, a thank-you card and a business-card-size display card. Product images, detail cards and posts are one design each, filled per row.
  - `card-set`: card art and a card list in. It makes a front frame with marked fields (`name`, `cost`, `type`, `rules`, `art`, `number` and any the user's list has), one back, a proof sheet of the whole set, and shop mockups of a card in a sleeve, in a hand and fanned out as a set. The frame keeps rules text inside the safe area and clear of the rounded corners, and the check finds cards whose text doesn't fit.
- **Start from what they have.** Both recipes begin by asking for the brand document, product or card list and photos or art. A brand document becomes their style through the existing read-source and create-style steps. A spreadsheet's columns are mapped to fields, and the user confirms the mapping once.
- **Private columns stay out.** Columns such as cost, margin and supplier are never placed on a design. The recipe asks before using any column it can't classify as public.
- **Two surfaces and two goals.** Surfaces `shop` (Online shop: product images, banners, inserts) and `cards` (Game cards: card sets for print, with backs and mockups). Goals `sell-online` (Sell online: `shop`, `social`, `email`, `campaign`) and `make-cards` (Make cards to print and sell: `cards`, `social`). The `run-a-shop` goal description is narrowed to local shops, cafés and stalls.
- **Docs**: a guide page "Sell what you make" covering both sellers' flows, and the surface and goal tables.

Not in this change: pushing products or images to a shop (add-shop-handoff), generating product photos or card art, game-specific frames or logos.

## Capabilities

### New Capabilities
- `shop-and-card-recipes`: what the two recipes take in, make, and refuse to do.

### Modified Capabilities
- `design-surfaces`: two new surfaces and two new goals in the catalog.

## Impact

- `packages/content/local/skills/shop-pack/SKILL.md`, `packages/content/local/skills/card-set/SKILL.md` (new), with example artifacts if the catalog convention needs one to be remixable.
- `packages/content/local/surfaces.json`: surfaces and goals; the surface guard covers them.
- Regenerated skill copies for every host (`generate-claude-skills`, codex, VS Code, CLI).
- Depends on add-card-and-shop-formats (sizes) and works better with add-print-house-images (dpi, backs), but each recipe can ship with today's export and gain those later.
