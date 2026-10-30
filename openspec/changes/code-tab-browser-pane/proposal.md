## Why

In Claude Desktop's Code tab, the best place for the live browser preview (live reload, **Comment**, **Checks**) is the Browser pane next to the chat. Desktop starts local servers listed in `.claude/launch.json` and shows them there. The kit supports this today, but only half of it works without help:

- **Only `init` writes the entry.** `npx @feimacode/open-design-agent-kit init --tools claude` merges an `open-design-preview` configuration into `.claude/launch.json`. Plugin users, who are most Desktop users, have to copy JSON from the guide by hand.
- **`npx` often isn't found.** Desktop starts the entry without a login shell, so with Node from nvm or Homebrew, `npx` isn't on its PATH. The guide tells people to replace `runtimeExecutable` with the output of `which npx`.
- **One fixed port for every project.** Every entry uses port 5317, so a second project's preview can't start while the first is running.
- **The agent doesn't start it.** The skill never mentions the pane's own tools. The user has to say "start open-design-preview in the Browser pane", and the pane then opens on the artifact list, not on the design just made. Meanwhile `open_open_design_preview` opens a separate browser window beside Desktop.

## What Changes

- **A tool that sets up the pane.** `set_up_open_design_browser_pane` merges the `open-design-preview` configuration into the workspace's `.claude/launch.json` (creating it if needed, keeping other configurations, replacing only its own) and returns the configuration name. It shares its merge code with `init`, which moves from the CLI to core.
- **An entry that starts on any Mac or PC.** The entry's `runtimeExecutable` is the absolute path of the `npx` next to the Node that runs the server or CLI, when there is one; otherwise `npx`. Its version is pinned to the server's (or CLI's) own version.
- **A port per project.** The entry's port comes from the workspace path, a stable number in 5317–5416, so different projects don't collide and re-running setup keeps the same port.
- **The pane opens on the newest design.** A new preview option, `--root-latest`, makes the bare `/` redirect to the most recently registered artifact (the list when there is none). The launch entry uses it instead of `--root-redirect`.
- **The skill uses the pane in the Code tab.** Where the Code tab's preview tool (`preview_start`) is in the agent's tools, the skill tells it to call `set_up_open_design_browser_pane` once, tell the user in one sentence that it added a preview entry to `.claude/launch.json`, then start `open-design-preview` with `preview_start`. It uses that instead of `open_open_design_preview`. Later designs reuse the running pane: the agent tells the user to click the design in the pane's list, or reloads the pane if the tool allows it. Elsewhere the agent keeps calling `open_open_design_preview`.
- **Docs.** The Desktop guide's Browser pane section becomes "ask Claude to show the live preview", with the JSON kept as a fallback. The CLI reference documents `--root-latest` and the port rule.

Not in this change: the Chat and Cowork inline preview (see `inline-preview-in-place`), or a Desktop mod pane.

## Capabilities

### New Capabilities
- `browser-pane-preview`: setting up the Code tab's Browser pane from the agent, the launch entry's executable, port and start page, and when the skill uses the pane.

### Modified Capabilities
None. `init` keeps writing the same configuration name, with the new executable, port and start-page rules.

## Impact

- `packages/core`: the launch-config merge (moved from `packages/cli/src/claudeSetup.ts`), the per-project port and `npx` lookup, and the newest-artifact redirect in `previewServer.ts`.
- `packages/cli`: `init` uses the shared merge; `preview --root-latest`.
- `packages/mcp-server`: the new tool, its description and annotations, unit tests.
- Skills: the overview skill's Code tab lines and `open-design-preview`; regenerated copies.
- Docs: `docs/getting-started/claude-desktop.md`, `docs/reference/cli.md`, `docs/reference/tools.md`.
