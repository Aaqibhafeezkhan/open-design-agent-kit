## 1. Layout and context

- [ ] 1.1 `env.ts`: layout detection (env override, existing `.open-design` designs, Desktop workspace tool, default) returning `designsDir` and `stateDir`; unit tests for each rule
- [ ] 1.2 `index.ts` `main()`: build the context with both directories when either workspace tool runs; `store.ts`, `tools.ts` read config, design systems and jobs from `stateDir`
- [ ] 1.3 `use_open_design_managed_workspace`: workspace is the managed root with `designsDir: "."`; a per-design managed folder with existing `.open-design` designs reopens in the classic layout; tests for new and legacy folders
- [ ] 1.4 `write_open_design_file`: allowed area is `designsDir`; refusal list unchanged; tests
- [ ] 1.5 Workspace tool results give the absolute design folder path in the visible layout

## 2. Core paths

- [ ] 2.1 `formats.ts`: `fileLabel` for every format; test that labels are unique and file-name safe
- [ ] 2.2 `exportArtifact.ts`: export path helpers take the layout; visible layout writes `<design>-<fileLabel>.<ext>` in the design's folder; no-overwrite rule for unrecorded files; table-driven tests over both layouts
- [ ] 2.3 `campaignSheet.ts`, `packageArtifact.ts`, `inlineExport.ts`, `siteBundle.ts`: same export directory rule
- [ ] 2.4 `checkHistory.ts`, `checkArtifact.ts`: history in `stateDir`; stale-source lookup in `designsDir`
- [ ] 2.5 `publishArtifact.ts`, `previewServer.ts`, `figmaPull.ts`: designs from `designsDir`

## 3. CLI and docs

- [ ] 3.1 `exportCommand.ts`, `previewCommand.ts`: detect `Open Design/` as well as `.open-design/`
- [ ] 3.2 `docs/getting-started/claude-desktop.md`: new paths for both Chat sections
- [ ] 3.3 `docs/reference/settings-and-env.md`: both layouts, the detection rule, `OPEN_DESIGN_OUTPUT_DIR`
- [ ] 3.4 Overview skill: in Desktop, give the user the design folder and export names, not `.open-design/...` paths; regenerate copies

## 4. Verification

- [ ] 4.1 Desktop Chat with a new folder: poster lands in `Open Design/<name>/`, A4 PDF export is `<name>-A4.pdf` next to it, visible in Finder or Explorer without showing hidden files
- [ ] 4.2 Desktop Chat with a folder that already has `.open-design/` designs: everything stays in `.open-design/`
- [ ] 4.3 Desktop Chat with no folder (extension): design in `~/Open Design/<name>/`; a later chat continues it
- [ ] 4.4 Claude Code in an existing project: paths unchanged
