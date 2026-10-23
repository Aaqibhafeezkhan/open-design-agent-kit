## Context

The kit has three first-run states in Claude Desktop Chat (from `docs/getting-started/claude-desktop.md` and `docs/guides/inline-preview.md`):

| State | What Claude has | What happens today |
|---|---|---|
| Plain Chat, plugin only | Skills, no Open Design tools | Step 0 of the overview skill: one sentence naming a `.mcpb` file and GitHub releases |
| Plain Chat, desktop extension | Tools, no folder | Agent calls `use_open_design_managed_workspace`, usually without explaining it |
| Chat with a folder, plugin or extension | Tools and a folder | Agent calls `set_open_design_workspace` silently |

In every state, a vague request ("help me make something for my café") goes to `open-design-new`, which lists surfaces.

## Goals / Non-Goals

**Goals**
- A non-technical person who opens a fresh Chat and types an idea gets, in the first reply, either a working setup or two concrete steps to get one, plus one question about what the design is for.
- Goals live in data that tools return, so every host shows the same list and the build guard keeps it valid.

**Non-Goals**
- Installing anything for the user. The agent can't, and the extension needs a double-click.
- Replacing surfaces. Surfaces stay the unit the rest of the flow uses; goals only route to them.

## Decisions

**1. Goals as data in `surfaces.json`, not as a list in skill text.** The skill text would have to be kept in step across four copies and the `new` prompt; a list in the catalog is checked by the sync guard and returned by one tool. Alternative considered: a separate `goals.json`. Rejected because goals only make sense against surfaces, and one file keeps the guard simple.

**2. `surface: "list"` returns goals as an extra field instead of a new tool.** Agents already call it at the start of `open-design-new`. A new tool would need its own listing rules and descriptions on every host.

**3. Starter goals and their surfaces.**

| Goal | Surfaces, in order |
|---|---|
| Promote an event | poster, social, campaign |
| Sell or run a small shop | poster, social, campaign, email |
| Show an idea | prototype, mobile, slides |
| Get hired | resume, document, social |
| Explain something | slides, document, diagram, data-report |
| Post regularly | social, campaign |
| Build a product screen | prototype, mobile, wireframe |

"Build a product screen" keeps the technical path one click away for people who do know what a wireframe is.

**4. The welcome gives clicks, not file names.** "Click + → Add folder" instead of "connect a folder"; "download the file from the releases page, double-click it" instead of `open-design-<version>.mcpb`. The release page link is the stable `releases/latest` URL already used in the Desktop guide.

**5. The tools-present welcome is one sentence, once per session.** It names the folder (absolute path for a managed workspace; the folder's name for a connected one) and says designs are saved there. It isn't repeated on later designs in the same chat.

## Risks / Trade-offs

- **The goal list may not match how people talk.** Mitigation: it's data; adjust after the usability test the report proposes.
- **One more question before the first design.** Only asked when the request names no surface and no goal is obvious. "A poster for our seed swap" still goes straight to the poster flow.
- **Free plan users.** If Free accounts can't install plugins (unverified, see the report's Cost section), the extension option is the only one that gives tools. The welcome lists it regardless; the Desktop guide should say which plan each step needs once that is checked.

## Open Questions

- Does Desktop Chat let the agent detect that no folder is connected when the plugin's server isn't running? Today the skill relies on "no Open Design tools in the chat", which is good enough for the welcome.
- Should VS Code's New design grid show goals above surfaces? Left as a follow-up.
