## 1. Print resolution

- [x] 1.1 `exportArtifact.ts`: `dpi` option (150–600, default 300 for PNG/JPEG of print formats); refused with `scale` or on screen formats; device scale = dpi / 96; 8192 px limit message names the largest dpi that fits; tests
- [x] 1.2 Write the dpi into PNG metadata (pHYs) and JPEG density; result text gives pixels and dpi

## 2. Print-house profiles

- [x] 2.1 `packages/content/local/print-houses.json` with Board Games Maker; add others only from their own pages (MakePlayingCards, a sticker printer), with source and check date (Only Board Games Maker so far: the others need their own pages checked.)
- [x] 2.2 Guard script: missing source or date, unknown format, aspect ratio off by more than the bleed, duplicate id; wire into the content checks; tests
- [x] 2.3 `ContentIndex.listPrintHouses()` / `getPrintHouse()`; core mirrors the guard
- [x] 2.4 `printHouse` export option: pick the profile's format, capture, centre-crop to the exact pixels within the bleed, fail on a format the printer doesn't take; tests with 822 × 1122
- [x] 2.5 `list_open_design_print_houses`, or a `printHouses` field on an existing listing tool, so the agent can offer them (pick the smaller option during implementation) (Chose a small `list_open_design_print_houses` tool.)

## 3. Backs

- [x] 3.1 `data-od-side="back"`: pair backs with fronts; `-front` / `-back` names in both layouts; designs with no back unchanged; tests
- [x] 3.2 Rows: a static back written once, a back with fields per row; per-row preflight on both faces
- [x] 3.3 PDF: back after each front (duplex) unless the profile says `shared` or `none`

## 4. Hosts and docs

- [x] 4.1 MCP and VS Code tool schemas, CLI `--dpi` and `--print-house`
- [x] 4.2 Print guide: "Send cards to a print house"; export reference: `dpi`, `printHouse`, backs; docs check passes
