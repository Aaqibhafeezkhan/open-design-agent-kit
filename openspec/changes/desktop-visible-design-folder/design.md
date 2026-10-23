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

## Decisions

**1. Layout is chosen per workspace, at the moment the workspace is set.** The two Desktop routes (`set_open_design_workspace`, `use_open_design_managed_workspace`) are the only ones a non-technical user reaches, and both run in `main()` where the context is rebuilt. Rule, in order:
1. `OPEN_DESIGN_OUTPUT_DIR` set → classic layout with that directory (explicit wins).
2. `<workspace>/.open-design/` holds any `*.artifact.json` → classic layout (existing designs stay put).
3. Workspace set by one of the two Desktop tools → visible layout.
4. Otherwise → classic layout.

Alternative considered: a user setting. Rejected for now: the people who need this are the ones least likely to find a setting. The env var remains the escape hatch.

**2. One designs folder, carried with the layout.** The context's `outputDir` is the designs folder: `Open Design` in a connected folder, `.` in the managed folder, `.open-design` in the classic layout. Entries, sidecars, exports, saved design systems, jobs and the hidden `.checks/` all follow it, as they already do, so readers need no second directory. The active design system stays in `<workspace>/.open-design/config.json`, where the store has always written it. As built, this replaced an earlier plan to split a separate state folder out: it touched every reader for little gain, since saved design systems and jobs are things the user may want to see.

**3. Managed workspace becomes `~/Documents/Open Design/` with a subfolder per design.** (Confirmed by Iven, 23 Oct 2026, together with the Documents location.) The workspace root is the managed root and `designsDir` is `.` there, so a design lands at `~/Documents/Open Design/seed-swap-flyer/seed-swap-flyer.html` and state at `~/Documents/Open Design/.open-design/`. Alternative: keep one workspace per design and put the entry at its root. Rejected: it needs a special entry-path rule and breaks "one folder per design" as soon as a second design is made in the same chat. Existing per-design managed folders are detected by rule 1.2 and reopened in the classic layout, including ones under the old default root `~/Open Design/`.

**3a. Default managed root is `~/Documents/Open Design`.** The home folder isn't in the Finder or File Explorer sidebar; Documents is, on macOS, Windows and most Linux desktops. Order: `OPEN_DESIGN_MANAGED_ROOT`, then the extension's default design folder (`OPEN_DESIGN_DEFAULT_WORKSPACE`) when it names an existing folder, then `~/Documents/Open Design` when `~/Documents` exists, else `~/Open Design`. When asked for a design name that exists only under the old `~/Open Design/` root, that folder is reopened where it is.

**4. Image, PDF and PowerPoint exports in the design's folder, named by size.** Each format gets a `fileLabel` (`A4`, `A3`, `letter`, `instagram-portrait`, `story`, `x-post`, `linkedin`, `youtube-thumbnail`…). Names are `<design>-<fileLabel>.<ext>`; an export with no size is `<design>.<ext>`; data-bound exports keep the row-name suffix; multi-image exports keep the `-NN` index; the shape sheet is `<design>-all-sizes.png`. These are the files a non-technical user sends to a printer or posts. Outputs that are themselves web pages or folders (standalone HTML, which would collide with the design's own `<design>.html`, the site bundle, email and paste HTML, Figma payloads, the exploration contact sheet, the campaign sheet) and video exports stay in `exports/`, as do check screenshots in the hidden `.checks/`. The Canva upload and the publish `includeFiles` check accept an export beside the design as well as one in `exports/`.

Alternative: keep an `exports/` subfolder but visible. Simpler, but the user asked for files next to the design, and an extra folder is one more thing to open.

## Risks / Trade-offs

- **Two layouts to test.** Mitigation: one table-driven test over both layouts for every path helper, and the classic layout stays the default.
- **Name collisions.** A design named `seed-swap-flyer` exported as A4 writes `seed-swap-flyer-A4.pdf`, which could clash with a supporting file of that name. Exports refuse to overwrite a file that isn't recorded as a previous export in the manifest, and add `-2`.
- **Sidecars are still visible clutter.** Two extra `.json` files per design. Accepted for now; a follow-up could move them to `stateDir`.
- **`write_open_design_file` scope.** Its allowed area becomes `designsDir`; its refusal list (sidecars, config, exports) is unchanged.

## Open Questions

- Should `fileLabel` follow the user's language (for example `A4` stays, but `instagram-portrait` translated)? Proposed: no, keep ASCII for safe file names.
