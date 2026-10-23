## Why

In Claude Desktop Chat, everything the kit makes goes under `.open-design/` in the connected folder (`DEFAULT_OUTPUT_DIR` in `packages/mcp-server/src/env.ts`), and exports go one level deeper, in `<design>/exports/`. Finder and File Explorer hide dot folders by default, so a café owner who asked for a poster opens their folder and sees nothing. The managed workspace has the same problem one level down: `~/Open Design/coffee-poster/.open-design/coffee-poster/coffee-poster.html`.

Export names don't help either. A shape export of `seed-swap.html` is `exports/seed-swap-a4.pdf` (`exportFilePathWithSuffix` in `packages/core/src/export/exportArtifact.ts`), and a social export can be `seed-swap-ig-portrait.png`. People who don't know the format ids can't tell which file to send to the print shop.

Developers expect the dot folder: it keeps generated files out of their project's tree, and VS Code, the CLI and the specs all assume it. So the change is scoped to Desktop, where the user is most likely not a developer.

Research: "Ideas Without Code" report (https://claude.ai/artifact/Pg7HrNyTJLTVaSbUi8YCsz), friction row "Find files".

## What Changes

- **Visible layout, Desktop only.** When the workspace was set by `set_open_design_workspace` or `use_open_design_managed_workspace` (the Claude Desktop routes), `OPEN_DESIGN_OUTPUT_DIR` is unset, and the folder has no `.open-design/` with designs in it yet, the server uses the visible layout:
  - designs go under `Open Design/<design>/` in a connected folder;
  - the server's own state (active design system in `config.json`, saved design systems, check history, job files) stays in the hidden `.open-design/`.
  A folder that already has designs in `.open-design/` keeps the old layout, so nothing moves under anyone's feet.
- **Split "designs folder" from "state folder".** The single `outputDir` in the server context becomes two: `designsDir` (where entries, sidecars and exports go) and `stateDir` (always `.open-design`). In the classic layout both are `.open-design`, so behaviour elsewhere is unchanged.
- **One managed folder, one subfolder per design.** In a chat with no folder, `use_open_design_managed_workspace` makes `~/Open Design/` (or the configured managed root) the workspace, and the design goes in `~/Open Design/<name>/`. "Continue the seed swap flyer" in a later chat finds it there. Existing per-design managed folders (`~/Open Design/<name>/.open-design/…`) are reopened as they are.
- **Exports next to the design, with readable names.** In the visible layout, exports go straight into the design's folder (no `exports/` subfolder) and are named `<design>-<size>.<ext>`, where `<size>` is a short label from the format registry: `seed-swap-flyer-A4.pdf`, `seed-swap-flyer-instagram-post.png`, `seed-swap-flyer-story.png`. One export with no size is `<design>.<ext>`. Spreadsheet rows keep their row name: `name-badge-Ana-Lopez.pdf`.
- **Paths in replies.** Tool results in the visible layout give the absolute path of the design folder once, so the agent can say "it's in Documents/Open Design/seed-swap-flyer".
- **Readers follow.** The CLI's `preview` and `export` workspace detection, and the preview server, accept `Open Design/` as well as `.open-design/`. VS Code keeps its `outputDirectory` setting and default.
- **Docs.** The Claude Desktop guide's "Chat with a folder" and "Chat without a folder" sections show the new paths; `docs/reference/settings-and-env.md` explains both layouts and `OPEN_DESIGN_OUTPUT_DIR`.

Not in this change: hiding or relocating the `<entry>.artifact.json` and `<entry>.comments.json` sidecars (they stay next to the entry), migrating existing `.open-design/` folders, changing VS Code or Claude Code defaults.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `open-design-agent-plugins`: workspace persistence gains the visible layout and the designs/state split; the managed workspace becomes one folder with a subfolder per design.
- `artifact-export`: export location and names in the visible layout.

## Impact

- `packages/mcp-server/src/env.ts` (layout detection, `designsDir`/`stateDir`), `src/index.ts` (context construction in `main()`, both workspace tools, result text), `src/store.ts` (config path from `stateDir`), `src/tools.ts` (design-system and job paths from `stateDir`), tests.
- `packages/core`: `exportFilePath` and `exportFilePathWithSuffix` take a layout (or a resolved export directory and naming function); `packages/core/src/poster/formats.ts` gains a `fileLabel` per format; `checkHistory.ts`, `checkArtifact.ts`, `publishArtifact.ts`, `previewServer.ts`, `figmaPull.ts`, `campaignSheet.ts`, `packageArtifact.ts`, `inlineExport.ts`, `siteBundle.ts` take the designs directory they already take as `outputDir`, plus the state directory where they write history.
- `packages/cli/src/exportCommand.ts` and `previewCommand.ts`: workspace detection accepts `Open Design/`.
- Builds on add-folderless-chat-support (managed workspace and `write_open_design_file`, whose allowed area becomes the designs folder) and desktop-set-workspace-tool. Pairs with desktop-first-run-welcome, which tells the user where designs are saved.
