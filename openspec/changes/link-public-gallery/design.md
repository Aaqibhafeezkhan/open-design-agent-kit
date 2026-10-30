## Context

The gallery is a static site built by `scripts/build-gallery.ts`: hubs at `design-systems/` and `examples/` (filterable with `#tag=` and `#q=`), a page per item at `<hub>/<id>/`, and `gallery.json` for agents. GitHub Pages serves it at `https://feimacode.github.io/open-design-agent-kit/`. It's a pilot: every page is noindex, and the workflow runs by hand.

The kit already has the two moments in code. `show_open_design_examples` and `show_open_design_design_systems` are listed only where the host renders MCP Apps, and `register_open_design_artifact` knows which design system an artifact used (from the manifest).

## Goals / Non-Goals

**Goals**
- One switch turns every gallery link on or off, so nothing points at the pilot.
- The agent links at browsing moments and once after a finished design, never on a concrete request.
- Every link the server returns resolves to a page.

**Non-Goals**
- Links on hosts without inline galleries. That needs the site public first and its own wording rules; it's a follow-up.
- Example-page links after a remix.
- Deciding when the site goes public.

## Decisions

**1. The URL and switch live in `packages/content/local/gallery-site.json`, not in code or an env var.** It ships with the content, so the server, the build script and the workflow read the same value, and the sync check validates it. Alternative: a server option or env var. Rejected because the plugin and the extension would each need configuring, and the build script couldn't see it.

```json
{ "url": "https://feimacode.github.io/open-design-agent-kit/", "live": false }
```

**2. The server returns links; the skill decides when to say them.** Tools return `gallery` and `designSystem.galleryUrl` whenever live. Whether to mention them is skill text, because only the agent knows whether the request was browsing or concrete. Alternative: return the link only when the tool guesses it's wanted. Rejected because a tool can't see the conversation.

**3. The picker link is filtered by the call's query.** `show_open_design_examples({ query: "café" })` returns `examples/#q=caf%C3%A9`. `mode` and `surface` don't map onto the hub's tags one to one, so they're left out rather than guessed. A shortlist (`ids`) gets the plain hub.

**4. The inline views open the link through the host.** The examples and design-systems views add a footer link and open it with the MCP Apps `openLink` request. Where the host doesn't advertise link support, the footer isn't drawn, and the agent's own line is the only link.

**5. A design-system page exists exactly for bundled systems, and the workflow guarantees it.** `galleryUrl` is returned only for a `built-in` design system. While `live`, the workflow ignores its `all` input and builds every built-in system and example, so no link can point at a system the pilot left out. The rule ("built-in means it has a page") lives in one helper used by the server and the build script.

**6. Once per kind of link per session, in skill text.** Agents keep no state across turns other than the conversation, so the rule is phrased as "if you haven't already linked the gallery in this conversation". The finished-design link is per design system: a second design in the same style doesn't repeat it, but a new style gets its own.

**7. The finished-design link is one clause, not a new line.** The skill already ends each step with one line of next steps (at most two options). The link goes in the ready sentence ("It uses the [Kami](…) design system."), so it doesn't add a third option.

## Risks / Trade-offs

- **Link fatigue.** Mitigated by the once-per-session rule and by never linking on concrete requests. The output-quality evals can check that the shop-pack and vague briefs don't gain links.
- **Wrong trigger words.** "Ideas" can mean "make something" ("I have an idea for an app"). The skill lists browsing phrases as examples, not keywords, and says to link only when the person wants to look before deciding.
- **Stale site.** The server's catalog can get ahead of the deployed site (a new bundled system before the workflow reruns). Mitigation: the release checklist reruns the Gallery workflow after a content sync; a missing page is a 404, not a wrong page.
- **Hosts that strip links.** Desktop Chat renders Markdown links; if a host doesn't, the bare URL still works.

## Resolved Questions

- **A link after an export or publish?** No (Iven, 2026-10-30). The skill says never to link the gallery there.
- **Should `live` drop the gallery's noindex?** No (Iven, 2026-10-30). Indexing stays the workflow's separate `index` input.

The file is `gallery-site.json`, not `gallery.json`, so it isn't confused with the site's own `gallery.json` for agents. `register_open_design_artifact` uses the design system passed as `designSystemId`, or the active one when none is passed, since agents usually leave it out when one is active.
