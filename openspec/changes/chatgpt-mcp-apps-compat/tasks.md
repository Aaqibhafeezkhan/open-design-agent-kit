## 1. Probe

- [ ] 1.1 `scripts/probe-mcp-apps-host.mjs`: stdio server with a UI tool, an app-only tool and a sized-payload tool; logs capabilities, `clientInfo`, tool calls and view messages to a file
- [ ] 1.2 Package it as a local ChatGPT plugin (reuse the `add-chatgpt-desktop-plugin` layout); a README with the steps for Iven
- [ ] 1.3 Iven runs it in ChatGPT desktop (Work and Codex tabs); record the results in design.md
- [ ] 1.4 Decide the scope: stop here if views don't render for local plugins

## 2. Detection and tools

- [ ] 2.1 `clientSupportsMcpApps`: accept the `chatgpt-plugin` launcher when the capability is missing (only if 1.3 shows views render); unit tests
- [ ] 2.2 `_meta.ui.visibility: ["app"]` on app-only tools if 1.3 shows the model is offered them; descriptions say "called by the preview"
- [ ] 2.3 `openai/toolInvocation/invoking` and `invoked` text on render tools; unit test of the `_meta`
- [ ] 2.4 Payload limit for ChatGPT from 1.3 in the preview state fallback

## 3. Views

- [ ] 3.1 Fullscreen button when `ui/request-display-mode` or `window.openai.requestDisplayMode` exists; hidden otherwise
- [ ] 3.2 Keep the selected page or slide with `setWidgetState` where it exists; unit tests with a fake bridge
- [ ] 3.3 Claude Desktop regression run of the preview, questions and pickers

## 4. Docs and verification

- [ ] 4.1 "In-chat preview" section in `docs/getting-started/chatgpt-desktop.md`
- [ ] 4.2 ChatGPT desktop run: pick an example, answer questions, see the preview update after an edit
