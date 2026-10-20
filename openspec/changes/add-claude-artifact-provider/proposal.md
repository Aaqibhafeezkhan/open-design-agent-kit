## Why

In Claude Code and Claude Desktop, the natural place to look at and share a design is a Claude artifact, not a file path. The "Publishing designs as Claude artifacts" thread (20 Oct 2026) tested it: the kit's Swiss deck example published unchanged as a private artifact and rendered. There is no public API for creating artifacts (the Compliance API only lists and deletes), so the kit's server can't publish one. Claude has to, with its own Artifact tool. That matches how `publish_open_design_artifact` already works: the tool prepares a bundle and returns instructions, and the agent acts.

Artifacts have rules the kit has to respect: one page of at most 16 MB; scripts only from cdnjs, jsDelivr `/npm/`, unpkg, the Tailwind CDN and the jQuery CDN; stylesheets only from Google Fonts; images, data and other files from any other site blocked; no downloads or print dialog from the page. They exist only in Claude Code and the Desktop app, on Pro, Max, Team or Enterprise, signed in to claude.ai. Copilot, Codex, Cursor and API-key sessions don't have them, so files on disk stay the source of truth.

## What Changes

- **New provider `claude-artifact`** for `publish_open_design_artifact`:
  - builds the `standalone` export (`exports/<name>.html`) instead of the `site` bundle, since an artifact is one page;
  - runs an **artifact preflight** on it: total size against 16 MB (warning from 12 MB), and every remaining remote reference against the artifact viewer's allowed hosts, each blocked one reported with its URL and what will break;
  - returns instructions to publish that file **by path** with the Artifact tool (so the page doesn't pass through the model's context), to update the recorded artifact URL when one exists, and to give the user the link;
  - says the artifact is private until the user shares it from claude.ai, so no public-visibility confirmation is needed; the badge is off by default for this provider;
  - is offered in the provider choice only with a note that it needs Claude Code or Claude Desktop with an Artifact tool.
- **Share record.** The agent records the URL with `published: { provider: "claude-artifact", url }`; the next publish updates the same artifact as a new version.
- **Skills.** The Claude plugin's overview and `publish` command offer the artifact link first when the agent has an Artifact tool. PNG, PDF and PPTX exports stay local files.
- **Docs.** "Share and publish" guide and the tools reference.

Not in this change: the in-progress preview loop (add-artifact-preview), embedding 3D assets (embed-3d-assets-for-artifacts), artifact comments (add-artifact-comment-review), and syncing sidecars through an artifact (the "optional sync" idea, not yet proposed).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `artifact-publishing`: Publish Instructions Tool gains the `claude-artifact` provider and the artifact preflight; Explicit Confirmation excludes private artifacts; Share Records accept `claude-artifact` records keyed by URL.

## Impact

- `packages/core`: `generation/publishInstructions.ts` (new recipe), new `export/artifactPreflight.ts` (allowed-host list, size budget), `workspace/shareRecords.ts` (provider enum).
- `packages/mcp-server` and `packages/vscode`: the tool's `provider` enum.
- `packages/content/local/prompts/publish.md`, generated skills; `docs/guides/share-and-publish.md`, `docs/reference/tools.md`.
- No new dependencies. The allowed-host list must be kept in step with Claude's artifact viewer; it lives in one constant.
