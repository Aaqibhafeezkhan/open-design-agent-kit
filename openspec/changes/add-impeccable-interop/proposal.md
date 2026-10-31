## Why

Impeccable (pbakaus/impeccable, Apache-2.0, about 97k stars) gives coding agents a design vocabulary: `/impeccable` with commands such as `critique`, `audit`, `polish`, `bolder` and `harden`, plus a slop detector that runs without a model. It installs on about 19 agents. GitHub announced it as a built-in skill of the GitHub Copilot desktop app in June 2026. It overlaps with our checks and design critic. It doesn't ship design systems, artifact recipes (decks, posters, social sizes, print) or export.

Many of the developers we target already have it. Competing on critique won't win them over. Working well beside it will, and it costs little. Both tools use a `DESIGN.md` for the visual system, and Impeccable keeps product context in `PRODUCT.md`. Research: `/mnt/project-files/chatgpt-research/chatgpt-support.md`, section 3.

## What Changes

- **Read Impeccable's context.** When the workspace root has a `PRODUCT.md`, `prepare_open_design_brief` adds a short "Product context" section from it (users, purpose, accessibility), capped in length. When the root has a `DESIGN.md` and no design system is active, the brief says so, and the skill offers to turn it into the active design system through the existing user design-system flow (`create_open_design_design_system`), which reconciles its values with tokens. Root files are read, never changed.
- **Write a `DESIGN.md` Impeccable can read, only when asked.** `set_active_design_system` gets an option, `writeProjectDesignMd`. It writes the active system's reconciled `DESIGN.md` to the workspace root only when no `DESIGN.md` is there. It never overwrites one, and returns "kept your existing DESIGN.md" instead. The skill offers this once, in code projects (when `port_open_design_artifact_to_app` is used or a `package.json` is present).
- **Hand off to Impeccable when it's there.** When the agent's own skill list includes `impeccable`, the overview skill tells the agent, after a design is ported to app code, to suggest one next step: `/impeccable polish` or `/impeccable audit` on the ported component. Our own checks still run on the artifact itself. When Impeccable isn't there, nothing changes.
- **Docs.** A short `docs/guides/impeccable.md` ("Works with Impeccable") explains which files each tool reads and writes, and the order to use them in: Open Design for the artifact and design system, then Impeccable for polishing the app code.

Not in this change: running Impeccable's detector from our checks, bundling or installing Impeccable, or any change to Impeccable itself.

## Capabilities

### New Capabilities
- `impeccable-interop`: reading `PRODUCT.md` and root `DESIGN.md`, writing a root `DESIGN.md` on request, and the skill handoff.

### Modified Capabilities
None.

## Impact

- `packages/core`: brief composition (product context, root `DESIGN.md` notice), the root `DESIGN.md` writer.
- `packages/mcp-server`: the `writeProjectDesignMd` option on `set_active_design_system`, unit tests.
- Skills: the overview skill's handoff and offer lines; regenerated copies.
- Docs: new guide, link from the design-systems guide.
