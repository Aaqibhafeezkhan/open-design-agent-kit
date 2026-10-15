# Rerun with the critic loop, 2026-10-15

T1 and T2 rerun after `add-3d-critic-loop`, with the same host and model as the [baseline](baseline-2026-10-15.md): Claude Code with Claude Opus 5.5. Round 1 was the baseline scene plus the `odScene` handles, and for T2 the hall marked as stage. After each round a fresh critic subagent (Claude Code's Agent tool, as the skill directs) called `check_open_design_artifact` itself, scored the review sheet with the skill's scorecard, and listed flaws with fixes. The builder fixed them, up to the skill's limit of three critic rounds.

## Summary

| Case | Critic round | Verdict | Form | Mat. | Light | Comp. | Stage | Fidelity | Tech. | Automatic failures |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 1 | fail | 2 | 1 | 2 | 2 | 2 | 1 | 2 | houses unrecognizable |
| T1 | 2 | fail | 1 | 2 | 2 | 2 | 2 | 1 | 3 | houses unrecognizable |
| T1 | 3 | fail | 2 | 1 | 2 | 2 | 1 | 2 | 2 | none |
| T2 | 1 | fail | 1 | 1 | 1 | 1 | 2 | 1 | 2 | board, squares and runes missing; knights unrecognizable; set under 40% of the frame |
| T2 | 2 | fail | 2 | 2 | 2 | 1 | 2 | 1 | 2 | runes missing (rendered as a Greek key) |
| T2 | 3 | fail | 1 | 1 | 2 | 1 | 2 | 1 | 2 | white knights unrecognizable |

Human scores (1–10, as in the baseline) for the final designs:

| Case | Form | Mat. | Light | Framing | Fidelity | Baseline |
|---|---|---|---|---|---|---|
| T1 | 7 | 6 | 6 | 4 | 7 | 6 · 5 · 6 · 4 · 5 |
| T2 | 6 | 6 | 6 | 7 | 7 | 5 · 5 · 5 · 6 · 3 |

Exports all succeeded: T1 still, cut-out and 10 s turntable (1 min 44 s); T2 still and 12 s turntable (5 min 36 s).

## What the loop caught that the check didn't

- **Every baseline flaw.**
  - T1: milky glass, an oversized lake, unreadable houses, a sideways lighthouse and a detached shadow.
  - T2: the missing board squares and runes, slab knights, the floating plinth, cropping and the murky hall.
- **A bug the baseline review missed as well.** The rune border used Unicode runic characters, which headless Chromium has no font for, so they rendered as boxes that looked like a Greek key. The round-2 critic flagged "a meander, not runes", and the fix was to draw the runes as strokes.
- **Fidelity rose the most:** T2 went from 3 to 7 and T1 from 5 to 7 on the human scale.

## What it didn't fix

- **Neither design passed in three rounds.** The remaining flaws are craft limits of procedural three.js, not omissions:
  - T1: the glass has no highlight, the stage has no ground, and the trees read as spikes on the silhouette.
  - T2: the white knights are blocky from the authored angle, and the ivory and stone materials are too plain.
- **The ceiling.** The fixes the critic proposes (textures, bump maps, sculpted heads) point to the next changes: a model or texture source (a Blender bridge, CC0 kits) and the `3d-scene` surface.

## Findings that changed the change

- **Composition was judged on the kit's framing.** The review views are fitted by the check, so the overview always fills the frame. The T1 critics scored composition 2 from the overview while the authored desktop frame stayed small (framing 4 on the human scale, unchanged from the baseline). The skill and spec now judge composition, and the 40% rule, on the desktop and mobile screenshots.
- **Critic scores drift.** T2's form and materials went 2 → 1 between rounds 2 and 3 with only small changes. Passing on categories and automatic failures, not a total, keeps that bounded; it's recorded here so later runs can compare.
- **Cost.** Each critic round took 1.5–2.5 minutes and about 46k subagent tokens. A full three-round run adds roughly 6–8 minutes per design.
