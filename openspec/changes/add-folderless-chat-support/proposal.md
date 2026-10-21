## Why

Claude Desktop Chat without a connected folder, and claude.ai web and mobile chats, can't run the kit today. `docs/getting-started/claude-desktop.md` says "Chat without a folder: No", and add-claude-desktop-guide records it as unsupported. Two things stand in the way:

- **The server doesn't start there.** Plain Chat ignores a plugin's local MCP servers entirely (platform-support table, `/mnt/project-files/desktop-research/install-landscape.md` §3e). The plugin's `packages/claude-plugin/.mcp.json` server only reaches Desktop Chat if it is installed as a Desktop extension (add-desktop-extension-bundle) or listed in `claude_desktop_config.json`, or if it is remote.
- **Nothing shared to write into.** Every content tool assumes the agent writes the design files with its own tools and the server reads them (`Native File Authoring`, `openspec/specs/open-design-tools/spec.md`; `register_open_design_artifact` in `packages/mcp-server/src/index.ts`). With no folder, the agent's only files, if any, are in Anthropic's cloud sandbox, which a server on the user's machine can't see. The folder bridge that fixed Chat with a folder (`set_open_design_workspace`, desktop-set-workspace-tool) needs a folder.

`design.md` weighs a server-side save tool, a documented filesystem extension, Claude artifacts as the only output, and a remote server.

## What Changes

- **Managed workspace.** New MCP tool `use_open_design_managed_workspace` with a required `name`. It creates or reopens `~/Open Design/<slug>/` (or under `OPEN_DESIGN_MANAGED_ROOT`) and makes it the session's workspace, the same way `set_open_design_workspace` does. The home-folder guard's message names it as the choice when the user has no folder.
- **Scoped write tool.** New MCP tool `write_open_design_file` (`path`, `content`, optional `encoding: "base64"`). It writes the model's content unchanged under the managed workspace's output directory and returns the byte count and SHA-256. It refuses in any other workspace, outside the output directory, for server-owned files (sidecars, comments, config, exports), for file types other than design text, images and fonts, and above 5 MiB. This is a deliberate, narrow exception to "the agent writes with its own tools": the model still authors every byte; the server only performs the write the agent can't.
- **Listing rule.** Both tools are listed only when the server has no folder of its own (home-folder working directory, no `OPEN_DESIGN_WORKSPACE_ROOT`, no MCP roots), so Claude Code, Codex and VS Code never see them.
- **Artifact publish in a managed workspace.** The `claude-artifact` recipe returns the standalone page as text (up to 2 MiB) instead of a path the agent's Artifact tool can't read; the per-round artifact preview is skipped there, since the inline preview (`show_open_design_artifact`) already works.
- **Fallback with no server.** The overview skill tells the agent, when it has no Open Design tools at all, to say what's missing (connect a folder, or install the extension), and on request to make one self-contained page and publish it with its own Artifact tool.
- **Docs.** The Claude Desktop guide's "Chat without a folder" section becomes: works with the extension (files in `~/Open Design/<name>/`); otherwise a reduced artifact-only mode; connecting a folder is still the recommended setup; a filesystem extension pointed at the same folder is an alternative. `docs/reference/tools.md` gains both tools.

Not in this change: building the `.mcpb` (add-desktop-extension-bundle), a hosted remote server, syncing between Claude's sandbox and the user's machine.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `open-design-agent-plugins`: adds the managed workspace, the scoped write tool and its listing rule, managed-workspace artifact publishing, and the no-server fallback guidance.
- `open-design-tools`: `Native File Authoring` gains the managed-workspace exception.

## Impact

- `packages/mcp-server/src/env.ts` (managed root, slug, path containment and type checks), `src/index.ts` (two tool definitions handled in `main()` like `set_open_design_workspace`, listing rule in the `ListToolsRequestSchema` handler, guard text), `src/tools.ts`, tests.
- `packages/core/src/generation/publishInstructions.ts` (`composeArtifactPublishInstructions` inline variant) and the MCP server's publish handler, which passes whether the workspace is managed.
- Skills: `packages/claude-plugin/skills/open-design/SKILL.md` and its generated copies (`packages/cli/assets/{claude,codex}-skills/open-design/SKILL.md`, `.agents/skills/open-design/SKILL.md`); content drift check.
- Docs: `docs/getting-started/claude-desktop.md`, `docs/guides/inline-preview.md` (its "with or without a folder" row needs the extension for the no-folder case), `docs/reference/tools.md`, troubleshooting.
- Depends on desktop-set-workspace-tool (the context swap and home-folder guard this reuses) and, for reach, on add-desktop-extension-bundle. Changes the "Chat without a folder" scenario of add-claude-desktop-guide's `claude-desktop-surfaces`; whichever archives second updates it.
- No VS Code change: it has a folder by definition and gets neither tool.
