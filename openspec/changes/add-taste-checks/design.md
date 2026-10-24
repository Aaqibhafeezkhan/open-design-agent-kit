## Context

Preflight runs in the export browser through `collectPreflight(opts)` in `packages/core/src/poster/pageScripts.ts`. It is serialised into the page, so every helper is nested inside it (`describe`, `parseColor`, `luminance`) and it returns `PageFinding { check, severity, message, selector?, card? }`. `checkPage` in `packages/core/src/export/checkArtifact.ts` calls it per viewport (desktop 1440×900, mobile 390×844) and saves the run under `.open-design/.checks/`. The skill tells the agent to fix errors, look at the screenshots, and stop after at most two fix rounds.

## Goals / Non-Goals

**Goals:** catch the five most common taste tells on the rendered page; few false positives on the bundled examples; findings that say what to change; no extra tool call for the agent.

**Non-Goals:** a taste score; blocking export or registration on taste; image-based detection (screenshots through a model); checking copy for invented metrics or filler text (left to the critic, `add-design-critic`); detectors for decks, posters and cards beyond `slop-glow` and `intent` (their layouts differ and need their own thresholds).

## Decisions

### Rendered DOM, not source HTML

Source scanning (XIAS `slop_tells.mjs` works on files) misses styles set by scripts, Tailwind classes and inherited values. The export browser already has computed styles and boxes, so every detector reads `getComputedStyle` and `getBoundingClientRect`. This is also why the detectors live in `collectPreflight` rather than a new Node pass.

### Thresholds (first round)

| Code | Fires when | Taken from |
|---|---|---|
| `slop-glow` | a `background-image` gradient, or a blurred element (`filter: blur` ≥ 40px), whose stops are in hue 235–300°, saturation ≥ 0.45, covering ≥ 25% of the first viewport; or `--accent`/button background equal to one of the indigo values listed in `anti-ai-slop.md` | OpenPencil `purple-glow-gradient`; the craft doc's list |
| `card-row` | 3–4 siblings, each ≥ 160px wide, widths within 4px, same child tag sequence, each starting with an icon (svg/img ≤ 64px or emoji) then a heading | OpenPencil `three-card-feature-row`, XIAS slop tells |
| `uniform-surface` | ≥ 6 boxes with a border or shadow and a background differing from their parent, all with one radius and one shadow value | OpenPencil `rounded-card-wall` |
| `type-scale` | the page defines `--text-*` or `--font-display`, and an `h1`/`h2` uses a size not within 1px of any `--text-*` value, or a family other than `--font-display`/`--font-body` | XIAS `lint_intent.mjs` |
| `intent` | a `button`/`[role=button]`/`a` with destructive text (an English list plus `data-intent="destructive"`) whose background or text hue is outside 345–20° and is not `--danger`; or two or more visible buttons in one group with identical styles where one is `type=submit` or `data-intent="primary"` | XIAS `lint_intent.mjs` |

Each threshold is a named constant in `pageScripts.ts` so tuning is one line, and each has a passing and a failing fixture.

### Warning only, with an opt-out

The study rejected hard gating (XIAS blocks on its gates). A brand can be purple; a pricing page can have three equal tiers. So every code is a `warning`, and `data-od-allow` (space-separated codes, on the element or an ancestor) silences it. The skill tells the agent to fix taste warnings unless the brief or design system asks for that look, and never to add `data-od-allow` just to pass.

### Destructive words list

English only in the first round (delete, remove, discard, erase, cancel subscription, close account, revoke, reset). Non-English pages rely on `data-intent`. The list is in the "Checked in this kit" note and `docs/reference/tools.md` so users can see it.

## Risks / Trade-offs

- **False positives on the examples.** Mitigation: run the check over every bundled remixable example before merging and tune thresholds until no example that a human picked as good fires more than one taste warning; record the counts in the PR.
- **Run time.** Five more DOM walks per viewport. Mitigation: one shared walk of candidate boxes, capped at 2,000 elements like the existing checks.
- **Agents gaming the check** (adding `data-od-allow`). Mitigation: the skill rule above; the critic (`add-design-critic`) sees the attribute.

## Open Questions

- Should `type-scale` also run when the page has no token contract, by checking that heading sizes follow a ratio? Proposed: no, too noisy.
