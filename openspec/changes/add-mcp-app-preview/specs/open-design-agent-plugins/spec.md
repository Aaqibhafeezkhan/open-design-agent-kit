## MODIFIED Requirements

### Requirement: No Editor Dependency in the MCP Server
The MCP server SHALL run and serve all of its tools correctly with no VS Code (or any other editor) process present, using only `packages/core`, `packages/content`, Node's filesystem APIs, an MCP transport library and the MCP Apps SDK. It MAY provide preview and comment features that render in the host (MCP Apps) or in a browser it opens; WYSIWYG editing SHALL remain exclusive to the VS Code extension's webview-based editor.

#### Scenario: Runs standalone
- **WHEN** the MCP server is started via its `npx`-invocable binary in an environment with no editor or daemon process running
- **THEN** all of its tools SHALL function normally, sourcing content from `packages/content`'s bundled assets

#### Scenario: No preview/comment/edit tools are exposed
- **WHEN** an MCP client lists the tools this server provides
- **THEN** no tool for performing WYSIWYG edits SHALL be present; preview and comment tools (the browser preview, the MCP App preview and its app-only comment tool) MAY be present
