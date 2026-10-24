## ADDED Requirements

### Requirement: Component Library Instructions Tool
The server SHALL provide `prepare_open_design_component_library` on every host that provides `port_open_design_artifact_to_app`. It SHALL take `entryPaths` (1 to 10 registered artifacts) or a `collectionId`, a `library` of `mui`, `shadcn` or `auto`, and an optional `outputDir`. It SHALL return staged instructions for building a reusable component set in the workspace's app, and SHALL NOT write any app source file. It SHALL return `not-registered` for an entry path without a manifest, `unsupported-library` for any other library value, and `no-app` when no `package.json` is found from the output folder up to the workspace root.

#### Scenario: Instructions only
- **WHEN** the tool is called with a registered artifact and `library: "mui"`
- **THEN** it SHALL return instructions and SHALL NOT create or change any file outside the artifact manifests

#### Scenario: Collection input
- **WHEN** the tool is called with a `collectionId` of three screens
- **THEN** the instructions SHALL cover all three screens' artifacts

#### Scenario: Library not supported yet
- **WHEN** the tool is called with `library: "vuetify"`
- **THEN** it SHALL return `unsupported-library` naming `mui` and `shadcn` as the supported values

### Requirement: Library and Framework Detection
With `library: "auto"`, the tool SHALL choose `mui` when the nearest `package.json` depends on `@mui/material`, and `shadcn` when a `components.json` exists or the app depends on a `@radix-ui/` package and `tailwindcss`. When neither or both match, it SHALL return `needs-choice` listing both libraries. When the app does not depend on `react`, it SHALL return `unsupported-framework` naming the framework dependencies it found. When a named library is not installed, the instructions SHALL begin with the install command for the package manager indicated by the workspace's lock file and SHALL tell the agent to ask the user before running it.

#### Scenario: MUI app
- **WHEN** `package.json` depends on `react` and `@mui/material`, and `library` is `auto`
- **THEN** the tool SHALL choose `mui`

#### Scenario: Vue app
- **WHEN** `package.json` depends on `vue` and not `react`
- **THEN** the tool SHALL return `unsupported-framework` naming `vue`

#### Scenario: Library missing
- **WHEN** `library` is `shadcn` and the app has no `components.json`
- **THEN** the instructions SHALL start with the shadcn init command for the app's package manager and SHALL say to ask the user before running it

### Requirement: Repeated Element Inventory Seed
The tool SHALL scan each artifact's HTML and return up to 40 component candidates: element groups with the same tag and class set appearing two or more times, and every `button`, `a[role=button]`, `input`, `select`, `textarea`, `nav`, `header`, `footer` and top-level `section`. Each candidate SHALL have a count, one sample selector and the artifacts it appears in. Candidates appearing in two or more artifacts SHALL rank first. The same artifacts SHALL always produce the same candidates in the same order.

#### Scenario: Repeated card
- **WHEN** an artifact has four `div.plan-card` elements
- **THEN** the candidates SHALL include that group with count 4 and a sample selector

#### Scenario: Shared across screens
- **WHEN** a `nav.top-bar` appears on two screens of a collection and a `div.hero` on one
- **THEN** `nav.top-bar` SHALL rank above `div.hero`

### Requirement: Approval Before Code
The instructions SHALL tell the agent to write a `components.md` beside the first artifact listing each component with its variants and states, and to stop for the user's approval before writing any app code. For every interactive component the listed states SHALL include default, hover, focus-visible, active and disabled, plus loading for buttons, error for inputs and empty for lists and tables. The instructions SHALL state that loading is not shown as disabled and that destructive actions use the danger colour.

#### Scenario: Stop after the inventory
- **WHEN** the agent follows the instructions
- **THEN** the first stage SHALL end with `components.md` written and a question to the user, and no component files SHALL be written before the user agrees

### Requirement: Theme From Design System Tokens
The tool SHALL map the artifact's design system tokens, resolved with overlay overrides and `color-mix()`, to the target library's theme by a fixed table, and include the result in the instructions: a `createTheme` options object for `mui`, and CSS variables (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--radius`) for `shadcn`. Tokens without a slot SHALL be listed as `unmapped` with a suggested place. When the artifact has no design system and its `:root` does not use the token contract names, the tool SHALL say it has no theme source and point at `extract_open_design_design_system`. The same tokens and library SHALL always produce the same theme.

#### Scenario: Accent becomes primary
- **WHEN** the design system's `--accent` is `#2f6fed` and `library` is `mui`
- **THEN** the theme SHALL have `palette.primary.main` `#2f6fed`

#### Scenario: Unmapped token reported
- **WHEN** the design system defines `--motion-base` and `library` is `shadcn`
- **THEN** the result SHALL list `--motion-base` under `unmapped` with a suggestion

#### Scenario: Deterministic theme
- **WHEN** the tool is called twice with the same design system and library
- **THEN** both themes SHALL be identical

### Requirement: Components Wrap the Library
The instructions SHALL tell the agent to build each component on the library's own component where one exists (MUI components for `mui`; the generated `components/ui` files and `cva` variants for `shadcn`), to express the inventory's variants as props, to take content through props, and to read every colour, radius, font and spacing value from the theme. The instructions SHALL forbid hex, rgb and pixel literals for these properties inside component files.

#### Scenario: No hard-coded colour
- **WHEN** the agent follows the instructions for a primary button
- **THEN** the instructions SHALL direct it to use the library button with the theme's primary colour, not a literal colour value

### Requirement: Component Gallery
The instructions SHALL tell the agent to write one Storybook story file per component, with a story per variant and state, when the workspace has a `.storybook` folder or a `@storybook/` dependency; otherwise one `ComponentGallery` component in the output folder showing every component in every listed state. The gallery SHALL NOT be wired into routes or navigation.

#### Scenario: Storybook present
- **WHEN** the workspace has a `.storybook` folder
- **THEN** the instructions SHALL ask for story files and SHALL NOT ask for a `ComponentGallery` component

### Requirement: Component Library Record
After the agent runs the app's type check or build, the instructions SHALL tell it to call the tool again with `record` (`library`, `outputDir`, `themePath`, and `components` each with `name`, `path` and `sourceSelectors`). The tool SHALL validate the record, write it as `metadata.componentLibrary` on each source artifact's manifest (at most 4 KB), and return what it wrote. When a later call finds a record for the same library, the instructions SHALL switch to update mode: read the existing files, change only what the new inventory changes, and list components no longer found for the user instead of deleting them. A record for a different library SHALL be reported and left unchanged.

#### Scenario: Record written
- **WHEN** the tool is called with a valid `record` for a registered artifact
- **THEN** that artifact's manifest SHALL have `metadata.componentLibrary` with the given library and components

#### Scenario: Second run updates
- **WHEN** the tool is called for an artifact whose manifest records an `mui` set and `library` is `mui`
- **THEN** the instructions SHALL name the existing files and tell the agent to update them rather than create a new set

#### Scenario: Removed component is not deleted
- **WHEN** a recorded component has no matching candidate in the new inventory
- **THEN** the instructions SHALL list it for the user and SHALL NOT tell the agent to delete its file

### Requirement: Routing to the Tool
The overview skill SHALL route requests to make components, a component library or a component set from a design, or naming MUI, Material 3 or shadcn for an existing design, to `prepare_open_design_component_library`, and SHALL keep "put this page in my app" requests on `port_open_design_artifact_to_app`. In VS Code, the preview's Promote to code button SHALL offer a choice between one component and a component set.

#### Scenario: Material 3 request
- **WHEN** the user says "make Material 3 components for my React app from this design"
- **THEN** the agent SHALL call `prepare_open_design_component_library` with `library` `mui` or `auto`
