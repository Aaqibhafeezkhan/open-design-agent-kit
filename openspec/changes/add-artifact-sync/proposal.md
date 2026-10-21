## Why

A design in progress lives in the workspace as files: the entry HTML, its `.artifact.json` manifest, preview comments, supporting files and, for a custom design system, its `DESIGN.md` (`docs/reference/artifact-manifest.md`). Those files are only on the machine, or in the session, that made them. The private Claude artifact the agent already keeps as each design's preview (add-artifact-preview, add-claude-artifact-provider) is stored in the person's claude.ai account and opens on any device. Today it holds only the exported page, so another device, a new Claude Code cloud session, or a chat with no folder can show the design but can't carry on editing it. The add-claude-artifact-provider proposal listed this "optional sync" as out of scope and not yet proposed.

Two facts limit the design:
- **The kit's server can't reach artifacts.** There is no public API for creating or reading them, so publishing and reading go through Claude's own Artifact tool. The agent does both; the server only prepares files and reads files the agent hands it, the same as `publish_open_design_artifact` does now (`packages/core/src/generation/publishArtifact.ts`).
- **An artifact page is at most 16 MB** (`ARTIFACT_MAX_BYTES` in `packages/core/src/export/artifactPreflight.ts`). The preview page already uses part of that, and a 3D page with embedded assets can use most of it (`packages/core/src/export/embedAssets.ts`).

## What Changes

- **Opt-in sync on artifact publish.** `publish_open_design_artifact` with `provider: "claude-artifact"` accepts `sync: true`. The standalone page then also carries a **sync bundle**: one `<script type="application/od-sync+json" id="od-sync">` block holding the design's working files. These are the entry file, its manifest, its `.comments.json`, the supporting files the manifest lists, and the `DESIGN.md` of a `user:` design system. Text files are stored as plain text and binary files as base64, each with its path and SHA-256. The setting is kept in the manifest (`metadata.sync`), so later preview publishes keep the bundle up to date until `sync: false`.
- **Left out of the bundle.** `exports/` and `.od-figma.json` can be made again. Share records' claim URLs are removed, and source documents outside the folder are listed by path and hash but not copied.
- **Within the 16 MB budget.** The bundle counts toward the artifact preflight's size. When page plus bundle would go over 16 MB, the page is published **without** the bundle and the instructions say why. Sync never blocks the preview.
- **A notice in the instructions.** Anyone the artifact is shared with can read the bundle, and earlier versions keep it. The instructions say this the first time sync is on.
- **New tool `restore_open_design_artifact`.** The agent reads the artifact with its Artifact tool, which saves the full page to a local file. The agent then passes that file's path and the artifact URL. The tool checks the bundle and writes the files into the workspace's output directory under their original paths. Paths that leave the output directory are refused. A local file that differs from the bundle is not overwritten unless `overwrite: true`. The tool records the artifact as the entry's `claude-artifact` share, so the next preview publish updates the same artifact.
- **Edited outside the kit.** In a chat with no folder the kit's local server doesn't run. Plugins in Chat load skills and remote MCP only (`/mnt/project-files/desktop-research/install-landscape.md` §6). There the skills tell Claude to read the entry from the bundle, edit it, and republish the page with the bundle's entry replaced and its hash removed. A later restore accepts that entry and reports it as edited outside the kit.
- **Skills and docs.** Claude-only skill guidance (the `<!-- claude-only -->` blocks in `packages/content/scripts/localPrompts.mjs`) covers when to offer sync, how to restore on another device or in a cloud session, and the folderless-chat fallback. Docs cover the share-and-publish guide, the tools reference and the manifest reference.

Not in this change: syncing a whole exploration folder (`exploration.json`, `compare.html`), syncing exports, merging two edited copies, and sync without Claude artifacts.

## Capabilities

### New Capabilities
- `artifact-sync`: the sync bundle carried by a published Claude artifact, its budget and privacy rules, and restoring a design from it.

### Modified Capabilities
None. The `claude-artifact` provider's requirements are still in the unarchived add-claude-artifact-provider change. This change adds to that provider through `artifact-sync` and does not restate those requirements.

## Impact

- `packages/core`:
  - new `workspace/artifactSync.ts` collects, encodes, parses and checks the bundle. It reuses `readArtifact` and `supportingFiles` from `vendored/artifactCreate.ts`, the comments path from `workspace/artifactComments.ts`, and the JSON-block approach of `export/embedAssets.ts`.
  - `generation/publishArtifact.ts` (`prepareArtifact`): `sync` option, bundle injection, and the over-budget fallback.
  - `generation/publishInstructions.ts` (`composeArtifactPublishInstructions`): the sync notice and the dropped-bundle note.
  - `export/artifactPreflight.ts`: the size check counts the bundle.
  - new `generation/restoreArtifact.ts`; `workspace/shareRecords.ts` (`validatePublished`) is reused to record the restored artifact's URL.
- `packages/mcp-server/src/index.ts`: `sync` on `publish_open_design_artifact` (tool at line 924) and the new `restore_open_design_artifact` tool. In VS Code it is not offered: its chat has no Artifact tool, as with the `claude-artifact` provider.
- Content: the shared instruction source and the generated Claude plugin and CLI skills (`open-design`, `open-design-publish`). Codex and VS Code output is unchanged.
- Docs: `docs/guides/share-and-publish.md`, `docs/reference/tools.md`, `docs/reference/artifact-manifest.md` (`metadata.sync`).
- No new dependencies and no network requests from the kit.
