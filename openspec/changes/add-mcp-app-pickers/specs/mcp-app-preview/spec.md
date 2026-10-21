## ADDED Requirements

### Requirement: Picker Views on the Preview Resource
The preview resource `ui://open-design/preview` SHALL be the only MCP App resource the server registers. Besides the `artifact` and `exploration` views it SHALL render an `examples` view, a `design-systems` view and a `campaign` view, chosen by the `view` field of the showing tool's structured result, and SHALL load each view's data through the app-only `get_open_design_preview_state`. Every view SHALL keep the shared toolbar, reload and fullscreen.

#### Scenario: One resource for every picker
- **WHEN** an MCP client lists the server's resources
- **THEN** it SHALL see `ui://open-design/preview` and no other `ui://` resource

#### Scenario: Picker data stays out of the model's context
- **WHEN** `show_open_design_examples` returns
- **THEN** its result SHALL carry only the view, filters and a title, and the page SHALL fetch the example list and previews through `get_open_design_preview_state`

### Requirement: Example Gallery Picker
The server SHALL provide `show_open_design_examples` taking optional `query`, `mode` and `surface`, declaring the preview resource as its UI. The page SHALL show the matching remixable examples as cards, at most 24 per page, loading each card's view-only preview on demand and showing text in place of a preview larger than 5 MiB. Each card SHALL offer "Remix this", which sends a chat message naming the example's skill id and `remix_open_design_example`.

#### Scenario: Pick an example to remix
- **WHEN** the person clicks "Remix this" on `od:deck:swiss-international:example`
- **THEN** a chat message naming that skill id and `remix_open_design_example` SHALL be sent, and the page SHALL NOT copy any file itself

#### Scenario: Filter by surface
- **WHEN** the agent calls `show_open_design_examples` with `surface: "slides"`
- **THEN** the page SHALL show only remixable examples on the slides surface

### Requirement: Design System Picker
The server SHALL provide `show_open_design_design_systems` taking optional `query`, `category` or `ids`, declaring the preview resource as its UI. The page SHALL show each design system as a tile with its name, category, active mark, palette swatches and font names, resolved from its tokens (or its DESIGN.md colors without `tokens.css`).

#### Scenario: Shortlist
- **WHEN** the agent passes `ids` with three design system ids
- **THEN** the page SHALL show exactly those three tiles

### Requirement: Design System Pick
Opening a design system tile SHALL show its Visualize page in a view-only frame. "Use this design system" SHALL send a chat message naming the id and `set_active_design_system`.

#### Scenario: Pick a brand look
- **WHEN** the person opens the Stripe tile and clicks "Use this design system"
- **THEN** a chat message naming `stripe` and `set_active_design_system` SHALL be sent, and the active design system SHALL change only when the agent calls that tool

### Requirement: Style Tile Picks Inline
For an exploration made with the style-tile skill, each direction card in the exploration view SHALL also offer "Use as design system", which sends a chat message naming the exploration, the direction and `choose_open_design_direction` with `next: "save-design-system"`.

#### Scenario: Save a tile from the inline page
- **WHEN** the person clicks "Use as design system" on tile B of a style-tile exploration
- **THEN** a chat message naming tile B and `next: "save-design-system"` SHALL be sent

### Requirement: Campaign Sheet Inline
`show_open_design_artifact` SHALL accept `campaign: true` with a fluid master's `entryPath`. The page SHALL then show every tile of the master's last campaign sheet from `exports/campaign-sheet.json` and the exported files it names, labelled, with an error dot and messages on each tile that has preflight errors. Without a sidecar the page SHALL show `campaign-sheet.png` if it exists, else ask for an export with `campaignSheet: true`.

#### Scenario: Not exported yet
- **WHEN** the master has no campaign sheet
- **THEN** the page SHALL ask for an export with `campaignSheet: true` and show no tiles

### Requirement: Campaign Tile Actions
On the campaign view, a page-type piece's tile SHALL open that piece in the artifact view, and "Fix this piece" SHALL send a chat message naming the tile's shape or entry path and its errors.

#### Scenario: Open the landing page from the sheet
- **WHEN** the person clicks the landing page tile
- **THEN** the page SHALL show the landing page in the artifact view

#### Scenario: Failing banner on the inline sheet
- **WHEN** the `banner-mobile` tile has an `overflow` error and the person clicks "Fix this piece"
- **THEN** the tile SHALL show the error dot and message, and a chat message naming `banner-mobile` and the `overflow` error SHALL be sent

### Requirement: Picks Go Through the Chat
A pick in any view SHALL reach the model only as a chat message sent through the MCP Apps bridge, naming the tool and arguments the agent should use. The page SHALL call only app-only tools, which either read state or write data only the page owns (comments), and SHALL NOT call a model-visible tool.

#### Scenario: Remix stays with the agent
- **WHEN** the person picks an example
- **THEN** no workspace file SHALL change until the agent calls `remix_open_design_example`

### Requirement: Picker Tools Only for MCP Apps Hosts
`show_open_design_examples` and `show_open_design_design_systems` SHALL appear in `tools/list` only for clients that render MCP Apps. If one is called by another client, it SHALL return a short text list of matches and name `list_open_design_skills` or `list_open_design_design_systems`.

#### Scenario: Codex lists no picker tools
- **WHEN** a client without the MCP Apps extension lists tools
- **THEN** neither picker tool SHALL be listed, and `show_open_design_artifact` SHALL still be listed

### Requirement: Documented Reach of the Inline Pages
The inline preview guide SHALL state that the inline pages render only where the Open Design server is running and the host renders MCP Apps: Cowork sessions on the user's computer and Chat with a connected folder for the plugin install; plain Chat only with the server added to Desktop's local MCP config, a `.mcpb` or a remote server, because Chat ignores a plugin's local MCP servers; and that the Code tab and the Claude Code terminal get the text result.

#### Scenario: Plugin user in plain Chat
- **WHEN** a plugin user reads the guide's "Where" table
- **THEN** it SHALL say that plain Chat does not load the plugin's server and so shows no inline pages
