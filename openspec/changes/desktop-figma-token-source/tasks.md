> Implemented in PR #3 (`claude/project-thread-s40bk1`, merged as `9fb7dfd`).

## 1. Token source

- [x] 1.1 `getFigmaToken(env)`: `OPEN_DESIGN_FIGMA_TOKEN`, else the trimmed contents of `figmaTokenFilePath(env)`, else undefined
- [x] 1.2 `figmaTokenFilePath(env)`: `$XDG_CONFIG_HOME/open-design/figma-token`, defaulting to `~/.config`
- [x] 1.3 Read the token on every tool call instead of once at start-up
- [x] 1.4 Unit tests: env wins, file fallback, empty file treated as unset, missing file

## 2. Plugin

- [x] 2.1 Remove `userConfig.figma_token` from `plugin.json` and the env entry from `.mcp.json`
- [x] 2.2 Fail the plugin lint when `.mcp.json` contains `${user_config.`

## 3. Docs

- [x] 3.1 Figma guide, settings-and-env reference and troubleshooting describe the token file

## 4. Follow-up

- [ ] 4.1 Retest on macOS and Windows Claude Desktop (parked by Iven on 20 Oct 2026)
