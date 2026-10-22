## Context

Bundled design systems are vendored from upstream into `packages/content/assets/open-design/design-systems/<id>/` and are never hand-edited. Local fixes live in `packages/content/local/` and are layered on by `apply-local-overlay.mjs`. Today an override folder may hold only `tokens.override.css`, which `resolveDesignSystemTokens()` applies on top of `tokens.css` (precedence: override > tokens.css > DESIGN.md heuristics > contract defaults). `DESIGN.md` reaches the model verbatim through the content index body, in briefs and in exports.

Upstream's template `DESIGN.md` has fixed sections: `## 2. Color` with bullets like `- **Primary:** \`#58CC02\` — Token from style foundations.`, `## 3. Typography` with `**Scale:**` and `**Families:** primary=…, display=…, mono=…`, and `## 4. Spacing & Grid`. Those bullets are machine-made, which is why they can be compared and regenerated mechanically.

## Decisions

### Decide per system, record it, generate the fix

| Option | Why not (or why) |
|---|---|
| Always trust `tokens.css` and rewrite `DESIGN.md` | Wrong for systems where `tokens.css` holds the placeholder (the 8 existing overrides) and where the name and summary describe the `DESIGN.md` look (`lingo`). |
| Always trust `DESIGN.md` | Wrong for the 15 whose `DESIGN.md` primary is the `#3b82f6` placeholder, and it would change what dozens of systems render today. |
| Let the model reconcile at brief time | Non-deterministic. The same system would look different from one run to the next, and the conflict would stay hidden. |
| A recorded decision per system, with generated overlays (chosen) | One reviewable line per system, with deterministic files that a drift check can verify. The person's call sits in a JSON file, not in a generated file. |

`design-system-sources.json` shape: `{ "<id>": { "color": "tokens" | "design", "type": "tokens" | "design", "reason": "…" } }`. Colour and type are separate because they often differ (see `agentic`). The audit fills in suggestions and the reviewer confirms them. A row that isn't confirmed is still a suggestion, marked `"suggested": true`, and the drift check fails on it.

### Placeholder detection is explicit

The values `#2563eb` and `#3b82f6`, and `Inter` as the only family when the other side names a different family, count as placeholders. They're kept as a short list in the script with a comment. They're not inferred, so a system that really uses Tailwind blue can be marked `"design"` or `"tokens"` by hand and isn't flagged again.

### `DESIGN.sections.md` replaces sections by heading

The overlay file is a Markdown fragment of whole sections, each starting with a `## ` heading that names a section in the vendored file by its number-stripped title (`Color`, `Typography`, `Spacing & Grid`). When loading, the content index swaps each named section for the overlay's version and leaves all other sections in place. A heading the vendored file doesn't have fails the overlay step, the same way an unknown id does.

The generated sections keep upstream's bullet format, so the file still reads like the template, plus a first line `<!-- generated from tokens.css by audit-design-system-consistency.mjs; do not edit -->`.

### Same mechanism for `design`-truth fixes

The generated `tokens.override.css` covers:
- `--accent`, plus the B slots derived from it (`--meta`, `--focus-ring`, colour-mix hover and active shades)
- `--bg`, `--surface` and `--fg` when the template names them
- `--font-display`, `--font-body` and `--font-mono`
- the `--text-*` steps when the template scale has eight steps

The 8 existing hand-written overrides are regenerated from it, keeping their explanatory comments in the decision's `reason`.

### Contrast is checked when tokens change

A `design` decision can change `--accent` against `--accent-on`. The generator measures contrast with the same helper the artifact checks use. When the pair falls below 4.5:1, it also writes `--accent-on` (white or near-black, whichever passes), and it says so in the report.

### What a decision can't move

A decision picks a side per group, but three things always follow `tokens.css`, so the two files still agree afterwards:
- **Light/dark polarity.** A `design` Surface, Background or Text that would flip the page from light to dark (or back) stays with tokens, and the Color section states the token value instead. The prose describes the rendered page.
- **The type scale**, unless the template lists all eight `--text-*` steps. No bundled template does (they have six or seven, or prose), so the Typography section's `**Scale:**` is rewritten from tokens.
- **Spacing.** The template's `**Spacing scale:**` is rewritten from the `--space-*` steps.

A `tokens` decision also rewrites any other section that repeats the old Primary hex (Components, Motion & Interaction), since leaving it would bring the second brand back. Serif families get a serif fallback stack.

### The sections logic lives twice

`applyDesignSections` exists in `packages/content/scripts/designSystemConsistency.mjs` (the overlay step validates headings with it) and in `packages/core/src/content/designSections.ts` (the content index applies it). The content package has no dependency on core, so the two are kept in step by hand and each has its own tests.

## Risks / Trade-offs

- **About 50 manual decisions.** Mitigation: the audit's suggestions resolve the placeholder cases automatically, leaving roughly 30 real conflicts to review in one sitting with the side-by-side table.
- **Upstream may fix things differently.** The drift check reports stale or redundant overlays, so they're re-decided rather than silently diverging.
- **Changed renders.** A `design` decision changes how existing users' designs in that system look the next time they're made. The release notes list every system whose tokens changed.

## Open Questions

- Should the decision for brand look-alikes (such as `lingo`, `agentic`) also update the summary when the summary describes the losing side? The proposal leaves prose alone.
