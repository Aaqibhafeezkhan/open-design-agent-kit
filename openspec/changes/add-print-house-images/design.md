## Context

The export resolves a viewport from the format (mm to CSS px at 96 per inch) and captures at a device scale factor (`scale`, 1 to 3). Print PDFs are vector and need no dpi. Images of print formats are the gap. The browser can capture at a device scale factor of 6.25 (600 dpi) and more, so the 3 cap is a policy for screen images, not a limit.

## Decisions

**1. `dpi` maps to a device scale factor.** `deviceScaleFactor = dpi / 96`, viewport = bleed box in CSS px, so 300 dpi on a trading card (69.85 × 95.25 mm with bleed) gives 825 × 1125 px. `dpi` applies only to PNG or JPEG of a print format; it is refused with `scale` and on screen formats. The 8192 px limit on either side stays: A0 at 300 dpi fails before rendering, naming the largest dpi that fits.

**2. Exact pixels come from the profile, by resampling a slightly larger capture.** A printer's size rarely matches a dpi exactly. Board Games Maker's 822 × 1122 px is 0.12 in bleed, while the format's 0.125 in gives 825 × 1125. The export captures at the smallest dpi that covers the printer's size, then centre-crops to the exact pixels when the difference is within the bleed, so the trim stays where the printer expects it. When the aspect ratio is off by more than the bleed, it fails with both sizes. Resampling uses sharp, which the kit already uses.

**3. Profile file shape.**

```json
{
  "printHouses": [
    {
      "id": "boardgamesmaker",
      "label": "Board Games Maker",
      "url": "https://www.boardgamesmaker.com/",
      "source": "https://www.boardgamesmaker.com/pops/faq-photo.html",
      "checkedAt": "2026-10-24",
      "formats": [
        { "format": "trading-card", "width": 822, "height": 1122, "type": "png", "dpi": 300 }
      ],
      "backs": "per-card",
      "notes": "Upload one image per face; keep text 36 px inside the cut."
    }
  ]
}
```

`backs` is `per-card` (one back file per front), `shared` (one back for the set) or `none`. The guard fails on a missing source or check date, an unknown format id, a size whose aspect ratio is off by more than the format's bleed, or a duplicate id. Profiles are added only from a printer's own page; the first release ships the one above plus any others confirmed in task 2.1.

**4. Backs live in the same file.** A card with `data-od-side="back"` is that design's back; at most one per front, and the back pairs with the front before it. A design with one back and several fronts uses it for all of them. Naming: `<name>-front.<ext>` and `<name>-back.<ext>`. In the visible layout the names follow the fileLabel rule (`phantasmagoria-trading-card-front.png`). A design with no back exports as today, with no `-front` suffix, so nothing existing changes.

**5. Rows and backs.** A back with no `data-od-field` is static: one file for the whole export. A back with fields is rendered per row. Per-row preflight covers both faces.

## Risks / Trade-offs

- [Printer requirements change] → each profile has a source and a check date. The export result names the source, so the user can check it before ordering.
- [Large dpi exports are slow] → 300 dpi on a card is about 1 MP per face; 60 cards takes well under a minute. The 400-output cap on row exports stays.
- [Crop-to-exact could cut art the user meant to show] → it only ever removes bleed, never trim; it fails rather than cut into the trim.
