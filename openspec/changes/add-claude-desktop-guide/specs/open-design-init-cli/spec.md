## ADDED Requirements

### Requirement: Claude Code Setup Registers the Preview for the Code Tab
When `claude` is selected, the command SHALL merge an `open-design-preview` configuration into the target path's `.claude/launch.json` (creating it if absent) that runs the kit's `preview` command without opening a browser window, on a fixed loopback port, so Claude Desktop's Code tab can open the preview in its Browser pane. It SHALL leave every other configuration unchanged and SHALL update its own entry in place on re-run.

#### Scenario: Fresh project
- **WHEN** `claude` is selected and the target has no `.claude/launch.json`
- **THEN** one SHALL be created containing only the `open-design-preview` configuration

#### Scenario: Existing configurations
- **WHEN** `.claude/launch.json` already has a `web` configuration
- **THEN** `web` SHALL be unchanged and `open-design-preview` SHALL be added beside it
