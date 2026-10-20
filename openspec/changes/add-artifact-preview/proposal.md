## Why

In the Claude Code terminal and in Claude Desktop, the person gets a file path after each design step. The VS Code preview isn't there, and the browser preview (add-browser-preview) needs a local browser window. Iven's suggestion in the "Publishing designs as Claude artifacts" thread (20 Oct 2026): have the agent keep a private Claude artifact as a light preview of each design while it works. It is the cheapest way to put a person in the loop in Claude's runtime: one tool call, nothing to install, and an open tab updates in place when the agent republishes to the same URL. The thread's recommendations doc ranks it first ("Build first", small).

## What Changes

- **Guidance, not a new tool.** When the agent has an Artifact tool, the skills tell it to keep one private artifact per design as its preview:
  - publish after the first draft is registered, after each round of feedback, and for an exploration's comparison page; not after every small edit;
  - publish with `publish_open_design_artifact` and `provider: "claude-artifact"` (from add-claude-artifact-provider), which packages the standalone file and records the URL, so later publishes are new versions of the same artifact;
  - give the link once, then just say it was updated;
  - take feedback in chat; comments on the preview are handled by add-artifact-comment-review.
- **Hints from tools.** `register_open_design_artifact` on MCP mentions the artifact preview when the client is Claude and no `claude-artifact` record exists yet. `get_open_design_artifact` returns the recorded preview URL.
- **Guarded.** The skill text is conditional ("if you have an Artifact tool"), so Copilot, Codex, Cursor and VS Code behave as today. The preview stays private, so it needs no confirmation and carries no badge.
- **Same artifact for sharing.** When the person wants to share, they share the preview from claude.ai; there is no second artifact.

Builds together with add-claude-artifact-provider (the tool side) and embed-3d-assets-for-artifacts (so 3D scenes preview too).

## Capabilities

### New Capabilities
- `artifact-preview`: when and how the agent keeps a private Claude artifact preview of a design, and the tool hints that support it.

### Modified Capabilities
None. (Tool result hints are specified in `artifact-preview`.)

## Impact

- Content: the shared instruction source and generated Claude plugin skills (`open-design`, `open-design-explore`, `open-design-poster`, and the other recipe skills that end with a design), CLI-installed Claude skills. Codex skills unchanged in behaviour.
- `packages/mcp-server`: `register_open_design_artifact` hint (gated on client name), `get_open_design_artifact` returns `previewUrl`.
- Docs: Claude Code getting started and the Claude Desktop guide (add-claude-desktop-guide).
