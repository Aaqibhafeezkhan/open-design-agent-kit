## Why

ChatGPT renders the open MCP Apps spec: `ui://` resources with `text/html;profile=mcp-app`, `_meta.ui.resourceUri` on the render tool, and the `ui/initialize`, `ui/notifications/tool-result`, `tools/call`, `ui/message` and `ui/update-model-context` bridge messages. It also adds optional `window.openai` extras. The kit's in-chat views (artifact preview, questions, example and design-system pickers) are built on that spec (ext-apps 1.7.5). So they may work in ChatGPT with small changes.

Two things are unknown, though, and they decide the scope:
- Does the ChatGPT desktop app render MCP Apps for a **local** (stdio) plugin server, or only for remote apps?
- Does ChatGPT advertise the `io.modelcontextprotocol/ui` client capability that `clientSupportsMcpApps()` checks? If not, the server hides every app tool and falls back to text.

There are smaller unknowns too: whether app-only tools are kept away from the model, the size limit on tool results passed to the view (about 150k characters in Claude), and the CSP rules for `srcdoc` previews. Research: `/mnt/project-files/chatgpt-research/chatgpt-support.md`.

## What Changes

- **A probe first.** A small `scripts/probe-mcp-apps-host.mjs` server, packaged as a local ChatGPT plugin, records what the host sends: the client capabilities, the `clientInfo`, which tools the model is offered, the largest tool result that reaches the view, and whether `srcdoc` with inline scripts runs. Iven runs it once in ChatGPT desktop. The results go into this change's design.md, and the tasks below are cut to fit.
- **Host detection that matches ChatGPT.** If ChatGPT doesn't send the capability but does render MCP Apps, `clientSupportsMcpApps()` also accepts ChatGPT's `clientInfo` (or the `chatgpt-plugin` launcher from `add-chatgpt-desktop-plugin`). The check stays capability-first.
- **App-only tools stay hidden.** If ChatGPT offers app-only tools (`get_open_design_preview_state`, `save_open_design_comment`) to the model, they get `_meta.ui.visibility: ["app"]`, and their descriptions say "called by the preview, not by you" as a backstop.
- **Status text.** Render tools set `openai/toolInvocation/invoking` and `openai/toolInvocation/invoked` (for example "Opening preview…" and "Preview ready"). Hosts that don't know these keys ignore them.
- **Feature-detected extras in the views.** Where `window.openai.requestDisplayMode` (or the spec's `ui/request-display-mode`) exists, the preview offers a Fullscreen button. Where `window.openai.setWidgetState` exists, the preview keeps the selected page or slide across re-renders. The views never branch on host name. Each extra has a fallback, as OpenAI's guide asks.
- **Docs.** The ChatGPT desktop guide gets an "In-chat preview" section with what works and what doesn't.

Not in this change: ChatGPT web, where these views would come from a hosted server (`add-remote-mcp-server`). Also out: `requestCheckout` and file upload extras.

## Capabilities

### New Capabilities
- `chatgpt-mcp-apps`: how the kit's MCP App views detect and behave in ChatGPT.

### Modified Capabilities
None. Claude behaviour is unchanged.

## Impact

- `scripts/probe-mcp-apps-host.mjs` (new, dev only).
- `packages/core/src/preview/mcpApp/protocol.ts` (detection), the views' bridge code (feature-detected extras).
- `packages/mcp-server/src/index.ts`: tool `_meta` for visibility and status text.
- Docs: `docs/getting-started/chatgpt-desktop.md`.
- Depends on `add-chatgpt-desktop-plugin` for a way to load a local server into ChatGPT.
