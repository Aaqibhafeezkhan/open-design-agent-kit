> Implemented in PR #3 (`claude/project-thread-s40bk1`, merged as `9fb7dfd`).

## 1. Server

- [x] 1.1 `workspaceRootFromArg`: require an absolute path to an existing directory; error text points at `get_device_info.connectedFolders`
- [x] 1.2 `set_open_design_workspace` tool definition, handled in `main()` by rebuilding the context; later MCP roots no longer override it
- [x] 1.3 `isHomeFolder` guard: other tools refuse while the workspace is the home folder and nothing set it
- [x] 1.4 Unit tests for path validation and the home-folder check

## 2. Skills and docs

- [x] 2.1 Overview skill line for Claude Desktop in all generated copies; content drift check passes
- [x] 2.2 `docs/reference/tools.md` entry and the workspace-relative paths note

## 3. Verification

- [x] 3.1 Built server started the way Desktop starts it: guard fired, a `/sessions/...` path was rejected, the real folder worked

## 4. Follow-up

- [ ] 4.1 Rerun the spike's Run 2 (poster from `brief.md`) in Desktop Chat with a folder once the release in desktop-plugin-server-launcher task 4 is out
