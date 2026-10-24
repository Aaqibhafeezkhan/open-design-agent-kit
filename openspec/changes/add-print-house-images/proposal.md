## Why

The card designer in https://claude.ai/artifact/KYu5gm3xnWPV3DkNjpwF7X sends finished cards to a print house that prints and ships them to buyers. Card print houses mostly take one image per card face at an exact pixel size, not a PDF. For example, Board Games Maker asks for a poker card of at least 822 × 1122 px: 750 × 1050 px at 300 dpi plus 36 px bleed on each side. Most double-sided orders also need a back for every card, or one back for the whole set.

Today the kit can't make those files:

- **No print resolution for images.** A PNG export of a print format renders the bleed box at 96 CSS px per inch times `scale`, and `scale` stops at 3, which is 288 dpi. There's no way to ask for 300 dpi, or for the exact pixels a printer names.
- **No printer requirements.** The user has to look up each printer's sizes and type them in as `width` and `height`, which breaks the bleed.
- **No card backs.** A design is one face. With a spreadsheet of 60 cards, the export makes 60 fronts and nothing for the back.

The jewelry maker in https://claude.ai/artifact/5rRkLCGF1roDCUCs4qqjpC has the same problem in a smaller way: sticker and card printers that take images want 300 dpi.

## What Changes

- **`dpi` for image exports of print formats.** A PNG or JPEG export of a print format renders the bleed box at the given dpi (default 300, from 150 to 600), whatever the `scale` cap. The result states the pixel size and dpi and writes the dpi into the PNG metadata. Too large a result (A0 at 300 dpi) fails before rendering and names the largest dpi that fits.
- **Print-house profiles.** A new content file, `print-houses.json`, lists card and sticker printers. Each one gives the formats it takes, the exact upload size in pixels, the file type, how it wants backs, and a source link with a check date. `export_open_design_artifact` accepts `printHouse: "<id>"`. It picks the matching format, renders at the size the printer names, and fails clearly when the design's format isn't one the printer takes. The content guard checks every profile.
- **Card backs.** A design may mark a second card as the back with `data-od-side="back"`. An image export then writes `<name>-front.png` and `<name>-back.png`. With spreadsheet rows, a back with no row fields is written once as `<base>-back.png`, and a back that uses row fields is written per row. A PDF export puts each back after its front, for duplex printing, unless the printer's profile says otherwise.
- **Docs**: the print guide gets a "Send cards to a print house" section and the export reference documents `dpi`, `printHouse` and backs.

Not in this change: uploading to a print house, CMYK conversion (the RGB note stays), imposing many cards on one sheet.

## Capabilities

### New Capabilities
- `print-house-profiles`: a checked list of printers' file requirements, used by export.

### Modified Capabilities
- `print-export`: image exports of print formats at a dpi, and to a print house's exact size.
- `bulk-export`: fronts and backs with spreadsheet rows.

## Impact

- `packages/core/src/export/exportSize.ts` and `exportArtifact.ts`: the `dpi` and `printHouse` options, validation, device scale above 3 for print images, back-side capture and naming, and PNG pHYs metadata.
- `packages/content/local/print-houses.json` (new), loaded by `ContentIndex`, checked by a new guard in `packages/content/scripts/`.
- Tool schemas (MCP server, `packages/vscode/package.json`), CLI `export` flags `--dpi` and `--print-house`, docs.
- Depends on add-card-and-shop-formats for the card formats.
