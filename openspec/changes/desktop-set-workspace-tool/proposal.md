> **Status: implemented.** Shipped in PR #3 (branch `claude/project-thread-s40bk1`, merged to `main` as `9fb7dfd`).

## Why

Claude Code, Codex and VS Code start the MCP server in the user's project, so `process.cwd()` (or the client's MCP roots) is the right workspace. The Cowork spike on 20 Oct 2026 showed Claude Desktop is different in a Chat with a connected folder:

- the server starts in the user's home folder (`/home/iven`) and the client advertises no MCP roots, so the kit would write `~/.open-design/`;
- Claude runs as a cloud session bridged to the device and sees the folder as `/sessions/<id>/mnt/<name>`, while the server sees the real path (`/home/iven/.../od-test`). The server found Claude's file only by its real path, which Claude can read from `get_device_info.connectedFolders`.

## What Changes

- **New MCP tool `set_open_design_workspace`** with one required argument, `path`: the folder's absolute path on the machine the server runs on. It must exist and be a directory. It replaces the server's context for the rest of the session and wins over MCP roots and the working directory. Errors tell the agent to pass the host path, not its own mount path.
- **Home-folder guard.** While the workspace would be the user's home folder, and neither the agent nor `OPEN_DESIGN_WORKSPACE_ROOT` set it, every other tool refuses with a message that says to call `set_open_design_workspace` first (or to pass the home folder explicitly if that is really meant). A skill that skips the step can't write into `~/.open-design`.
- **Skill line.** The `open-design` overview skill (Claude plugin, CLI-installed Claude and Codex skills, `.agents/skills`) tells Claude Desktop to call the tool first with the `connectedFolders` path and to join the workspace-relative paths other tools return onto its own path for that folder.
- **Docs.** `docs/reference/tools.md` documents the tool.

Why one tool and not a path argument on every tool: the kit's tools already return workspace-relative paths such as `.open-design/poster/poster.html`. Once the server knows the root, Claude prefixes its own folder path and both sides address the same file, so no other tool changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `open-design-agent-plugins`: workspace root precedence gains an agent-set folder; the home-folder guard; the tool list gains `set_open_design_workspace` (MCP only).

## Impact

- `packages/mcp-server/src/env.ts` (`isHomeFolder`, `workspaceRootFromArg`), `src/index.ts` (tool definition, handling in `main()`, guard), `src/tools.ts`.
- Skills: `packages/claude-plugin/skills/open-design/SKILL.md`, `packages/cli/assets/{claude,codex}-skills/open-design/SKILL.md`, `.agents/skills/open-design/SKILL.md`.
- `docs/reference/tools.md`. No change for VS Code, which has no such tool.
