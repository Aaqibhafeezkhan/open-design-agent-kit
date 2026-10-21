## 1. Protocol and page

- [x] 1.1 `protocol.ts`: `ShowTarget` and `PreviewAppState` gain `examples`, `design-systems` and `campaign`; pick message builders (`remixExampleMessage`, `useDesignSystemMessage`, `saveTileMessage`, `fixCampaignPieceMessage`)
- [x] 1.2 `main.ts`: examples grid (filter chips, lazy card previews, "Remix this"), design-system tiles with a detail frame ("Use this design system"), campaign tiles with error dots ("Fix this piece", open a page-type piece in the artifact view)
- [x] 1.3 Exploration view: "Use as design system" on style-tile explorations
- [x] 1.4 `appCss.ts`: grid and tile styles; check light and dark host themes

## 2. Server

- [x] 2.1 `preview/server/mcpApp.ts`: state builders for examples (paged list, one example preview), design systems (tiles, one visualize page) and campaign (sidecar plus exported images)
- [x] 2.2 `exportArtifact.ts`: write `exports/campaign-sheet.json` next to the PNG
- [x] 2.3 `index.ts`/`tools.ts`: `show_open_design_examples`, `show_open_design_design_systems` (listed only to MCP Apps hosts), `campaign` on `show_open_design_artifact`, new targets on `get_open_design_preview_state`
- [x] 2.4 Resource CSP: include remote origins of shown examples

## 3. Content and docs

- [x] 3.1 Skills: overview (remix and design-system pick), `open-design-new`, `open-design-campaign` step 6; drift check
- [x] 3.2 `docs/guides/inline-preview.md` (pickers, corrected "Where" table), `remix-and-gallery.md`, `campaigns.md`, `docs/reference/tools.md`

## 4. Tests and verification

- [x] 4.1 Scripted MCP client: the two show tools listed only with the UI extension; text fallback without it; app-only targets return paged state
- [x] 4.2 Unit tests: pick messages, campaign sidecar shape, example preview size cap
- [x] 4.3 Reference host in the browser: each pick posts the expected message; campaign tile opens the artifact view
- [ ] 4.4 Claude Desktop, plugin install, local Cowork or Chat with a folder: gallery, design systems, style tiles, campaign sheet (needs a server release past the 0.1.8 pin)
