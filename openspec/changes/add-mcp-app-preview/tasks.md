## 1. Resource and transport

- [x] 1.1 MCP Apps transport for the comment controller in `core/src/preview` (tool calls for comments, message for hand-off)
- [x] 1.2 Build the shell as a single self-contained HTML resource `ui://open-design/preview`; declare CSP domains (Google Fonts, and the design's remaining remote hosts from the standalone bundler's report)
- [x] 1.3 Render the design in a nested frame from the standalone export

## 2. Tools

- [x] 2.1 `show_open_design_artifact`: UI declaration, structured content for the app, text fallback
- [x] 2.2 App-only `save_open_design_comment` and `get_open_design_preview_state`
- [x] 2.3 Export buttons send a chat request instead of downloading
- [x] 2.4 Exploration view with "take this one" sent to chat

## 3. Content and docs

- [x] 3.1 Overview skill (Claude): show after registration and after applying feedback, in Chat only; drift check
- [x] 3.2 Tools reference; Desktop guide section (`docs/guides/inline-preview.md`, for add-claude-desktop-guide to link)

## 4. Tests and verification

- [x] 4.1 Scripted MCP client: resource listed, tool result carries the UI link, app-only tools hidden from the model list
- [x] 4.2 Reference host in the browser: comment round trip and hand-off message
- [ ] 4.3 Claude Desktop Chat with the plugin install: render, comment, apply, fullscreen (needs the MCP server published and the plugin's pin bumped past 0.1.8)
- [x] 4.4 Hosts without MCP Apps (Claude Code terminal, Codex) get the text result only (scripted client without the extension)
