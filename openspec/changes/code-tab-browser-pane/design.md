## Context

`.claude/launch.json` holds `configurations`, each with `name`, `runtimeExecutable`, `runtimeArgs` and `port`. In the Code tab, Desktop starts a named configuration and shows its port in the Browser pane, either when the user asks or when the agent calls the pane's `preview_start` tool with the name. `packages/cli/src/claudeSetup.ts` already has `openDesignLaunchEntry()` and `mergeClaudeLaunchConfig()`, used by `init`. The preview server already supports `--root-redirect` (bare `/` to the artifact list) and `--no-open`.

## Goals / Non-Goals

**Goals**
- A plugin user in the Code tab gets the live preview in the pane by asking for it, with no JSON editing.
- The entry starts without PATH fixes on common Node installs.
- Two projects can run their pane previews at once.

**Non-Goals**
- Driving the pane from the MCP server. The server can't see the pane; only the agent's own pane tools can.
- Changing the preview server's features.

## Decisions

**1. A tool, not an automatic write.** Writing `.claude/launch.json` changes the user's project config, so it happens only when the agent asks for it, and the skill asks only where `preview_start` exists (the Code tab). Alternative: write it on every register in a Claude Code client. Rejected because the terminal Claude Code is also `claude-code` and has no pane.

**2. One merge function in core.** `mergeClaudeLaunchConfig` and `openDesignLaunchEntry` move to `packages/core/src/setup/claudeLaunch.ts`. The CLI and the server both call it, so `init` and the tool can't drift. It keeps the current rules: create the file if absent, replace only `open-design-preview`, keep everything else, and leave the file untouched when nothing changes. A malformed file is reported, not overwritten.

**3. `npx` beside the running Node.** `path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'npx.cmd' : 'npx')`, used when it exists. nvm, Homebrew, Volta's shims and the official installers all put `npx` there. When it doesn't exist, the entry keeps plain `npx` and the guide's PATH note stays. Alternative: run the CLI through `node` and a resolved script path. Rejected because the plugin's server is started by npx from a cache folder that can be cleaned at any time.

**4. A per-project port, by hash.** `5317 + (fnv1a(realpath(workspace)) % 100)`. It's stable across runs and machines with the same path, needs no Desktop feature, and two projects collide only rarely (when they do, the second preview fails to start with "port in use", which the tool's reply mentions). Alternative: `autoPort` in launch.json. Rejected for now because it's unverified how Desktop hands the chosen port to the process. It's a follow-up if Desktop documents it.

**5. Start on the newest design.** `--root-latest` redirects `/` to the shell URL of the registered artifact with the newest manifest time, and to the list when there's none. Each pane load (or reload) lands on the newest design, which is usually the one being discussed. `--root-redirect` keeps its meaning for existing entries.

**6. The skill owns the pane.** Order: `set_up_open_design_browser_pane` (once per project; it's idempotent), then `preview_start` with `open-design-preview`. On later designs the pane is already running: the skill tells the agent to reload it if its pane tools can (it lands on the newest design), else to tell the user it's in the pane's list. Comments in the pane are saved next to the design as today, and the user hands them back in chat ("apply my comments").

## Risks / Trade-offs

- **Version pin drift.** The entry pins the version that wrote it. After an upgrade, the tool and `init` rewrite it (same configuration name). Until then the pane runs the older preview, which still reads the same files.
- **A user-edited entry.** Replacing our own entry undoes a hand edit (say, a custom port). The tool's reply names the file and the change, and the guide says to rename the entry to keep a custom one.
- **`preview_start` naming.** The pane tool's name may differ between Desktop builds. The skill says "the Code tab's preview tool (named like `preview_start`)" and keeps the user-facing fallback ("ask me to start open-design-preview").

## Open Questions

- Can the agent reload or navigate the pane to a URL? If so, the skill can open a specific design rather than the newest one.
