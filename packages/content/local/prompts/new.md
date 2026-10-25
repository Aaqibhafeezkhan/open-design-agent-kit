---
name: open-design-new
description: Start a new design by picking what to make (prototype, mobile app, slides, document, wireframe, animation, résumé, research, data report, poster, social post, diagram), then build it with the right recipe
argument_hint: what to make, optionally followed by the brief (e.g. "a wireframe of onboarding for a budgeting app")
placeholder: What do you want to make, and what is it for?
---

Start a new design with Open Design.

Request: {{brief}}

{{voice}}

## 1. Pick the surface

Call `list_open_design_skills` with `surface: "list"` to get the kinds of thing Open Design can make (`surfaces`, each with an id, label and description) and the `goals`, plain-language aims such as "Promote an event" or "Get hired", each with the surfaces it leads to.

- If the request starts with or clearly names a surface (by id or label, e.g. "wireframe", "diagram", "a poster"), use that surface.
- If it says what the design is for but names no surface ("help me get a UX job"), take the goal that fits.
- If it is empty or too vague to tell, show the user the goals (label and description) and ask one question: "What's it for?". Stop until they answer. Show the surfaces instead only if they ask what kinds of thing you can make.
- Once you have a goal, call `list_open_design_skills` with `goal` set to its id and use the surface marked `default`, unless the request points at another of that goal's surfaces. Ask which one only when the goal leads to several and you can't tell.

## 2. Ask what's missing

Call `list_open_design_skills` with `surface` set to the chosen id. The result has the surface's `questions` and its `entries`.

Ask only the questions the request doesn't already answer, all at once, in one short message. If the request answers them all, don't ask anything.

If no design system is active and the request names no look, also call `recommend_open_design_design_systems` with what you know (the surface, what it's for, how it should feel). If its result has `questions`, add the ones the request doesn't answer to that same message, and accept "you pick". Use its first recommendation as the `designSystemId` in step 3, and say which style you used and that they can pick another.

<!-- claude-only -->
**Asking with taps (Claude Desktop Chat).** Where `show_open_design_questions` is in your tool list (it is listed only where the host shows MCP Apps inline), ask these questions through it instead of a chat message: all of them in one call, at most four, each with a short `id`, its `text` and its choices as `options`. Give a design-system option `imageRef: "designSystem:<id>"` so the user sees its palette. Don't repeat the questions in chat. The answer arrives as a message starting "Answers:" with a line `<!-- od-answers {...} -->`: read that JSON (`you-pick` means choose for them). If the user types their answers instead, use those.
<!-- /claude-only -->

## 3. Build it

- If the surface has a `prompt` (for example `open-design-poster` or `open-design-social-post`), follow that flow from its first step with the user's request as the brief. In Copilot Chat it's the `/` command of the same name; in Claude Code and Codex it's the skill of the same name.
- Otherwise pick the entry that best fits the request. Entries come in curated order: the recipe first, then its remixable example when there is one. To start from a rendered example (an entry with `remixable: true`), call `remix_open_design_example`; otherwise call `prepare_open_design_brief` with its id, the brief and any recommended `designSystemId`, and follow the general Open Design flow: write the files, register the artifact, then check it with `check_open_design_artifact` before saying it's done.

<!-- claude-only -->
**Picking by eye (Claude Desktop Chat).** When the user wants to choose a starting example from pictures, and `show_open_design_examples` is in your tool list (it is listed only where the host shows MCP Apps inline), call it with `surface` set to the chosen id instead of listing entries in text. "Remix this" posts the pick in the chat; then call `remix_open_design_example` with the skillId it names. Without that tool, keep to the text list above.
<!-- /claude-only -->

<!-- claude-only -->
**Artifact preview.** If you have an Artifact tool, publish this design as its private artifact preview once it's registered and checked: call `publish_open_design_artifact` with `provider: "claude-artifact"` and follow what it returns. Publish again after each round of feedback you apply; it goes to the same artifact. Give the link once, then just say the preview was updated.
<!-- /claude-only -->

Never pick an entry marked `stub: true`.
