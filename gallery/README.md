# Gallery

A static site of the bundled design systems and remixable examples, built by `scripts/build-gallery.ts` and deployed to GitHub Pages by the **Gallery** workflow.

It is hub and spoke:

- **Hubs** (`design-systems/`, `examples/`): a grid of thumbnails, titles and tags, with a search box and tag filters.
- **Spokes** (`<hub>/<id>/`): the item full size, its files to download, and buttons that hand the next step to the visitor's agent. A design system spoke offers a prompt for the Open Design kit ("Use the Open Design design system …") and one for Claude Design, with an **Open in Claude** link that starts a new chat with it. An example spoke offers the kit's remix prompt and the example's brief.

No page acts for the visitor. Claude has no API for adding a design system, and a web page can't reach the kit's MCP server, so every button copies a prompt, opens a new chat, or links to files.

## Build it

```bash
npx tsx scripts/build-gallery.ts                # the pilot in gallery/pilot.json, into dist/gallery/
npx tsx scripts/build-gallery.ts --all          # every bundled design system and example
npx tsx scripts/build-gallery.ts --no-thumbs    # skip thumbnails (no browser needed)
```

Thumbnails need Chrome, Edge or Chromium, found the same way as for exports (`OPEN_DESIGN_BROWSER_PATH` overrides it). Design systems use their Claude Design cover with the system's tokens; examples use the top of the page at 1280×800. Without a browser, cards show the system's colors instead.

Every page carries `noindex` until the site is built with `--index`.

## Deploy it

1. In **Settings → Pages**, set the source to **GitHub Actions**.
2. Run the **Gallery** workflow from the Actions tab. Leave **all** and **index** off for the pilot.

The workflow runs by hand only, because the site is public once deployed.

## The pilot

`pilot.json` lists 10 genre design systems (no brand names) and 10 examples across posters, pages, a résumé, an email and decks. Edit it to change what the pilot shows.
