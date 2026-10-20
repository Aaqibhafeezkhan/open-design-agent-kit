## Why

Once a design lives as a Claude artifact (add-claude-artifact-provider, add-artifact-preview), reviewers can act on the page itself instead of in a repo. The "Publishing designs as Claude artifacts" thread (20 Oct 2026) found two native fits:

- **Comments.** People an artifact is shared with inside a Team or Enterprise org can comment on the page, and Claude can read and reply to those threads (and a comment sent to Claude wakes the session). That suits people who don't work in a repo. Pro and Max can't share inside an org, so they keep the local `.comments.json`.
- **Direction picks.** An exploration's comparison page can store each reviewer's pick in the artifact's own database, which Claude reads directly.

The kit's server can't reach artifacts, so as elsewhere the agent carries data between the artifact and the kit's tools. The doc ranks this last ("Later", medium), because it needs the provider and preview first.

## What Changes

- **Import artifact comments into the sidecar.** New MCP tool `import_open_design_comments` taking `entryPath`, `source: "claude-artifact"`, the artifact URL and a list of comments (`externalId`, author, text, optional anchor with selector and text excerpt, created time). It merges them into `<entry>.comments.json` by `externalId` (status `open`, `source` and `threadUrl` kept), so `get_open_design_artifact` and the existing resolve flow (`resolvedCommentIds`) work unchanged.
- **Guidance.** The Claude skills tell the agent: when a comment on the design's artifact reaches it, or the person says reviewers commented, read the threads with its artifact comments tool, import them, apply the changes, republish the preview, then reply in each thread with what changed and resolve it.
- **Artifact anchors.** The standalone export for `claude-artifact` keeps `data-od-id` attributes so artifact comment anchors map back to elements in the source.
- **Direction picks.** For an exploration published as an artifact, the comparison page gets a "pick this direction" control per direction that writes `{ direction, reviewer, note }` to the artifact database (declared through the publish instructions). The skill tells the agent to read the picks, show the tally, and call `choose_open_design_direction` with the person's final choice. The kit never picks on the reviewers' behalf.

## Capabilities

### New Capabilities
- `artifact-review`: importing artifact comments into the sidecar, replying and resolving, and direction picks stored in the artifact.

### Modified Capabilities
None in the main specs. (The comment record's `source`/`externalId` fields extend the record introduced by add-browser-preview's `element-comments`; if that change is archived first, this becomes a MODIFIED delta there.)

## Impact

- `packages/core`: comment record fields (`source`, `externalId`, `threadUrl`), merge by `externalId` in `updateArtifactComments`; comparison page template gains the pick control behind an `artifact` flag.
- `packages/mcp-server`: `import_open_design_comments`. VS Code: not exposed (no artifact tools there).
- Content: Claude skills (`open-design`, `open-design-explore`). Docs: preview and comments guide, explorations guide, tools reference.
- Availability: comments need Team or Enterprise org sharing; picks need artifact database support on the account. Both stay optional.
