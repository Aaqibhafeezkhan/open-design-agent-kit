## 1. Shared launch entry

- [ ] 1.1 Move `openDesignLaunchEntry` and `mergeClaudeLaunchConfig` to `packages/core/src/setup/claudeLaunch.ts`; the CLI imports them; existing `init` tests still pass
- [ ] 1.2 `npx` beside `process.execPath` (`npx.cmd` on Windows) when it exists, else `npx`; unit tests with a fake bin dir
- [ ] 1.3 Per-project port (FNV-1a of the real path, 5317–5416) in `port` and `--port`; unit tests for stability and range
- [ ] 1.4 Pin `runtimeArgs` to the caller's version (server or CLI)

## 2. Preview start page

- [ ] 2.1 `previewServer.ts`: `rootLatest` option redirecting `/` to the newest registered artifact, else the list; unit test
- [ ] 2.2 CLI `preview --root-latest`; the launch entry uses it

## 3. Tool

- [ ] 3.1 `set_up_open_design_browser_pane` in `packages/mcp-server`: merge, return `{ name, port, outcome }` and the next step; annotations (writes in the workspace, not destructive)
- [ ] 3.2 Unit tests: created, updated (other configurations kept), unchanged, malformed file refused

## 4. Skill text

- [ ] 4.1 Overview skill: in the Code tab (preview tool listed), set up the pane once, tell the user once, start `open-design-preview`; later designs reload or point at the pane; elsewhere `open_open_design_preview`
- [ ] 4.2 `open-design-preview` skill/prompt: the same rule
- [ ] 4.3 Regenerate skill copies; drift checks pass

## 5. Docs

- [ ] 5.1 `docs/getting-started/claude-desktop.md`: "ask Claude to show the live preview"; the JSON as a fallback; keeping a custom entry by renaming it
- [ ] 5.2 `docs/reference/cli.md`: `--root-latest`, the port rule, the `npx` path
- [ ] 5.3 `docs/reference/tools.md`: the new tool

## 6. Verification

- [ ] 6.1 Desktop Code tab, plugin only (macOS, Node from nvm): ask for a design; the pane shows it with live reload and Comment, no JSON edited by hand
- [ ] 6.2 Two projects open at once: both panes run
- [ ] 6.3 Windows: the entry starts with `npx.cmd`
- [ ] 6.4 Find out whether the agent's pane tools can reload or navigate; update the skill if they can
