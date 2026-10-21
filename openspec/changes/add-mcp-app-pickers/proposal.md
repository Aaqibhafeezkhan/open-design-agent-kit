## Why

add-mcp-app-preview shipped (PR #7) an MCP App that shows one artifact, or an exploration's directions, inline in a host that renders MCP Apps. The kit has three other moments where the person has to choose from pictures, and today all three are text or a PNG:

- **Remix examples.** The agent picks a starting example from `list_open_design_skills` (`remixableOnly`) or from `references/remixable-examples.md` (193 entries, text only) and calls `remix_open_design_example` (`packages/mcp-server/src/index.ts`, `tools.remixExample` in `packages/mcp-server/src/tools.ts`). The only visual gallery is in VS Code (`docs/guides/remix-and-gallery.md`).
- **Design systems.** `list_open_design_design_systems` returns names, summaries and an `active` flag; the person picks a brand look from words, then `set_active_design_system` or `prepare_open_design_brief` sets it. Core already renders a design system from its tokens (`packages/core/src/generation/designSystemPreview.ts`, `designSystemVisualize.ts`, `vendored/designSystemShowcase.ts`), but only VS Code shows it.
- **Style tiles.** A style-tile exploration (`openspec/specs/style-tiles`) already renders in the exploration view, but its "Take this one" message (`pickDirectionMessage` in `packages/core/src/preview/mcpApp/protocol.ts`) asks a generic next-step question, while a tile pick almost always means `choose_open_design_direction` with `next: "save-design-system"`.
- **Campaign sheet.** `export_open_design_artifact` with `campaignSheet: true` composes `exports/campaign-sheet.png` (`packages/core/src/export/exportArtifact.ts`, the `composeShapeSheet` call). Each tile's label, source and error count exist only in memory during the export, so nothing can show the sheet interactively or say which tile needs fixing.

## What Changes

- **One resource, more views.** `ui://open-design/preview` keeps being the only UI resource. `ShowTarget` and `PreviewAppState` (`protocol.ts`) gain three views: `examples`, `design-systems` and `campaign`. The page (`packages/core/src/preview/mcpApp/main.ts`) gets one renderer per view and keeps its toolbar, fullscreen, reload and transport.
- **Two new model-visible show tools,** both declaring the preview resource: `show_open_design_examples` (`query`, `mode`, `surface`) and `show_open_design_design_systems` (`query`, `category`, or `ids` for a shortlist). They are listed only to hosts that render MCP Apps (same filter as the app-only tools, `index.ts` `ListToolsRequestSchema` handler); a call from any other host gets a short text list and a pointer to the `list_*` tool.
- **Campaign view on the existing tool.** `show_open_design_artifact` gains `campaign: true` for a fluid master: the page shows every tile of its last campaign sheet, with error dots and messages, and opens a page-type piece in the artifact view.
- **Campaign sheet sidecar.** The export also writes `exports/campaign-sheet.json` (tile label, shape preset or member entry path, exported file, error findings), so the view and the agent read the same facts as the PNG.
- **App-only reads, chat-message picks.** The page loads catalog pages, example previews, design-system previews and campaign tiles through `get_open_design_preview_state` (app-only), so the model's context never holds them. Every pick ("Remix this", "Use this design system", "Save this tile as the design system", "Fix this piece") is sent as a chat message through the bridge, and the agent calls the real tool. The page calls no model-visible tool that changes state.
- **Style-tile picks.** For an exploration made with `od:design-system:style-tile`, the direction card offers "Use as design system", whose message names `choose_open_design_direction` with `next: "save-design-system"`.
- **Skills and docs.** The overview, `open-design-new` and `open-design-campaign` skills call the show tools where the host renders MCP Apps. `docs/guides/inline-preview.md` gains the pickers and a corrected "Where" table: a plugin's local MCP server is ignored by plain Chat (claude.com/docs/plugins/platform-support, via `/mnt/project-files/desktop-research/install-landscape.md` §4), so the inline pages render only where our server runs and the host renders MCP Apps.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `mcp-app-preview` (introduced by add-mcp-app-preview, not yet archived): added picker views, two show tools, the campaign view, the pick hand-off rule, style-tile picks and the documented reach.
- `campaign-kit`: Campaign Collection and Sheet also writes `exports/campaign-sheet.json`.

## Impact

- `packages/core/src/preview/mcpApp/protocol.ts` (targets, states, pick messages), `mcpApp/main.ts` and `appCss.ts` (three renderers), `preview/server/mcpApp.ts` (state builders for each view).
- `packages/core/src/export/exportArtifact.ts` (sheet sidecar).
- `packages/mcp-server/src/index.ts` and `src/tools.ts` (two tools, `campaign` on `show_open_design_artifact`, new targets on `get_open_design_preview_state`, list filter).
- Skills: `packages/claude-plugin/skills/{open-design,open-design-new,open-design-campaign}/SKILL.md` and their CLI/`.agents` copies (drift check in `packages/claude-plugin/scripts/check-skills-sync.mjs`).
- Docs: `docs/guides/inline-preview.md`, `docs/guides/remix-and-gallery.md`, `docs/guides/campaigns.md`, `docs/reference/tools.md`.
- Depends on add-mcp-app-preview being archived first (its `mcp-app-preview` spec), and on a server release past the plugin's 0.1.8 pin to reach plugin users.
