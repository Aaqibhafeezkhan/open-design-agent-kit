## Why

The public gallery (`scripts/build-gallery.ts`, deployed to GitHub Pages) shows every design system and remixable example full size, in both the kit's format and Claude Design's, with copyable prompts and file downloads. Nothing in the kit points people to it yet. Two moments are where a link would help most:

- **Browsing.** Someone asks for inspiration ("show me some examples", "what styles are there?", "ideas for a café menu"). In Claude Desktop Chat and VS Code the agent can already show the in-chat galleries (`show_open_design_examples`, `show_open_design_design_systems`), but those show a filtered handful in a narrow frame. The full gallery has every item, tags and search, and stays open in a browser tab.
- **After a design is finished.** The person has just seen a design in a style such as Kami. The gallery's page for that design system shows its tokens, its Claude Design version and the prompt to reuse it elsewhere, so it's a natural next step.

Concrete requests ("make a poster for our seed swap") shouldn't get a link: it only slows the person down.

The site is still a noindex pilot, and the "-inspired" names and the upstream licence are open questions. So every link has to stay off until the site is public, and turn on with one setting.

## What Changes

- **Gallery address as content data.** A new `packages/content/local/gallery.json` holds the site's `url` and a `live` switch (`false` to start). No tool or skill text gives a gallery link while `live` is `false`.
- **Gallery links in the picker results (item 1).** While live, `show_open_design_examples` and `show_open_design_design_systems` return a `gallery` field: the matching hub's URL, filtered with the hub's hash (`#q=<query>`) when the call had a free-text query. The inline gallery views show a **See them all in the gallery** link at the bottom, opened through the host's link handling.
- **Design-system page link on a finished design (item 3).** While live, `register_open_design_artifact` returns `designSystem: { id, galleryUrl }` when the artifact records a bundled design system (its `designSystemId`). That's the gallery's page for that system. Custom, generated and URL-extracted systems have no page and get no link.
- **When the agent links (skill text).**
  - Browsing request: show the in-chat gallery where it is in the tools, then add one line linking the gallery (`gallery.url` from the result). Elsewhere, keep today's lists.
  - Finished design: when the agent says the design is ready the first time a design system is used in a session, name the system with a link to its gallery page. Not repeated for later rounds or designs with the same system.
  - Never on a concrete request before the design, never in a recurring job run, and at most once per kind of link per session.
- **The site deploys everything while live.** The Gallery workflow builds every bundled design system and example (`--all`) whenever `gallery.json` says `live`, so every `galleryUrl` the server returns has a page behind it.

Not in this change: links on hosts without inline galleries (terminal, Codex, claude.ai without the kit), linking example pages after a remix, and making the site public (a separate decision on names and licence).

## Capabilities

### New Capabilities
- `gallery-links`: the gallery's address and switch, the `gallery` and `designSystem.galleryUrl` result fields, the inline views' gallery link, and when the agent may link.

### Modified Capabilities
None. The picker and register tools gain fields; their existing behaviour is unchanged.

## Impact

- `packages/content/local/gallery.json` (new), its loader in `packages/core/src/content/contentIndex.ts`, and the content sync check (valid `https` URL, boolean `live`).
- `packages/mcp-server/src/tools.ts`: `showExamples`, `showDesignSystems`, `registerArtifact`; `packages/mcp-server/src/index.ts` descriptions; unit tests.
- `packages/core/src/preview/mcpApp/`: footer link in the examples and design-systems views.
- Skills: `packages/claude-plugin/skills/open-design/SKILL.md` and its generated copies; `packages/content/local/prompts/new.md`.
- `scripts/build-gallery.ts` and `.github/workflows/gallery.yml`: read `gallery.json`, force `--all` while live, and share the spoke-URL rule with the server.
- Docs: `docs/reference/tools.md` (new fields), `gallery/README.md` (the switch).
