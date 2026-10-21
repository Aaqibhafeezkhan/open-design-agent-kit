## Context

The install text is chosen from the MCP client name. Claude Desktop's name isn't captured in this repo; the only reference is an unverified comment saying `claude-ai`.

## Decisions

### D1. A new `claude-desktop` agent, not reuse of `claude-code`
Mapping Desktop to `claude-code` would show the connector step but also `claude mcp add` and `/mcp` steps that Desktop users can't run. Mapping it to `generic` is today's bug. A separate value keeps each template accurate. One value covers Desktop Chat, Cowork and claude.ai because they share the account's connectors and none takes a local remote-server config.

### D2. Tolerant match: `claude-code` first, then any name containing `claude`
Until the name is captured, any Claude client that isn't Claude Code gets the Desktop text. This matches `isClaudeClient`, which already treats every `claude` name as a Claude client. Trade-off: a future Claude client with its own config (for example an SDK host with a different name) would get connector-only steps. That text is still correct for connector entries, and the agent can override with `agent`. Once the name is captured (task 1.1), the test pins it; the broad match stays as the fallback.

### D3. API-key servers are manual on Desktop
Custom connectors can send request headers only in a limited beta with approved header names, and Desktop ignores remote servers in `claude_desktop_config.json`. Showing either route would mislead most users, so the template says the service can't be added with a key here and the workflow's manual fallback applies.

## Risks

- If Desktop sends a name without `claude` (for example a product name), it stays `generic`. Task 1.1 catches this.
