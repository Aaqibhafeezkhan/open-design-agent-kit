## 1. Formats

- [x] 1.1 Confirm the shop image sizes (Shopify, Big Cartel, Etsy help pages) and the tarot and mini card sizes (two print houses each); note the sources in a code comment
- [x] 1.2 `formats.ts`: add the twelve formats from design.md, with file labels; card formats `multiCard`; shop formats `inDefaultSheet: false`
- [x] 1.3 `CanvasFormat.cornerRadius` (mm, print only); the fixed and fluid canvas sections mention it; tests for a trading card brief
- [x] 1.4 Update the poster-formats unknown-id scenario and any test that uses `a7` as an unknown id

## 2. Check

- [x] 2.1 Preflight `corner-clearance` warning for text entering a rounded corner; tests with a cost in the top-left corner and with text well inside
- [ ] 2.2 Preview: draw the rounded trim as a guide when the format has a corner radius (optional, behind the existing trim guide) (Not done in this pass: the corner check covers it, and the preview guide can follow.)

## 3. Docs

- [x] 3.1 Format reference table and poster guide: the new sizes, grouped (small print, cards, shop)
- [x] 3.2 Schema enums in `packages/vscode/package.json` that list format ids, if any; `node scripts/check-docs.mjs` passes
