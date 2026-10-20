> Implemented in PR #3 (`claude/project-thread-s40bk1`, merged as `9fb7dfd`), except task 4.

## 1. Launcher

- [x] 1.1 `bin/open-design-mcp.mjs`: installed copy in `node_modules` if present, else `npx -y <package>@<pin>` read from `package.json`
- [x] 1.2 Windows: `npx.cmd` through a shell
- [x] 1.3 Forward stdio, exit code and signals; clear error when the command can't start

## 2. Plugin registration

- [x] 2.1 `.mcp.json` runs the launcher with `node`
- [x] 2.2 `update-plugin-lock.mjs` checks the pin and lock stay in step

## 3. Verification

- [x] 3.1 Both launcher paths run the built server in a simulated Desktop session (no `node_modules`) and in a Claude Code-style install
- [x] 3.2 Releasing docs mention the pin

## 4. Release

- [ ] 4.1 Publish a server version that contains PR #3 (the plugin pins `0.1.8`; `0.2.0` is published but predates PR #3)
- [ ] 4.2 Bump the plugin's pin and regenerate the lock (`npm run update-lock`)
- [ ] 4.3 Rerun the spike's Run 2 from the marketplace install in Claude Desktop Chat with a folder

## 5. Follow-up

- [ ] 5.1 macOS: confirm Desktop finds `node`/`npx` when Node is installed through nvm (parked by Iven on 20 Oct 2026)
- [ ] 5.2 Windows Desktop run (parked)
