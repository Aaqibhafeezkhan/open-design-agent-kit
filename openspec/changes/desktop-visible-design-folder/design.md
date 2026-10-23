## Context

Today one value, `outputDir` (default `.open-design`, overridable with `OPEN_DESIGN_OUTPUT_DIR`), decides where everything goes:

```
<workspace>/.open-design/
  config.json                      active design system
  design-systems/<id>/             saved design systems
  jobs/<id>.job.md                 recurring jobs
  .checks/<run>/                   check screenshots
  <design>/<design>.html           the design
  <design>/<design>.html.artifact.json, .comments.json
  <design>/exports/<design>-a4.pdf
```

In a managed workspace the whole tree sits inside `~/Open Design/<name>/`, so the design is two folders and a hidden one away from where the user was told to look.

## Goals / Non-Goals

**Goals**
- In Claude Desktop, the user opens the folder Claude named and sees their design and its exports by name.
- Nothing changes for Claude Code, Codex, VS Code or the CLI in an existing project.
- A folder that already has kit designs keeps working without a migration.

**Non-Goals**
- Making sidecars invisible. They stay next to the entry; hiding them means changing every reader.
- Picking a different managed root on macOS (for example `~/Documents/Open Design`). Noted as an open question.

## Decisions

**1. Layout is chosen per workspace, at the moment the workspace is set.** The two Desktop routes (`set_open_design_workspace`, `use_open_design_managed_workspace`) are the only ones a non-technical user reaches, and both run in `main()` where the context is rebuilt. Rule, in order:
1. `OPEN_DESIGN_OUTPUT_DIR` set → classic layout with that directory (explicit wins).
2. `<workspace>/.open-design/` holds any `*.artifact.json` → classic layout (existing designs stay put).
3. Workspace set by one of the two Desktop tools → visible layout.
4. Otherwise → classic layout.

Alternative considered: a user setting. Rejected for now: the people who need this are the ones least likely to find a setting. The env var remains the escape hatch.

**2. Split designs from state.** `designsDir` is `Open Design` (visible) or `.open-design` (classic); `stateDir` is always `.open-design`. Config, saved design systems, jobs and check history read `stateDir`; entries, sidecars and exports read `designsDir`. In the classic layout the two are equal, so every current path is unchanged. Most core functions already take an `outputDir` option for the designs side; check history and design-system storage are the ones that move to `stateDir`.

**3. Managed workspace becomes `~/Open Design/` with a subfolder per design.** The workspace root is the managed root and `designsDir` is `.` there, so a design lands at `~/Open Design/seed-swap-flyer/seed-swap-flyer.html` and state at `~/Open Design/.open-design/`. Alternative: keep one workspace per design and put the entry at its root. Rejected: it needs a special entry-path rule and breaks "one folder per design" as soon as a second design is made in the same chat. Existing per-design managed folders are detected by rule 1.2 and reopened in the classic layout.

**4. Exports in the design's folder, named by size.** Each format gets a `fileLabel` (`A4`, `A3`, `letter`, `instagram-post`, `instagram-portrait`, `story`, `x-image`, `linkedin`, `youtube-thumbnail`…). Names are `<design>-<fileLabel>.<ext>`; a format with no preset is `<design>.<ext>`; data-bound exports keep the row-name suffix; multi-image exports keep the `-NN` index. Check screenshots and shape sheets stay out of the design folder (`stateDir/.checks`), except the shape sheet, which the user asked for and is named `<design>-all-sizes.png`.

Alternative: keep an `exports/` subfolder but visible. Simpler, but the user asked for files next to the design, and an extra folder is one more thing to open.

## Risks / Trade-offs

- **Two layouts to test.** Mitigation: one table-driven test over both layouts for every path helper, and the classic layout stays the default.
- **Name collisions.** A design named `seed-swap-flyer` exported as A4 writes `seed-swap-flyer-A4.pdf`, which could clash with a supporting file of that name. Exports refuse to overwrite a file that isn't recorded as a previous export in the manifest, and add `-2`.
- **Sidecars are still visible clutter.** Two extra `.json` files per design. Accepted for now; a follow-up could move them to `stateDir`.
- **`write_open_design_file` scope.** Its allowed area becomes `designsDir`; its refusal list (sidecars, config, exports) is unchanged.

## Open Questions

- Should the managed root default to `~/Documents/Open Design` on macOS and Windows, where the home folder isn't in the sidebar?
- Should `fileLabel` follow the user's language (for example `A4` stays, but `instagram-post` translated)? Proposed: no, keep ASCII for safe file names.
