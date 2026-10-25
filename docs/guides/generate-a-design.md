# Generate a design

Ask for a design in plain words; your agent picks a recipe from Open Design's catalog, writes the files and registers them as an **artifact**.

## Before you start

Open Design is set up for your host: [VS Code](../getting-started/vscode.md), [Claude Code](../getting-started/claude-code.md) or [Codex](../getting-started/codex.md).

## Steps

1. **Ask.** Describe what you want and, if you care, the look:

   > A pricing page for a developer tool, three tiers, dark, Linear-like.

2. **The agent picks a recipe.** It calls [`list_open_design_skills`](../reference/tools.md#list_open_design_skills) and chooses from the catalog:
   - about 160 **skills** (task recipes such as `guizang-ppt` or `data-report`);
   - about 115 **design templates** (rendering styles);
   - 167 **examples** (real rendered artifacts).

   Ids look like `od:<mode>:<name>`; the mode is `prototype`, `deck`, `design-system`, `image`, `video`, `template`, `utility` or `audio`.

3. **The agent asks what's missing, if anything.** See [A few questions first](#a-few-questions-first).
4. **The agent gets instructions.** [`prepare_open_design_brief`](../reference/tools.md#prepare_open_design_brief) combines:
   - the recipe's workflow;
   - your [active design system](design-systems.md), if any;
   - the craft rules the recipe asks for (for example typography, color, accessibility, or avoiding a generic "AI" look);
   - your brief, with your answers and anything the agent assumed;
   - a short list of your recent designs, so this one doesn't look the same (see [Why designs vary](#why-designs-vary)).

   It writes nothing.

5. **The agent writes the files** with its own file tools, under `.open-design/<name>/`.
6. **The agent registers the artifact** with [`register_open_design_artifact`](../reference/tools.md#register_open_design_artifact), which writes the `<entry>.artifact.json` manifest.
7. **The agent looks at it.** [`check_open_design_artifact`](../reference/tools.md#check_open_design_artifact) renders the design (desktop and mobile for a page, slide by slide for a deck) and hands the agent screenshots plus the [preflight](posters.md#preflight-checks) findings. It fixes errors such as clipped text or a page that scrolls sideways on phones, and anything that looks off, for up to two rounds, then tells you about anything left. It needs an installed Chrome, Edge or Chromium; without one the agent skips this step and says so.

To skip the choosing, run a [curated recipe](../reference/prompts-and-commands.md#curated-entries) directly (e.g. `/od-deck-guizang-ppt …`), or [remix a real example](remix-and-gallery.md).

> **In VS Code:** `/open-design-generate` runs the same flow explicitly, and `/open-design-list-skills` just browses. The result opens in the [preview](preview-comments-edit.md).

> **In Claude Code / Codex:** the `open-design` skill drives this flow from any design request, then opens the design in the [browser preview](browser-preview.md).

## A few questions first

Each kind of thing to make (a poster, slides, a landing page…) has two or three questions whose answers change the design, each with a few options and a default. For a poster:

> Where will it be seen? Printed · On screens · Both (changes size, bleed and file type)

The agent asks only what your request, the conversation and the folder don't already answer: at most three questions, once, in one message, together with any [design system](design-systems.md#not-sure-which-one) questions. Say "you pick" and it uses the defaults. A detailed request gets no questions:

> A printed A3 poster for our jazz night on 4 May, dark and moody.

Whatever the agent decides without asking (a dark theme, one sign-up button) it passes on as an assumption, and when the design is ready it lists them in one sentence ("I assumed a dark theme and one sign-up button; say if you want otherwise"), so a wrong guess costs one message, not a rebuild. Your answers and its assumptions are kept in the manifest as `metadata.brief`, so a later "make it lighter" can see what was decided.

## Why designs vary

Ask for five designs in a week and, left alone, they come out alike. Each time a design is registered, Open Design writes a line to `.open-design/history.json`: its title, recipe, design system, collection, date and a small **look signature** read from the HTML (accent colour, display and body fonts, light or dark, and the hero layout: centred, split, full-bleed image or none). It keeps the latest 50 and stores no HTML and no brief text.

The next brief lists up to five recent designs and asks for one that is recognisably different in at least two of theme, hero layout, display font and accent, unless you asked for the same look or the design system decides it (its tokens always win). Screens of the same [collection](#collections) are listed as ones to keep consistent with instead, and exploration sketches are left out.

To turn this off, add `"variety": false` to `.open-design/config.json`; the history is still written. Deleting `history.json` is safe.

## Grounded in your app

If the workspace's `package.json` shows a React, Vue, Next.js, Nuxt, Svelte, Angular, Astro or Solid app, the instructions ask the agent to look at a few of your real components first, so the prototype matches your app's look. The artifact is still a standalone file; [promoting it](promote-to-app-code.md) is a separate step.

## Collections

For a multi-screen flow (onboarding, checkout, a set of app screens), ask for several screens at once:

> Design a 4-screen onboarding flow for a budgeting app.

The agent generates each screen as its own artifact with a shared `collectionId`. Each screen's instructions list the other screens (role and title), so they stay consistent, and the design system chosen for the first screen carries through to the rest.

> **In VS Code:** the **Collections** view (Open Design activity-bar icon) lists each collection's screens, and the preview gets previous and next buttons.

## What you get

```
.open-design/pricing-page/pricing-page.html                ← the design (HTML, CSS and assets beside it)
.open-design/pricing-page/pricing-page.html.artifact.json  ← its manifest
```

Plain files: diff, review and commit them. See [Artifact manifest](../reference/artifact-manifest.md).

## Troubleshooting

- [The agent doesn't use Open Design](../troubleshooting.md#the-agent-doesnt-use-open-design)
- [Unknown skillId](../troubleshooting.md#unknown-skillid)

## Related

[Design systems](design-systems.md) · [Remix and the gallery](remix-and-gallery.md) · [Export images](export-images.md) · [Export decks and PDFs](export-decks.md)
