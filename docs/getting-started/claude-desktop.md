# Claude Desktop

Claude Desktop runs Open Design through the same plugin as [Claude Code](claude-code.md), but what works depends on where you use it:

| Where | Works? | What you get |
|---|---|---|
| **Code tab** | Yes | Everything Claude Code does, plus the Browser pane for looking at designs and leaving comments |
| **Chat with a folder** | Yes | Skills and tools run on your machine and write into the folder you connected |
| **Chat without a folder** | No | Claude has no tool that writes to your disk there, so it can't create design files |

## Before you start

- Claude Desktop.
- Node.js 18 or later on the machine Desktop runs on (the plugin starts the MCP server with `node` and `npx`).
- Optional: an installed Chrome, Edge or Chromium, for visual checks and exporting images, PDFs and PowerPoint.

## Install the plugin

1. Open **Customize → Plugins** and choose **Add marketplace**.
2. Enter `feimacode/open-design-agent-kit`.
3. Install **Open Design**.

In the Code tab you can also install it the Claude Code way (`/plugin marketplace add feimacode/open-design-agent-kit`, then `/plugin install open-design`), or write it into your project with [`init`](claude-code.md#option-b-write-it-into-your-project).

## Code tab

The Code tab is Claude Code, so [Claude Code's getting-started page](claude-code.md) applies as it is. Desktop adds the **Browser pane** (Cmd+Shift+B).

### Open a design by clicking its path

After Claude registers or updates a design, its reply gives the file's path on its own line, for example:

```
.open-design/coffee-poster/coffee-poster.html
```

Click it and the design opens in the Browser pane. The same works for the comparison page and contact sheet of an [exploration](../guides/explore-directions.md), and for exported PNG, PDF and video files.

### The live preview in the Browser pane

The [browser preview](../guides/browser-preview.md), with its live reload, **Comment** button and **Checks** panel, can run inside the Browser pane too. Desktop opens local servers listed in `.claude/launch.json`.

If you set the project up with `npx @feimacode/open-design-agent-kit init --tools claude`, that entry is already there. With the plugin, add it yourself to `.claude/launch.json` in your project (merge it into `configurations` if the file exists):

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "open-design-preview",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["-y", "@feimacode/open-design-agent-kit", "preview", "--no-open", "--port", "5317"],
      "port": 5317
    }
  ]
}
```

Then ask Claude to "start open-design-preview in the Browser pane". Comments you leave there are saved next to the design, the same as in any other browser. The pane has no chat box of its own, so when you're done, tell Claude in the Code tab "apply my comments on the coffee poster".

## Chat with a folder

1. Start a new Chat and connect a folder (Claude asks for one, or use the chat's **+** menu).
2. Ask for a design, for example:

   > Make an A3 poster for our coffee tasting night, warm and editorial.

The plugin's MCP server runs on your machine, not in Claude's sandbox. It starts in your home folder, so the first thing Claude does is call `set_open_design_workspace` with the connected folder's path. You don't need to do anything for that. Designs are written under `.open-design/` in that folder.

The first start downloads the server package once (about 12 MB), so it needs the network that time. npm caches it afterwards.

For Figma without Figma's own connector, save a token in `~/.config/open-design/figma-token`. Plugin settings can't hold it, because Desktop won't start a plugin server that uses them. See [Figma: no access token](../troubleshooting.md#figma-no-access-token).

> Chat with a folder needs a server release that includes `set_open_design_workspace`. If tools refuse with a message about the home folder and Claude has no `set_open_design_workspace` tool, the plugin still runs an older server. Update the plugin once a newer one is out.

## Chat without a folder

A Chat with no folder has nowhere on your disk for Claude to write, so the kit can't make designs there. Connect a folder from the chat's **+** menu, or start a new Chat and connect one, then ask again.

## Known limits

- **No downloads from inline pages.** Desktop refuses files offered for download by a page shown in Chat. Ask Claude to export instead: the files are written in your folder and Claude gives you their paths.
- **Links open in your system browser.** A link opened from Chat goes to your default browser, not the Browser pane. On Linux under WSL with no default browser set, nothing opens; installing `wslu` sends links to your Windows browser.
- **Tested on Linux only.** These steps were tried on Desktop's Linux build in WSL2. macOS and Windows are expected to work the same way but are untested. On macOS, a Node installed with nvm may not be found by Desktop when it's launched from the Dock (see [troubleshooting](../troubleshooting.md#claude-desktop-node-not-found-on-macos)).

## Next

- [Generate a design](../guides/generate-a-design.md), [Posters and print](../guides/posters.md) and [Browser preview and comments](../guides/browser-preview.md)
- [Troubleshooting Claude Desktop](../troubleshooting.md#claude-desktop)
