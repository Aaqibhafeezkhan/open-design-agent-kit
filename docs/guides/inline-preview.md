# Inline preview in Claude Desktop Chat

In a Claude Desktop **Chat** conversation, Open Design shows the design right in the conversation instead of a file path. You can comment on it there and hand the comments back to Claude without leaving the chat. It's an [MCP App](https://github.com/modelcontextprotocol/ext-apps), so it needs a host that renders MCP Apps; everywhere else the agent gets a text result and uses the [browser preview](browser-preview.md) instead.

| Where | What you see |
|---|---|
| Claude Desktop Chat (with a folder, or without one when the [desktop extension](../getting-started/claude-desktop.md#install-the-desktop-extension) is installed) | The design inline, with Comment, Ask Claude to apply, export buttons and Fullscreen |
| Claude Desktop's Code tab, the Claude Code terminal, Codex | A text summary (title, path, open comments); the agent opens the [browser preview](browser-preview.md) |

## Show a design

The `open-design` skill asks Claude to show the design after it registers one and again after it applies your comments. You can also ask at any time:

> Show me the coffee poster.

The first time, Claude Desktop asks you to allow the preview. The design renders from a self-contained copy: its local fonts, images and stylesheets are inlined, and Google Fonts load as usual. Images and scripts from other sites load only if the design used them before (the server declares those sites to Claude Desktop the next time the page loads); otherwise they're blocked.

Click **Fullscreen** for more room, and the reload button to fetch the latest version after Claude has changed the files.

## Comments

1. Click **Comment** in the preview's toolbar.
2. Click an element, type what should change, and click **Add**. A pin marks the element. Click a pin to resolve or delete its comment.
3. Click **Ask Claude to apply**. A message naming the design and the comment ids appears in the chat, and Claude applies them, re-registers the design with the comments resolved, and shows it again.

Comments are saved to the same `<entry>.comments.json` file as the [browser preview](browser-preview.md#comments) and VS Code use, so you can comment in one and apply from another.

## Export

The export buttons (PNG, PDF, HTML file, and PowerPoint for decks) post a request to Claude, which runs [`export_open_design_artifact`](../reference/tools.md#export_open_design_artifact) and tells you where the file was written. The preview never downloads anything itself, because Claude Desktop doesn't allow downloads from it.

## Explorations

When Claude [explores directions](explore-directions.md), it can show them side by side in one preview. **Take this one** posts your pick to the chat; Claude then asks whether to build it out, merge in parts of other directions, or save it as a design system before it calls `choose_open_design_direction`.

## Limits

- Only Chat renders the preview. The Code tab shows the text result; use the [browser preview](browser-preview.md) there.
- Links in the design open in your system browser after a confirmation, not in Claude's built-in browser.
- Designs larger than 5 MiB once inlined, and kinds that aren't HTML (Markdown, React components), show their latest check screenshot instead.

See [`show_open_design_artifact`](../reference/tools.md#show_open_design_artifact) for the tool itself.
