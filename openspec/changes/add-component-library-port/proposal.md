## Why

When a design is right, a developer's next ask is often not "put this page in my app" but "give me the components for it": a Material 3 button, card, nav bar and text field set for a React app, or the same set on shadcn/ui. Today the kit has no good answer:

- **`port_open_design_artifact_to_app` makes one component from one page.** It follows an existing component in the app and copies the look into it (`packages/core/src/generation/portToAppInstructions.ts`). It never names the repeated parts of a design, never targets a component library, and never builds a theme, so a second page ported later reinvents the same button.
- **The look ends up hard-coded.** With no theme step, each ported component carries its own colours, radii and fonts. Changing the brand later means editing every file, which is the opposite of what the kit's design systems are for.
- **Library knowledge is left to chance.** Models know MUI and shadcn well, but nothing tells them to wrap the library's own `Button` rather than write a new one, to express variants as the library's props, or to show every state. Results vary by model and by day.
- **There is no record.** Nothing remembers which components were made from which design, so a second run on an updated design can't update the set; it starts over.

The kit already has what the hard part needs: every bundled design system ships the same normalized token contract (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-on`, `--success`, `--warn`, `--danger`, `--font-display`, `--font-body`, `--text-*`, `--space-*`, `--radius-*`, `--elev-*`, `--motion-*`), and designs are registered artifacts with manifests and collections.

## What Changes

- **A new tool, `prepare_open_design_component_library`.** Given one or more reviewed artifacts (or a collection) and a target `library`, it composes instructions for building a reusable component set in the workspace's app. Like the port tool, it **writes no app code**; the agent writes files with its own tools.
- **Targets, first round:** `mui` (Material UI for React, themed to Material 3 colour roles, type scale and shape) and `shadcn` (shadcn/ui on Radix and Tailwind). `auto` picks from the workspace's `package.json`. Other libraries (Vuetify, Angular Material, Material Web) are a later change; the tool returns a clear `unsupported-library` error for them now.
- **Stage 1, inventory, with an approval stop.** The agent lists the components the designs need, each with its variants and states, in a `components.md` next to the first artifact, and waits for the user's yes before writing code. The tool seeds the list with a deterministic scan of repeated elements in the artifacts (same tag and class set two or more times, plus buttons, inputs, links and headings), so the list starts from the design, not from memory.
- **Stage 2, theme from the design system.** Core maps the artifact's design system tokens to the library's theme deterministically and returns it in the instructions: a `createTheme` options object for MUI (palette roles, typography, `shape.borderRadius`, spacing) and the shadcn CSS variables (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--border`, `--ring`, `--radius`, `--destructive`, …). Tokens a library has no slot for are listed, not dropped silently.
- **Stage 3, components that wrap the library.** Each component wraps the library's own component, expresses the inventory's variants as props, takes content through props, and reads every colour, size and radius from the theme. No hard-coded hex values.
- **Stage 4, a gallery.** Storybook stories when the workspace has Storybook; otherwise one `ComponentGallery` component showing every component in every listed state. Like the port tool, it is not wired into routes.
- **Stage 5, verify and record.** The agent runs the app's own type check or build, then records the set by calling the same tool again with a `record` argument (the same two-call pattern `publish_open_design_artifact` uses for its `published` record). That writes `metadata.componentLibrary` on each source artifact's manifest: library, output folder, theme file and components. A later run on the same artifact reads this record and updates the set instead of duplicating it.
- **Entry points.** The overview skill routes "make components / a component library / Material 3 / MUI / shadcn from this design" to the new tool. In VS Code, the preview's **Promote to code** button asks "one component or a component set". The existing port tool is unchanged and stays the right choice for "put this page in my app".

## Capabilities

### New Capabilities
- `component-library-port`: the tool, library targets and detection, the repeated-element scan, the token-to-theme mapping, the staged instructions with the approval stop, the gallery rule, and the manifest record.

### Modified Capabilities
None. The manifest gains `metadata.componentLibrary`, specified in the new capability; `register_open_design_artifact` is unchanged.

## Impact

- Core: new `packages/core/src/generation/componentLibrary.ts` (library detection, repeated-element scan, instruction composition) and `packages/core/src/generation/libraryThemes.ts` (token-to-MUI and token-to-shadcn mapping, reusing `colorMix.ts` for derived shades); manifest type gains `metadata.componentLibrary`.
- Tools: `packages/mcp-server/src/index.ts` / `tools.ts` (new tool on every host), `packages/vscode/package.json` and its tool adapter, the preview's Promote button.
- Skills: `packages/claude-plugin/skills/open-design/SKILL.md` routing; generated CLI, Codex and `.agents` copies through the existing generators and drift checks.
- Docs: new `docs/guides/component-library.md`; `docs/reference/tools.md`; `docs/reference/artifact-manifest.md` (`metadata.componentLibrary`); a link from `docs/guides/promote-to-app-code.md`.
- Audience: developers in Claude Code, Copilot Chat and Codex. Desktop users without an app in the workspace get the tool's `no-app` error with a plain explanation.
