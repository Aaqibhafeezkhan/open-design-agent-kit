## Context

The preview MCP App (add-mcp-app-preview) is one HTML resource whose page decides what to draw from the `view` field of `show_open_design_artifact`'s structured result, then fetches the heavy data through the app-only `get_open_design_preview_state`. It already has two views, `artifact` and `exploration`. The exploration view hands a pick back by posting a chat message (`pickDirectionMessage`), and the agent confirms the next step before calling `choose_open_design_direction`.

Where it renders: a host must advertise `io.modelcontextprotocol/ui` and must have started our server. The add-mcp-app-preview spike ran the server from Desktop's local MCP config and saw it render in Chat. For the plugin install, the platform-support table says plain Chat ignores a plugin's local MCP servers; they load in Claude Code and in Cowork sessions that run on the user's computer (install-landscape §4). The Cowork spike saw the plugin's server run on the device in a Chat with a connected folder, and that host advertised the UI extension (`/mnt/project-files/cowork-spike/FINDINGS.md`). The Code tab showed only the text result in the first spike. So for plugin users the inline pages reach local Cowork and Chat with a connected folder; plain Chat needs a `.mcpb` or a remote server; the Code tab and the Claude Code terminal stay on the text result unless a later Desktop renders MCP Apps there.

## Decisions

### One resource with views, not one resource per picker

Keep `ui://open-design/preview` and add `examples`, `design-systems` and `campaign` views.

- The shell, tokens, fullscreen, reload, error display and the bridge transport are already one bundle; separate resources would ship them four times and keep four CSP declarations in sync.
- The CSP is per resource. Every picker loads the same remote hosts (Google Fonts, plus remote origins of shown designs), so a union in one place is no looser in practice.
- Navigation between views is useful and only possible inside one page: a campaign tile opens the piece in the artifact view; an example card can open a larger view-only preview.
- Cost: a bigger page (three more renderers). The page is fetched once per conversation per host, and the renderers are plain DOM code without new dependencies.

Rejected: separate `ui://open-design/examples` etc. Only worth it if a host started rationing resources per tool or if one view needed a different CSP, neither of which is true today.

### New tools for catalogs, a flag for the campaign

`show_open_design_artifact` takes something that exists in the workspace. The examples and design-system catalogs live in the server, take filters, and have nothing to do with an `entryPath`; putting them on the same tool would turn its description into a menu. So they get their own tools, `show_open_design_examples` and `show_open_design_design_systems`. The campaign sheet is a view of one master artifact and its collection, so it is `show_open_design_artifact({ entryPath, campaign: true })`.

### The two catalog tools are listed only to MCP Apps hosts

Elsewhere they would duplicate `list_open_design_skills` and `list_open_design_design_systems` with a worse text result and grow every Codex and terminal tool list. The server already filters app-only tools by `clientSupportsMcpApps`; these use the same filter with their own flag. If one is called anyway, it returns a compact text list and names the `list_*` tool.

### Picks go back as chat messages; app-only tools only read

How a pick reaches the model, options:

1. **Chat message** (`app.sendMessage`, role user). Wakes the model, shows the person exactly what was asked, already proven in both spikes.
2. **Page calls the real tool** (e.g. `set_active_design_system`, `remix_open_design_example`) through `callServerTool`. The state changes but the model doesn't know until it next reads it, and a remix writes files into the workspace without the agent having a brief.
3. **App-only "record pick" tool** plus model context update (`ui/update-model-context` in the MCP Apps spec). Quiet, but it doesn't start a turn, the spike didn't test it, and the model would still have to call the real tool.

Choose 1. Rule: the page may call app-only tools that read, or that write data only the page owns (comments, as in add-mcp-app-preview). Anything that changes what the agent works on goes through a chat message naming the tool and its arguments. The agent asks before acting only where the pick branches (direction choice, remix without a brief); a design-system pick or a style-tile save is a direct instruction.

### Example previews are loaded lazily, one card at a time

193 examples cannot go into one state payload (each can be up to the 5 MiB cap). `get_open_design_preview_state({ view: "examples", ... })` returns the filtered list (id, title, mode, summary, at most 24 per page with a cursor); the page asks for each visible card's preview with `{ exampleId }`, bundled with the same standalone bundler as artifacts but reading assets from the server's bundled content. Cards show a placeholder until loaded and fall back to text over the size cap.

### Design-system tiles from tokens, detail from the existing renderer

A tile is the name, category, active flag, five swatches and the display and body font names, from `resolveDesignSystemDetailTokens`; systems without `tokens.css` use `extractColors` on DESIGN.md. Clicking a tile fetches `renderDesignSystemPreviewTab(…, 'visualize')`, the same script-free page VS Code shows, into a view-only frame. No new rendering code for the detail.

### Campaign data from a sidecar, not a re-render

The view reads `exports/campaign-sheet.json` written by the export, and the exported files it names (as data URLs, capped per tile). Re-rendering every shape in the page would need the export's browser pass and its preflight. Without a sidecar (an export from an older server, or none yet) the view shows `campaign-sheet.png` if it exists, else a message asking for an export with `campaignSheet: true`.

## Risks

- **Reach is narrow for plugin users.** Most plugin users in plain Chat will never see these pages. Skill text must keep the text path primary and call the show tools only when the server is loaded and the host renders MCP Apps (the tool result says which).
- **Lazy loading means many app-only calls.** One call per visible card; keep pages at 24 and bundle on demand with a small in-process cache.
- **A pick posts as the user.** It shows in the conversation as if typed. Keep the messages short and literal, as `pickDirectionMessage` does.

## Open Questions

- Does the Code tab render MCP Apps in a current Desktop build? If it does, the skills can show pickers there too.
- Is `updateModelContext` in ext-apps 1.7.5 and does Desktop honour it? Would let the page tell the model the current filter without a turn; not needed for this change.
