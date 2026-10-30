## Context

The preview MCP App is one `ui://open-design/preview` page. Its views (artifact, exploration, campaign, examples, design systems, ask) call the app-only `get_open_design_preview_state` through the host. MCP Apps have no push from server to page: the page only gets data when it calls a tool or when the host sends a new tool result for that page. So "follow edits" means the page asks.

## Goals / Non-Goals

**Goals**
- The design the user is looking at in the chat is the current one, without the agent re-showing it.
- Tool results never send an MCP Apps host to the local server by default.
- Every tool tells the host whether it only reads.

**Non-Goals**
- Live reload for pickers and the ask view (their content doesn't change under them).
- Removing the browser preview or its server.

## Decisions

**1. Poll a revision, not the design.** `get_open_design_preview_state` gains `revisionOnly: true`, which returns `{ revision }`: a short hash of the manifest's and entry file's modification times, the supporting files' times, and the open comment count. The artifact, exploration and campaign views call it every 3 seconds while `document.visibilityState` is `visible`, and reload the full state when it changes. Alternatives: the full state on a timer (a design can be MBs once inlined, so no), or a host push (MCP Apps has none from the server).

**2. Back off when nothing changes.** After 2 minutes with no change the interval grows to 10 seconds, and it resets on any change or click in the page. A failed call stops polling and shows the reload button as today. This keeps an idle chat from calling the server every few seconds forever.

**3. Keep the comment draft.** A reload that arrives while the user is typing a comment waits until the comment is added or cancelled, so polling never throws away their text.

**4. Show once, update in place.** The skill line "call it after every register_open_design_artifact" becomes "after the first register of a design in this conversation; later rounds update it in place". The register result in an MCP Apps host says which: "Shown inline above; it updates by itself" when the page for that entry was shown in this process, else "Call show_open_design_artifact to show it inline". The server keeps a per-process set of entries `show_open_design_artifact` has shown (like the existing `previewOpenedFor` set for the browser preview), which is good enough for one conversation.

**5. Annotations from one table.** A `TOOL_ANNOTATIONS` map next to the tool list, keyed by tool name, gives each tool's hints, and the registration step copies them in. A unit test fails when a tool has no entry, so a new tool can't ship unannotated. `prepare_open_design_brief` is read-only (it returns instructions and writes nothing). `check_open_design_artifact` writes check runs, so it isn't.

**6. The device link is verified, not assumed.** The guide's table already says the device link draws no MCP Apps. The change re-runs that on current Desktop and updates the row either way. If it now renders, nothing else changes; if it doesn't, the register note there (no MCP Apps capability is advertised) keeps pointing at the browser preview.

## Risks / Trade-offs

- **Polling cost.** Each call is a small tool call through the host. With visibility checks and backoff, an open chat makes at most 20 calls a minute while visible, then 6. Some hosts may show tool-call activity for app calls; if Desktop does, raise the interval.
- **Stale copies from older sessions.** A copy shown before a server restart can't poll (the call fails), so it shows the reload button. That's the same as today.
- **Hosts that ignore annotations.** Harmless; they're hints.

## Open Questions

- Does Desktop show the app's background tool calls to the user? Check during the Desktop task, and raise the interval if it does.
