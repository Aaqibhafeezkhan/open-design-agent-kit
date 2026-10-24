## Context

The preview MCP App is one `ui://open-design/preview` resource with views for an artifact, explorations, examples, design systems and campaigns. Model-visible show tools (`show_open_design_artifact`, `show_open_design_examples`, `show_open_design_design_systems`) carry `previewAppToolMeta()`; app-only tools (`get_open_design_preview_state`, `save_open_design_comment`) carry `appOnlyToolMeta()`. Picks are sent with `app.sendMessage({ role: 'user', content: [{ type: 'text', text }] })` in `mcpApp/transport.ts`, and the agent then calls the real tool.

## Goals / Non-Goals

**Goals:** fewer typed answers for Desktop users; one renderer that fits every question the kit asks; answers the agent reads reliably; nothing a page can do that the user didn't tap.

**Non-Goals:** a general UI generation language (OpenUI Lang, A2UI); forms that call tools directly; arbitrary HTML or images from the model in the view; multi-step wizards; replacing the host's own question tool where one exists and works.

## Decisions

### A schema the kit owns, not a generative UI

The kit's questions all have the same shape: a few choices, sometimes with pictures, sometimes "other". A fixed schema covers them, is trivial to validate, and can't be used to render anything the kit didn't design. OpenUI Lang would bring a parser, a component library and a prompt-size cost for no question we ask.

### Images by reference

Letting the model pass image URLs would load remote content in the host and need CSP domains. `imageRef` names objects the server already renders for the pickers (design-system previews, example previews, artifact or check-run screenshots), so the existing app-only state path and size caps apply.

### The answer is a user message

MCP Apps can update model context or send a message; a message is visible, so the user sees exactly what was sent, and it works in every MCP Apps host. The readable line is for the user; the HTML-comment JSON line is for the agent, and the skills say to prefer it. If a host strips comments, the readable line still parses (`id = label` pairs).

### Text fallback from the same tool

Non-MCP-Apps hosts don't list the tool, but generated skills are shared across hosts. When called anyway, the tool returns "Ask the user these in one message:" and the numbered questions with options, so the skill has one instruction path.

### Limits

Four questions, eight options each, 120 characters per label, 2 KB for the whole schema. Matches "ask at most three" in `add-brief-questions` with room for one follow-up.

## Risks / Trade-offs

- **Host support varies** for `sendMessage`. Where it fails, the view shows "Copy answers" with the readable line, and the transport's existing error path logs it.
- **Users ignore the card and type.** Fine: the agent accepts typed answers as before.
- **Feedback chips feel pushy** after every design. They're small and below the design, and hidden in fullscreen.

## Open Questions

- Should the critic's findings be shown as checkboxes ("fix these?") in the ask view? Proposed: yes, as a `multi` question, once `add-design-critic` ships.
