# Inline preview in Claude Desktop Chat

In a Claude Desktop **Chat** conversation, Open Design shows the design right in the conversation instead of a file path. You can comment on it there and hand the comments back to Claude without leaving the chat, and pick a starting example, a design system or a campaign piece from pictures. It's an [MCP App](https://github.com/modelcontextprotocol/ext-apps), so it shows only where two things hold: the Open Design server is running, and the host renders MCP Apps. Everywhere else the agent gets a text result and uses the [browser preview](browser-preview.md) instead.

| Where | What you see |
|---|---|
| Plugin install: a Cowork session on your computer, or a Chat with a [connected folder](../getting-started/claude-desktop.md#chat-with-a-folder) | The inline pages: the design with Comment, Ask Claude to apply, export buttons and Fullscreen, and the pickers below |
| Plain Chat (no folder) with the server added to Desktop's local MCP config, as the [Open Design desktop extension](../getting-started/claude-desktop.md#install-the-desktop-extension) (`.mcpb`), or as a remote server | The inline pages, for designs saved in a [managed folder](../getting-started/claude-desktop.md#chat-without-a-folder) |
| Plain Chat with only the plugin | Nothing from Open Design: Chat ignores a plugin's local MCP servers, so the server isn't running there |
| Claude Desktop's Code tab, the Claude Code terminal, Codex | A text summary (title, path, open comments); the agent opens the [browser preview](browser-preview.md). The picker tools aren't listed there |

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

For an exploration of **style tiles**, each tile also has **Use as design system**. It asks Claude directly to save that tile as a design system (`choose_open_design_direction` with `next: "save-design-system"`), with no question in between.

## Pick an example

> Show me some deck examples I could start from.

Claude calls [`show_open_design_examples`](../reference/tools.md#show_open_design_examples) and a gallery of the examples you can [remix](remix-and-gallery.md) appears: 24 cards at a time, each with a live preview that loads as it scrolls into view, and chips to filter by mode. **Show more** loads the next 24. Click **Remix this** on the one you want: a message naming the example appears in the chat, and Claude copies it into your folder with `remix_open_design_example`, asking first what to make with it if you haven't said. The gallery itself never writes a file.

## Pick a design system

> Which design systems would suit a fintech landing page?

Claude calls [`show_open_design_design_systems`](../reference/tools.md#show_open_design_design_systems), with a shortlist or a filter. Each tile shows the system's palette, fonts and category, and marks the active one. Click a tile to see its full Visualize page (colors, type scale, components); **Use this design system** posts your pick, and Claude makes it the active design system with `set_active_design_system`.

## Campaign sheet

After a [campaign](campaigns.md) export with the sheet, Claude can show it with `show_open_design_artifact` and `campaign: true`. Every tile is there with its label, a green or red dot, and its errors in words. Click a landing page or email tile to open that piece in the preview (the back arrow returns to the sheet), or **Fix this piece** to send the tile and its errors to Claude. A sheet exported by an older server shows as one image until you export again.

## How a pick reaches Claude

Every button that changes something (Remix this, Use this design system, Use as design system, Take this one, Fix this piece, Ask Claude to apply, the export buttons) posts a short message in the chat, as if you had typed it, naming the tool Claude should call. The page only reads data and saves your comments; Claude makes every other change, so you can see each request in the conversation.

## Limits

- Only Chat (and Cowork) render the inline pages, and only where the server runs (see the table above). The Code tab shows the text result; use the [browser preview](browser-preview.md) there.
- Links in the design open in your system browser after a confirmation, not in Claude's built-in browser.
- Designs larger than 5 MiB once inlined, and kinds that aren't HTML (Markdown, React components), show their latest check screenshot instead.

See [`show_open_design_artifact`](../reference/tools.md#show_open_design_artifact), [`show_open_design_examples`](../reference/tools.md#show_open_design_examples) and [`show_open_design_design_systems`](../reference/tools.md#show_open_design_design_systems) for the tools themselves.
