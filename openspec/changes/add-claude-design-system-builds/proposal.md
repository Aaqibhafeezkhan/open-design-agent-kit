## Why

Claude Design keeps design systems as "Design System" artifacts. Its "Add design system" flow offers three starting points: a GitHub repository, a connector, or uploaded files. None of them reads our design systems well today:

- **GitHub repo.** The importer reads CSS custom properties under `:root` and theme selectors, and brand docs. That matches our `tokens.css` and `DESIGN.md`. But it reads the raw vendored files:
  - 42 bundled systems keep their brand-correct values in a separate `tokens.override.css`, and 55 have a `DESIGN.sections.md` overlay (see `reconcile-design-system-sources`), so the importer gets the old conflicting brand.
  - About 480 `color-mix()` values (hover, active and tint shades) are skipped, because Claude's format rejects them.
  - One import makes one system, so 198 systems would take 198 runs.
- **Connector.** This route is for design-tool connectors (Figma- or Canva-style structure, variables and code calls). Our MCP server is not one.
- **Upload.** This works for one system at a time. It works best with what `scripts/claude-design-system.ts export` writes, because that already merges the overlays.

The importer's own guide says a `tokens.json` already in Claude's format is copied as is. So if we ship each system already in Claude's format, every route that reads files gets it exactly. Today's one-off export (PR #16) is close to that format but not strictly in it:
- The README opens with a `#` title, which the type's rules forbid because the page carries the name.
- `color-mix()` values are dropped rather than resolved.
- The cover uses one generic pattern for every system.
- Nothing checks the output against the format.

## What Changes

- **A strict builder.** `toClaudeDesignSystem()` in core is tightened to the Design System type's published format (contract 0.2.47):
  - **The index:** `design-system.json` with `v: 3`, `layout: "files"`, `createdOnFiles` and `lastChange`, with deterministic dates for bundled systems.
  - **`tokens.json` in list shape:**
    - Names match `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$` and are unique across families.
    - Colour aliases point only at tokens that exist.
    - `color-mix()` is resolved to a literal colour in its own colour space (oklab or oklch), and a mix with `transparent` becomes `rgba()`.
  - **`README.md`:** no title and no provenance, and at most one "Not synced" note.
  - **The cover:** a `components/Cover/preview.html` that follows the type's cover rules, with its pattern picked from the system's radii and type rather than one pattern for all.
- **A validator.** `validateClaudeDesignSystem()` checks a built folder against the same rules:
  - **Index:** its keys and marker.
  - **Tokens:** the name and value grammar, unique names, aliases that resolve, and the per-family caps.
  - **README:** no title.
  - **Cover:** line 1 holds the marker.
  - **Sizes:** within the caps.
  - **Contrast:** each text colour reads at least 4.5:1 on the grounds its usage note names, in every theme.

  Contrast pairs that fail are reported but don't fail the build. The craft rule says a real brand's failing pair stays exact and is flagged in its note.
- **A build step for every bundled system.** A new `scripts/build-claude-design-systems.ts` builds `claude-design-systems/<id>/project/` for all 198 bundled systems, through the content index so the overlays apply. It also writes `claude-design-systems/README.md`, an index with each system's name, summary and the sub-path to give the GitHub importer. `npm run sync-content` runs it, so the folder updates whenever content does.
- **A drift check.** `check-content-sync.mjs` (or a root check run by `npm run lint`) fails when:
  - a built folder is stale or missing;
  - a folder exists for a system that no longer exists;
  - the validator reports an error.
- **One builder for everything.** `scripts/claude-design-system.ts export`, and the "Copy to Claude Design" step in the `design-system-from-url` skill, use the same strict builder, so custom `user:` systems leave in the same shape.
- **Docs.** `docs/guides/design-systems.md` gains a "Use one in Claude Design" section covering all three routes:
  - **GitHub:** give `feimacode/open-design-agent-kit` and the system's `claude-design-systems/<id>` path.
  - **Upload:** drop that folder's files.
  - **Bulk from Claude Code:** an agent publishes several systems with its Artifact tool.

  It also says why the connector route doesn't apply.

Not in this change:
- Publishing systems to anyone's Claude account automatically. There is no public API, so publishing stays an agent action under the user's own account.
- Importing from Claude back into Open Design. `import` stays as it is.
- Motion tokens, which Claude's format has no family for.
- Components and font files. Our systems carry neither.

## Capabilities

### New Capabilities
- `claude-design-systems`: the strict builder, the validator, the built `claude-design-systems/` tree with its index, its drift check, and the guide section.

### Modified Capabilities
- None. The export script's behaviour changes, but it has no spec yet.

## Impact

- `packages/core/src/generation/claudeDesignSystem.ts`: strict index, README and cover; `color-mix()` resolution; new `validateClaudeDesignSystem()`
- New `packages/core/src/generation/colorMix.ts`, or a helper beside the existing colour code: an oklab and oklch mix to sRGB hex, with tests
- `scripts/build-claude-design-systems.ts` (new), `scripts/claude-design-system.ts` (uses the strict builder), root `package.json` `sync-content`
- New `claude-design-systems/` at the repo root: about 198 × 4 files, roughly 3 MB, generated and never hand-edited. It isn't part of any npm package.
- `packages/content/scripts/check-content-sync.mjs` or `scripts/check-docs.mjs`: the drift check
- `packages/content/local/prompts/design-system-from-url.md`: the Claude Design step points at the strict export
- `docs/guides/design-systems.md`: the new section
- No runtime dependencies
