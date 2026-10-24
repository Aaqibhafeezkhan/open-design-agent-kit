## Context

`publish_open_design_artifact_to_canva` is the model. It composes instructions, checks `list_open_design_integrations` and the agent's own tools for the connector, offers setup once, and otherwise hands over a file with the platform's own steps. Our code never calls the third party. The integration registry records each connector's capabilities with `null` until a tool name is verified.

## Decisions

**1. Verify before designing the connected route.** What third-party guides say Shopify's connector can do (Craftshift, Carly, as of 2026-10-23):

| Can it… | Reported | Plan if yes | Plan if no |
|---|---|---|---|
| Read and update products | yes | match and update descriptions | n/a |
| Create products as drafts | likely | create missing products as drafts | the user creates them; we only update |
| Attach product images | not reported | upload each product's images | images go in the hand-off folder, named for drag and drop |
| Edit pages or themes | not reported | out of scope anyway | n/a |

Task 1 replaces this table with what the connector lists. The spec requirements that depend on image upload say "when the connector can".

**2. Never surprise the store.** The instructions require that the agent:
- shows the product matches before writing anything;
- makes the first three updates one at a time, and the rest only after the user says to continue;
- creates new products as drafts;
- leaves price, stock and visibility alone unless the user asks;
- reports at the end what changed, by product.

This follows the guides' advice to start read-only and check each change.

**3. Hand-off folder, for every shop.** `<design-folder>/for-<shop>/` holds:
- images named `<product-slug>-<n>.<ext>`;
- `copy.md` with one section per product (title, description, price as the user's list gives it);
- for Shopify, `products.csv` in Shopify's product import format (Handle, Title, Body (HTML), Vendor, Variant Price…), with `Image Src` left empty, since that field needs public links.

The steps say how to import the CSV and then drag images into each product. For Big Cartel and Etsy they give each platform's add-product steps, without a CSV.

**4. Matching rows to products.** By `handle` column if the list has one, else a slugified title, else ask. Ambiguous matches are listed for the user to settle; nothing is written for them.

## Risks / Trade-offs

- [The connector's tools or limits change] → the registry entry has `verifiedAt` and `toolsVerified`, as other entries do; the instructions find the tools at run time instead of assuming names.
- [Writing to a live store from a chat] → the stepwise confirmation and drafts-only defaults above; the tool itself writes nothing to the store.
- [Shopify's CSV format changes] → the CSV columns are generated from one list with a source link, and a test pins the header.
