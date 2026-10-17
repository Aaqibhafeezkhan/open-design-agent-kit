# Run with light and framing measurements, 2026-10-17

T2 and T4 after `improve-3d-light-and-framing`, starting from the [Blender spike](spike-2026-10-17-blender.md) scenes. The host and model are the same as in earlier runs: Claude Code with Claude Opus 5.5.

- **The check** now measures the hero still at desktop and mobile, with the page's own camera and `rotate = false`. It reports how much of the frame the focal subject (`odScene.focus`) spans, whether the subject is cut off, whether a flat focal object is edge-on, and how bright the subject is against the lit scene around it. It raises `framing` and `light` warnings.
- **The builder** (me) followed the updated `3d-scene` skill: a focal subject, a named light setup, a portrait hero, and every `framing`/`light` warning fixed before any critique.
- **The critic** was a fresh subagent per round with the usual scorecard, told to treat `framing`/`light` warnings as flaws.

## Summary

| Case | Round | Verdict | Form | Mat. | Light | Comp. | Stage | Fidelity | Tech. | Automatic failures |
|---|---|---|---|---|---|---|---|---|---|---|
| T4 | 1 | fail | 2 | 1 | 1 | 1 | 2 | 2 | 3 | pencils floating |
| T4 | 2 | fail | 2 | 2 | 2 | 2 | 1 | 2 | 2 | none |
| T4 | 3 | **pass** | 2 | 2 | 2 | 2 | 2 | 2 | 2 | none |
| T2 | 1 | fail | 2 | 2 | 2 | 1 | 2 | 1 | 2 | black knights unrecognizable (Blender knights) |
| T2 | 2 | fail | 2 | 1 | 1 | 1 | 2 | 1 | 2 | arches not pointed (borderline); mobile frame |

**T4 is the first test case to pass the scorecard**, after five runs across three changes. Light and composition, stuck at 1 in every earlier run, reached 2 in round 2 and stayed there.

Hero-still measurements on the final designs:

| Case | Viewport | Focal span (W × H) | Clipped | Face angle | Brightness vs lit surroundings |
|---|---|---|---|---|---|
| T4 | desktop | 20% × 34% | none | 46° | 1.69× |
| T4 | mobile | 45% × 20% | none | 41° | 1.61× |
| T2 | desktop | 71% × 68% | 2% bottom | 65° (the board, seen from above) | 1.28–1.66× (flicker) |
| T2 | mobile | 95–97% × 41–46% | 4–7% left | 45° | 1.9× |

Before this change, T4's gantry was edge-on at 88° and spanned under 1% of the frame. The measurement flagged it exactly as the spike's critic had.

## What moved light and composition

- **The edge-on warning fixed T4's focal point in one edit.** With the gantry's face at 46° and the camera leaning in over the start line, the critic called it "the best part of the frame". Before, it was "a thin red stick".
- **The practical-light rule plus one bug fix made the lamp the key.** The spot sat inside the lamp's shade, and the lamp cast shadows, so the shade blocked its own light. The critic said "the lamp gives off no light". With the fixture's shadows off, the start line went from 1.45× to 1.94× brighter than its surroundings. The same bug showed up in T2's brazier, whose bowl blacked out the floor. It's now a rule in the skill.
- **Portrait framing per view.** `heroPortrait` and the fit snippet gave T4's mobile frame its own camera. The board in T2 is limited by its width in portrait, so placement (aiming past the board) mattered more than distance.
- **A quiet environment and unstretched wood** (`envMapIntensity` 0.3, grain on the top face only) removed the glare streaks the critic read as "the brightest thing in the frame".

## Findings that changed the change

1. **Size by span, not area.** A gantry spanning 34% of the frame's height covers only 5% of its area. A 6% area bar flagged a well-framed shot, so the warning now fires when the subject spans under 20% of both the width and the height.
2. **Background isn't "surroundings".** A product on a bright studio backdrop, and the courtyard's dusk sky, were flagged as "darker than the surroundings". The check now renders the hero frame over black and over white with the background off, and compares the subject only against lit geometry. A subject on a plain backdrop gets no light comparison.
3. **No clipping warnings without a focal subject.** A whole scene runs off the frame by nature, so without `odScene.focus`, clipping is evidence only.
4. **"Low ambient" overshot to a black room.** T4 round 2 failed on stage alone. The skill's ambient rule now has a floor (0.15–0.3 × the key), and the `interior-lamp` hemisphere is 0.5.
5. **The examples had real framing bugs.** The `3d-object` example's portrait pull-back never worked, because `controls.maxDistance = 10` clamped it. The courtyard had no portrait view, and its lantern spanned 19% of the mobile frame. Both are fixed, and all four examples now check with no `framing`/`light` warnings.

## Open issues

- **Flickering lights make the brightness ratio noisy.** T2's fire flickers by time, so the ratio read 1.28× in one check and 1.66× in another, at the same pose. The check fixes the camera (`rotate = false`) but not the light. A still-time convention (for example `odScene.time = 0` for stills) would make the measurement repeatable.
- **Vertical placement isn't measured.** T2's mobile frame passed every measurement but still had an empty top half. The evidence could report where the subject sits vertically, and how much of the frame is empty or void.
- **Critics drift between rounds.** T2 lost a point in light and materials between rounds on a near-identical scene. The measurements didn't drift, apart from the flicker above, which is the point of having them.
- **T2's remaining failures are outside light and framing:** pointed arches, carved ivory and stone pillars are craft passes.
- **Test hygiene:** run critic checks one at a time. In one round, six checks running at once caused readiness timeouts, a failed asset load and an all-black low view, and that round was discarded.
