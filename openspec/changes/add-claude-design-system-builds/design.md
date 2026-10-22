## Context

A Claude Design System artifact is a file tree under `project/`:
- `design-system.json`, the index
- `tokens.json`
- `README.md`
- `components/Cover/preview.html`
- optionally components, fonts and assets

The page generates `tokens.css`, `manifest.json` and `api/` cards itself when someone saves, and these must never be written. The type publishes its rules in `SKILL.md` and in the `artifact-type/reference/` files `format.md`, `craft.md`, `cover.md` and `from-code.md`, at contract 0.2.47. They're readable from any system made from the type, such as `https://claude.ai/artifact/4bAihXJB3fp6djqYe2RRkP`.

`toClaudeDesignSystem()` (PR #16) already writes this tree from a `DESIGN.md` and `tokens.css`, and the export script reads bundled systems through the content index (PR #21). This change makes that output strict, checks it, and builds it for every bundled system.

## Decisions

### Where the built systems live

| Option | Why not (or why) |
|---|---|
| Built on demand by the export script only | Fine for upload, but the GitHub route then has nothing in Claude's format to copy, so it falls back to reading raw `tokens.css` without the overlays. |
| Inside `packages/content/assets/` | It ships in the npm packages, and nothing at runtime reads it. That adds about 3 MB to every install. |
| A release asset (zip) | Upload only. The GitHub importer can't read it, and nothing is browsable. |
| **A generated `claude-design-systems/` at the repo root (chosen)** | The GitHub importer is pointed at `claude-design-systems/<id>`, the upload route drops the same folder, and the root `README.md` doubles as a browsable catalogue. It isn't in any package's `files`. |

Each `claude-design-systems/<id>/` holds `project/…` exactly as the artifact stores it. A person or agent can publish it with `root` set to that folder and no renaming.

### Deterministic output

A bundled build must not change unless the content changes, or the drift check would always fail. So:
- `createdOnFiles.at` and `lastChange.at` are the vendored content's `syncedAt`, read from `MANIFEST.json`, not the current time. That value moves on every `sync-content` run, so the drift check ignores these two fields when it compares.
- `lastChange.by` is "Open Design" and `via` is `"Open Design · <id>@<sourceRef>"`, for example `open-design-v0.24.1`. It doesn't start with "CI", because nothing republishes automatically, and the page shows a "may be overwritten" banner for that prefix.
- `tokens.json` `meta` is `{ "source": "github", "repo": "feimacode/open-design-agent-kit", "package": "claude-design-systems/<id>", "synced": "<sync date>" }`. That's the provenance shape the GitHub importer's re-sync reads.
- The export script, for a `user:` system, uses the current time as today.

### `color-mix()` is resolved, not dropped

Bundled tokens use `color-mix(in oklab, <colour>, <colour|black|white|transparent> N%)` for hover, active and tint shades: about 480 values across 198 systems, plus one `in oklch`. Claude's format accepts only literal colours or aliases. The builder:
1. resolves each argument, following `var()` through the same theme's tokens;
2. converts both to the named space;
3. mixes per CSS Color 5, with the percentages normalised and alpha premultiplied;
4. converts back to sRGB, gamut-clipped.

The result is written as `#rrggbb`, or as `rgba()` when alpha is below 1. Unit tests pin the result against browser-computed values for a handful of real tokens, within 1/255 per channel.

### The README follows the brand-book rules

The README is "usage rules for a consuming agent". The builder therefore:
- drops the `DESIGN.md` `#` heading, because the page shows the index `title`;
- drops upstream provenance lines such as `> Category:` and source notes;
- keeps the prose sections;
- adds one "Not synced" note at the end, listing motion tokens and anything else skipped, which the from-code guide allows.

The name is the bundled manifest's `name`, so `lingo` stays "Lingo" and reference systems keep their "-inspired" suffix.

### The cover follows `cover.md`

The current cover always uses one tall slab, satellites and a dot grid. The builder picks the pattern row from the tokens:
- `--radius-lg` of 16px or more means discs and pills;
- a mono `--font-body` means a dot or plus grid;
- a serif `--font-display` means a few hairline rules;
- otherwise, tiles cut by the radius tokens.

It also writes the four-line derivation comment, sizes the name by the 440px zone rule, and falls back to the top-band layout when the name doesn't fit at 64px. Every fill and `rx` is a token class. The validator only checks the marker line and that no `<img>` is used. Visual quality is reviewed on a sample (see Tasks).

### Validation is a separate function

`validateClaudeDesignSystem(files)` takes the same file map the builder returns and reports `errors` and `warnings`, so it can check any tree, including one read back from Claude.

- **Errors:**
  - a missing or misshapen index;
  - a token name outside the grammar, or used twice;
  - a value the page would drop (`var()`, `color-mix()`, a named colour, a dangling alias);
  - a README `#` title;
  - a missing cover marker;
  - a file over its cap;
  - a generated path (`tokens.css`, `manifest.json`, `api/`) written.
- **Warnings:** a text colour below 4.5:1 on a ground its usage note names, in any theme.

It's kept as a warning because the type's craft rules say a real brand's failing pair stays exact and is flagged in its note. The builder adds that flag to the usage note itself, for example "below 4.5:1 on `surface`".

### The drift check

The build script has a `--check` mode. It builds every bundled system in memory and compares the result with `claude-design-systems/`. It fails, listing the ids, when a folder is stale, missing or orphaned, or when any build has validator errors. Root `npm run lint` runs it next to `check-docs.mjs`. The content package's own check can't run it, because the content package has no dependency on core.

### Bulk publishing stays an agent task

Publishing needs the Artifact tool under the user's account. There's no API, so a script can't do it. The guide gives the prompt to use instead ("Publish these Open Design design systems to Claude Design: lingo, kami, …"). For each system, the agent creates an artifact from the Design System type and publishes `claude-design-systems/<id>` with `root`. No new skill is added: the steps are short, and the type's own `SKILL.md` governs the publish.

## Risks / Trade-offs

- **The format moves.** The type is at contract 0.2.47 and 0.2.89 is out. Mitigation: the validator's rules live in one module, with a comment naming the contract they were written against. A task re-reads the type's `format.md` on each release and updates them.
- **About 3 MB of generated files in the repo.** Diffs are noisy on content syncs. Mitigation: the folder is marked `linguist-generated` in `.gitattributes`, so reviews collapse it.
- **Resolved shades no longer follow the accent.** After import, changing `accent` on Claude's page won't update `accent-hover`. The page already behaves that way for any literal. The README's "Not synced" note says those shades were computed from the accent.
- **Contrast flags could be noisy.** Some brands' own pairs fail. They're warnings, written into usage notes, not build failures.
