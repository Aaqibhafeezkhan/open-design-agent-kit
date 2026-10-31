## Context

`clientSupportsMcpApps(capabilities)` returns true only when the client lists the `io.modelcontextprotocol/ui` extension (and our MIME type, if it lists any). `tools/list` hides `appOnly` and `appsHostOnly` tools otherwise, and replies fall back to text. The preview loads the bundled design through the app-only `get_open_design_preview_state` and renders it in a `srcdoc` iframe. OpenAI's "MCP Apps compatibility in ChatGPT" page documents the shared bridge plus `window.openai` aliases and extras, and says to feature-detect rather than check the host. It doesn't document app-only tool visibility.

## Goals / Non-Goals

**Goals**
- Pickers, the questions view and the preview work in ChatGPT desktop if the host renders MCP Apps for local servers.
- No regression in Claude.

**Non-Goals**
- ChatGPT-only features that have no fallback.
- Web or mobile.

## Decisions

**1. Probe before building.** Every change below depends on facts we can't read from docs. The probe is one small stdio server with three tools: one returning a UI resource, one app-only tool, and one returning a payload of a size the view chooses. It logs what it receives to a file in the plugin folder. A negative result ("ChatGPT desktop doesn't render MCP Apps for local plugins") ends this change after the probe, and the text fallback stays.

**2. Capability first, then the launcher.** If the capability is missing but views render, we accept `OPEN_DESIGN_LAUNCHER=chatgpt-plugin` as the signal. That's our own value, set in our own `mcp.json`, so it can't misfire on another host. `clientInfo.name` is logged, but we don't depend on it, because its value isn't documented.

**3. Spec names before `openai/` names.** Where the MCP Apps spec has a method (`ui/request-display-mode`), we use it. We use `window.openai.*` only when the spec method is missing. This keeps one code path for Claude, ChatGPT and future hosts.

**4. Payload limit from the probe.** If ChatGPT's limit on what reaches the view is lower than Claude's, the preview state tool uses the same "too large: open the live preview" fallback it already has, with the limit taken from the measured value.

## Risks / Trade-offs

- OpenAI may only render MCP Apps for remote apps. Then the desktop plugin stays text-only until a hosted server exists.
- `openai/` metadata keys could change. They're optional and ignored elsewhere, so the worst case is no status text.
