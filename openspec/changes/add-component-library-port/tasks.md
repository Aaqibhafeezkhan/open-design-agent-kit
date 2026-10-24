## 1. Core

- [x] 1.1 `packages/core/src/generation/libraryThemes.ts`: token-to-MUI and token-to-shadcn mapping as pure functions, `unmapped` list, using `colorMix.ts`; unit tests on three bundled systems (one light, one dark, one with overlay overrides)
- [x] 1.2 Library and framework detection (`auto`, `needs-choice`, `unsupported-framework`, package manager from the lock file) with fixture workspaces
- [x] 1.3 Repeated-element scan with cheerio: candidates, counts, sample selectors, cross-artifact ranking, cap of 40; deterministic-order test
- [x] 1.4 `composeComponentLibraryInstructions`: the five stages, approval stop, states and intent rules, gallery rule, install step, update mode from an existing record; HTML trimmed of script bodies and data URIs
- [x] 1.5 `metadata.componentLibrary` type, validation and 4 KB limit; write on `record`

## 2. Tools

- [x] 2.1 `prepare_open_design_component_library` in `packages/mcp-server` (every host), with `entryPaths` or `collectionId`, `library`, `outputDir`, `record`, and the error codes
- [x] 2.2 Same tool as a VS Code `languageModelTool`
- [x] 2.3 VS Code preview: Promote to code asks "one component or a component set" and prefills the matching request

## 3. Skills and docs

- [x] 3.1 Overview skill routing (component set vs page port); regenerate CLI, Codex and `.agents` copies; drift checks
- [x] 3.2 `docs/guides/component-library.md`; `docs/reference/tools.md`; `docs/reference/artifact-manifest.md` (`metadata.componentLibrary`); link from `docs/guides/promote-to-app-code.md`

## 4. Verification

- [x] 4.1 Server tool tests: writes nothing but the manifest record; errors for unregistered, unsupported library, no app, Vue app
- [ ] 4.2 End to end in Claude Code on a fresh Vite + MUI app and a Next.js + shadcn app, from a bundled pricing-page example: inventory approved, theme applied, components build, gallery renders; note what the agent got wrong
- [ ] 4.3 Re-run on the same artifact after an edit: existing files updated, nothing duplicated or deleted
