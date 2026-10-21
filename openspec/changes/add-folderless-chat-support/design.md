## Context

The kit has one rule everywhere: **the agent writes design files with its own tools, and the server only prepares, checks, exports and keeps sidecars.** It is the `Native File Authoring` requirement (`openspec/specs/open-design-tools/spec.md`), and every content tool's description says so (for example `register_open_design_artifact` in `packages/mcp-server/src/index.ts`: "after you have written an artifact's entry file … with your normal file-editing tools").

The rule assumes that the agent's files and the server's files are the same files. On Claude's surfaces that holds in three places, and fails in plain Chat:

| Surface | Kit server reachable? | Agent's file tools | Same files as the server? |
|---|---|---|---|
| Claude Code, Desktop Code tab | Yes (plugin) | Yes | Yes |
| Desktop Chat with a folder | Yes (plugin server on the user's machine) | `device_bash` and related tools on the connected folder | Yes, once `set_open_design_workspace` maps the host path (`cowork-spike/FINDINGS.md`) |
| Desktop Chat, no folder | **No**: plugin local MCP servers are ignored in Chat (platform-support table, `desktop-research/install-landscape.md` §3e) | Only Anthropic's code-execution sandbox, when "Code execution and file creation" is on | No: the sandbox is in Anthropic's cloud; nothing on the user's machine can read it |
| claude.ai web, mobile | No (local servers can't run there) | Same sandbox | No |

So the folderless problem is two problems:

1. **Reach.** In plain Chat the plugin's server never starts. A local server gets into Desktop Chat only as a Desktop extension (`.mcpb`, proposal add-desktop-extension-bundle) or through `claude_desktop_config.json` (stdio only, needs Node on PATH, restart). On web and mobile only a remote connector reaches Chat.
2. **Shared files.** Even when the server is reachable, the agent can't put a file where the server can see it. Its own "file tools", when it has any, write into a cloud sandbox. Either the server writes, or nothing does.

`docs/getting-started/claude-desktop.md` and add-claude-desktop-guide currently say "Chat without a folder: No". This change decides what to do instead.

## Goals / Non-Goals

**Goals**
- A Desktop Chat with no folder, where the kit's server is reachable, produces real design files on the user's machine and gets the full loop: brief, check, inline preview, comments, export.
- Where the server is not reachable at all, the agent still does something useful and says plainly what is missing.
- The "agent writes with its own tools" rule stays exactly as it is wherever the agent has tools that reach the server's files.

**Non-Goals**
- Building or shipping the `.mcpb` (add-desktop-extension-bundle owns that).
- A hosted remote server with server-side storage and accounts.
- Syncing files between Anthropic's sandbox and the user's machine.

## Options

### A. Server-side save tool into a server-managed workspace

The server creates a folder it owns (`~/Open Design/<name>/`) and offers `write_open_design_file(path, content)`, which writes the model's content byte for byte under that folder's output directory. Everything else (register, check, show, export) works unchanged against that folder.

- Works in Desktop Chat with no folder as soon as the server is reachable (extension or config file). No second install, no folder picker.
- The same tool is what a future remote server would need, since a remote server can never see the agent's files either. The design carries over.
- **Bends the rule**: the server writes design content. Mitigated by the scope below; the content is still authored entirely by the model, and the server only moves bytes across a boundary the agent can't cross.
- Costs tokens: the agent sends whole files through tool arguments, and an edit resends the file. Large pages (tens of KB) are fine; very large inlined assets are not.
- Files land in a folder the user didn't pick. Mitigated by a fixed, visible location and saying the path in every reply.

### B. Document a filesystem extension or connector

The user installs a filesystem MCP server (Anthropic's Filesystem desktop extension or `@modelcontextprotocol/server-filesystem`) next to the kit's server and gives both the same folder. The agent writes through the filesystem server and calls `set_open_design_workspace` with the same path.

- Keeps the rule intact: the agent writes with a tool that isn't ours.
- Two installs and a folder configured in a second settings page, for the users least likely to want either. And Desktop Chat already offers a simpler way to give Claude a folder: connecting one, which the kit supports today. Anyone willing to choose a folder should do that instead.
- Doesn't help web or mobile.
- Nothing for us to build except a docs paragraph. Worth a line in the guide, not a design.

### C. Rely on Claude artifacts as the output

No files at all: the agent writes one self-contained HTML page (in its sandbox or inline) and publishes it with its Artifact tool.

- Works everywhere the Artifact tool exists, including web, with nothing installed beyond the plugin's skills (skills load in Chat).
- The `claude-artifact` provider (add-claude-artifact-provider) is a server tool, so it is **not** available here. Only the agent's own Artifact tool is. No brief from `prepare_open_design_brief`, no craft rules, no design-system tokens, no check, no exports, no comments. The plugin's curated skills mostly say "call `prepare_open_design_brief`", so the quality drop is large.
- On its own, it isn't "the kit running in plain Chat". As a fallback it is much better than refusing.

### D. Remote kit server (connector)

Reaches every Chat surface (research §7, "better long-term alternative"). It needs hosting, auth, per-user storage, and a remote way to show and export files. Out of scope; noted because option A's write tool is the piece it would reuse.

## Decision

**Do A where the server is reachable, C where it isn't, and B as a single docs line.**

1. **Server reachable, no folder (Desktop Chat with the extension or a config entry):** a managed workspace plus a scoped `write_open_design_file`.
2. **Server not reachable (web, mobile, Desktop Chat with only the plugin):** the skill tells the agent to say what's missing (connect a folder, or install the extension) and, if the user wants to go ahead anyway, make one self-contained page and publish it with its Artifact tool.
3. **Docs:** Chat with a folder stays the recommended Desktop setup; a filesystem extension is mentioned as an alternative for people who already use one.

### How A bends the rule, exactly

The rule has two halves. A keeps the first and relaxes the second, in one place only:

- **Authorship (kept).** The server never generates, templates, rewrites or "fixes" design content. `write_open_design_file` writes the given bytes unchanged and returns their size and SHA-256 so the agent can confirm. All design decisions stay in the model, as everywhere else.
- **Who performs the write (relaxed).** In a managed workspace, and only there, the server performs the file write the agent can't.

### Keeping it scoped

- **Only in a managed workspace.** `write_open_design_file` refuses unless the session's workspace was created by `use_open_design_managed_workspace`. In Claude Code, VS Code, Codex, a connected Desktop folder, or a folder set with `set_open_design_workspace`, it refuses and tells the agent to use its own file tools. So the rule holds unchanged on every surface where it holds today.
- **Only listed where it could apply.** The server lists the managed-workspace tool and the write tool only when it has no folder of its own: working directory is the home folder, no `OPEN_DESIGN_WORKSPACE_ROOT`, no MCP roots (the case the home-folder guard already detects in `packages/mcp-server/src/index.ts`). Claude Code and VS Code never see them. Desktop Chat with a folder sees them, but the skill and the refusal steer it to `set_open_design_workspace`.
- **Only under the output directory.** Paths are workspace-relative and must resolve inside `<workspace>/<outputDir>/`; `..`, absolute paths, and symlinks that lead outside are refused (the same `path.relative` check `packages/core/src/export/staticServer.ts` uses).
- **Never a server-owned file.** `*.artifact.json`, `*.comments.json`, `config.json`, export output and check screenshots are written only by the tools that own them.
- **Only design file types.** Text: `.html .htm .css .js .mjs .json .svg .md .txt .csv`. Binary, sent as base64: `.png .jpg .jpeg .webp .gif .woff .woff2`. Anything else is refused.
- **Size cap.** 5 MiB decoded per call, the same budget `get_open_design_preview_state` uses for a page.
- **No delete, no move, no read-anywhere.** Writes and overwrites only. Reading back uses the existing `get_open_design_artifact` (entry content) and `read_open_design_source`.
- **A visible place.** `~/Open Design/<name>/`, or `OPEN_DESIGN_MANAGED_ROOT/<name>/`. The name is the slug of what the agent passes (the design or project name). The same name in a later chat reopens the same folder, so work can continue.

### The managed workspace

`use_open_design_managed_workspace({ name })` creates or reopens the folder and makes it the session's workspace, the same way `set_open_design_workspace` does (it rebuilds the context in `main()`). The home-folder guard's message gains one sentence: if the user has no folder, call `use_open_design_managed_workspace`. The agent says the folder's absolute path to the user the first time, so they can open it in their file manager.

### Artifacts and previews in a managed workspace

- The inline preview (`show_open_design_artifact`) works unchanged: the MCP App page fetches the design from the server (add-mcp-app-preview), and Desktop Chat renders MCP Apps with or without a folder (`docs/guides/inline-preview.md`). It is the main way to look at the design here.
- `claude-artifact` publishing tells the agent to publish a file **by its path** (`composeArtifactPublishInstructions` in `packages/core/src/generation/publishInstructions.ts`). That path is on the user's machine, which the agent's Artifact tool can't read. In a managed workspace the recipe instead returns the standalone page as text content, up to 2 MiB, for the agent to publish. Above that it says the page is too large to publish from this chat and gives the file's path. The automatic "artifact preview after each round" from the overview skill is skipped here, since the inline preview already covers it and each publish would resend the page.
- Exports are written in the managed folder as usual; the agent gives their absolute paths.

## Risks / Trade-offs

- **Precedent.** A write tool invites "just use it everywhere". The refusal outside managed workspaces and the listing rule are the guard; tests cover both.
- **Token cost.** Sending whole files is expensive for big pages and every edit. Acceptable for posters, decks and landing pages; the 5 MiB cap stops the worst cases.
- **Hidden files.** Users may not know where designs went. Every reply after a write names the absolute folder path.
- **Two copies.** With code execution on, the agent may also keep its own copy in its sandbox. The skill says the managed folder is the source of truth, and to edit by rewriting the file through the tool.
- **Depends on reach.** Without add-desktop-extension-bundle (or a hand-written config entry), part 1 never runs, and only the fallback applies.

## Open Questions

- Does Desktop Chat without a folder give the agent a code-execution sandbox when a Desktop extension is also present, and does it prefer writing there? Spike once the `.mcpb` exists.
- Should the listing rule also include hosts that report MCP roots but where the agent says it has no file tools? No such host is known; leave it out until one is.
- Is `~/Open Design` right on macOS and Windows, or should it sit under Documents? Decide with the first non-Linux test.
