## Context

Today's round trip (`docs/guides/promote-to-app-code.md`): generate a design, review it in the preview (comments, Edit, Tweaks), then `port_open_design_artifact_to_app` composes instructions to rebuild that one page as one component in the user's app, following a reference component. It writes nothing; the agent writes the code.

The request this change answers came up while comparing the kit with other design-agent projects (XIAS `design-component` and its framework adapters, OpenPencil's multi-platform code export, OpenUI's MUI and shadcn adapters): after a user reviews a static page, they ask for "a set of Material 3 components for my React app". That is a different job from porting a page:

| | Port a page (today) | Build a component set (this change) |
|---|---|---|
| Input | one artifact | one or more artifacts, or a collection |
| Output | one component in the app's existing style | a theme file, N components, a gallery |
| Styling source | a reference component in the app | the design system, mapped to a library theme |
| Library | whatever the app uses | named: `mui` or `shadcn` (first round) |
| Re-run | starts over | updates the recorded set |

## Goals / Non-Goals

**Goals:** the same theme for the same design system and library every time; components that wrap the library instead of re-implementing it; no hard-coded colours or sizes in components; a user approval before code is written; a record that lets a second run update the set; works on every host that has the port tool today.

**Non-Goals:** the server writing app code; a kit-owned component library or npm package; Vue, Angular, Svelte, SwiftUI, Flutter or Compose targets in this change; pixel comparison between the gallery and the design (it needs the app's dev server, which the kit doesn't run; a later change can add it); wiring components into routes; keeping the set in live sync with the design.

## Decisions

### A new tool, not a mode on the port tool

Options: (1) add `mode: "component-set"` and `library` to `port_open_design_artifact_to_app`; (2) a new tool. A mode would make one tool return two different staged workflows with different arguments (`entryPaths` vs `entryPath`, `library` meaningless for a page port), and the port tool's description would need to explain both, which agents read badly. A new tool, `prepare_open_design_component_library`, keeps each description about one job. The name follows `prepare_open_design_brief` and `prepare_open_design_exploration`: it prepares instructions and doesn't build.

### Core maps tokens to the theme; the agent writes the components

The same split as design-system matching: what is data is done by a pure function, what is language and code is done by the agent.

- **Theme mapping is data.** The token contract is fixed and so are the libraries' theme shapes, so the mapping can be a table with unit tests. Letting the agent map tokens would give different palettes from different models and would quietly drop tokens. Core resolves the design system's tokens (including overlay overrides and `color-mix()` through the existing `colorMix.ts`) and emits a ready theme.
- **Components are code.** Which props a card needs and how this app imports things is the agent's job, guided by the inventory and the app's files.

### Token mapping (first round)

MUI (`createTheme` options; Material 3 roles are expressed on MUI's palette and noted in a comment, since MUI's palette is not M3-native):

| Token | MUI | M3 role it stands for |
|---|---|---|
| `--accent`, `--accent-on`, `--accent-hover` | `palette.primary.main`, `.contrastText`, `.dark` | primary, on-primary |
| `--bg`, `--surface` | `palette.background.default`, `.paper` | surface, surface-container |
| `--fg`, `--fg-2`, `--muted` | `palette.text.primary`, `.secondary`, `.disabled` | on-surface, on-surface-variant |
| `--border` | `palette.divider` | outline |
| `--danger`, `--warn`, `--success` | `palette.error`, `.warning`, `.success` `.main` | error |
| `--font-body`, `--font-display`, `--text-*`, `--leading-*` | `typography.fontFamily`, `h1`–`h6` family, sizes, line heights | type scale |
| `--radius-md` | `shape.borderRadius` (px) | shape medium |
| `--space-1` | `spacing` (px unit) | |

shadcn (CSS variables in the app's global stylesheet, returned both as hex and as the bare HSL triplets older `hsl(var(--x))` setups use). shadcn's `--muted`, `--secondary` and `--accent` are background tints and `--muted-foreground` is the quiet text colour, so the contract's `--muted` (a text colour) goes to `--muted-foreground`:

| Token | shadcn variable |
|---|---|
| `--bg`, `--fg` | `--background`, `--foreground` |
| `--surface` (else `--bg`) | `--card`, `--popover` (and their `-foreground` from `--fg`) |
| `--accent`, `--accent-on` | `--primary`, `--primary-foreground`; `--ring` |
| `--surface-warm` (else `--surface`) | `--secondary`, `--muted`, `--accent` (their `-foreground` from `--fg`) |
| `--muted` (else `--fg-2`) | `--muted-foreground` |
| `--border` | `--border`, `--input` |
| `--danger` | `--destructive` |
| `--radius-md` | `--radius` |

`--focus-ring` is a box-shadow in the contract, not a colour, so it is listed as unmapped (with a `focus-visible` suggestion) rather than put on `--ring`.

Tokens with no slot (`--elev-*`, `--motion-*`, `--focus-ring`, extra `--space-*` steps) are returned as `unmapped` with a suggestion (MUI `shadows` / `transitions`; Tailwind theme extension for shadcn), so the agent can place them or tell the user. A design without a design system is themed from the artifact's own `:root` custom properties when they use the contract names; otherwise the tool says it has no theme source and the agent extracts one with `extract_open_design_design_system` first or asks.

### Inventory: a deterministic seed, then the agent and the user

A component list from memory drifts toward a generic kit (Button, Card, Modal) whether the design has them or not. The tool scans the artifacts' HTML with cheerio, which core already depends on: elements with the same tag and class set two or more times, plus every `button`, `a[role=button]`, `input`, `select`, `textarea`, `nav`, `header`, `footer` and top-level `section`. It returns candidates with a count, one sample selector and the artifacts they appear in. The agent groups them into components, names variants and states, writes `components.md`, and stops for approval. Across a collection, a candidate seen on two or more screens ranks first. The scan is a hint; the agent may merge, split or drop.

States listed for every interactive component: default, hover, focus-visible, active, disabled, loading (for buttons), error (for inputs), empty (for lists and tables). Loading is not disabled, and a destructive action uses the danger colour; both rules are written into the instructions.

### Library detection

`library: "auto"` reads the nearest `package.json` from the target folder up: `@mui/material` gives `mui`; `components.json` or `@radix-ui/*` with `tailwindcss` gives `shadcn`; neither returns `needs-choice` with both options, so the agent asks once. A named library the workspace doesn't have is allowed (a new app); the instructions then start with the install command for the app's package manager (from its lock file) and the agent asks before running it. No React (`react` not in dependencies) returns `unsupported-framework` naming what was found.

### Gallery: Storybook when present, else one component

Storybook (`.storybook/` or `@storybook/*`) gets one `*.stories.tsx` per component with a story per variant and state. Otherwise, one `ComponentGallery.tsx` in the output folder renders every component in every state, unrouted, matching the port tool's rule. Registering the gallery as an artifact was considered and dropped: it needs the app's bundler to render, which the kit's preview doesn't run.

### The record, and re-runs

The second call, with `record: { library, outputDir, themePath, components: [{ name, path, sourceSelectors }] }`, writes `metadata.componentLibrary` on each source artifact's manifest (validated, at most 4 KB, inside the existing 16 KB metadata limit). When a later call finds a record for the same library, the instructions switch to update mode: read the existing files first, change only components whose source changed or that the new inventory adds, and list removed candidates for the user rather than deleting files. A record for a different library is reported; the new set goes in a new folder.

## Risks / Trade-offs

- **MUI is Material 2 at heart.** MUI themes to M3 colours, type and shape, but some M3 components (navigation rail, segmented button) have no MUI counterpart, and MUI's own Material 3 work is unfinished. Mitigation: the instructions say which M3 parts are approximated; a later change can add `material-web` (`@material/web`, the official M3 web components) for teams that want strict M3. Open question below.
- **shadcn copies source into the app.** Its components are generated files, not a package, so "wrap the library" means using the generated `components/ui/*` files and adding variants with `cva`, not editing them. The instructions say so.
- **Token contract gaps.** Custom design systems may not use the contract names. The mapping reports what it couldn't map rather than guessing.
- **Size of instructions.** Several artifacts' HTML plus a theme can be large. The tool includes each artifact's HTML once, trimmed of inline `<script>` bodies and data URIs, and caps the scan output at 40 candidates.

## Open Questions

- Should "Material 3" in a request mean MUI themed to M3 (this change) or Material Web components? Proposed: MUI by default because most React apps already use it; Material Web as the next target.
- Should the gallery also export a static HTML snapshot so the kit's preview and checks can see it? Not in this change.
