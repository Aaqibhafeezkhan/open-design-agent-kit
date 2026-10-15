## Why

The 2026-10-15 baseline (`docs/test-cases/3d/baseline-2026-10-15.md`) ran two 3D test cases on the current `3d-object` skill. Both passed `check_open_design_artifact` with zero findings while showing flaws a reviewer spots in seconds: T1 had milky glass, an oversized lake and empty framing, and T2 had a chessboard with no squares. Today the agent stops once the check comes back clean, and it sees only one camera angle. Google's Gemini 4 Argon guide (workflow 3) found the same failure ("models stop after round 2") and fixes it with an adversarial critic that inspects four standard shots and scores the scene against a bar. Our agents need that loop, and the kit needs to supply the evidence it runs on.

## What Changes

- **3D scene handles.** The `3d-object` skill's ready contract adds `odScene.scene`, `odScene.camera` and `odScene.renderer` (plus optional `controls`, `focus` and named `views`), so the kit can drive the camera and read renderer statistics. The baseline couldn't take a wireframe shot at all because the scene wasn't reachable.
- **Review views in the check.** For a WebGL artifact that exposes handles, `check_open_design_artifact` renders four review views: three-quarter overview, close-up, low angle, and wireframe. It computes them from the scene's bounds unless the page names its own, and returns them as one labelled 2×2 contact sheet, so the image budget barely grows. A new `views` option selects the views or turns them off (`false`). The CLI gets `--views`.
- **3D evidence in the check result.** Pixel metrics for the overview (color entropy, edge density, luminance contrast, dominant-color share) and renderer statistics (draw calls, triangles, geometries, textures) are reported as advisory evidence. A new `webgl-budget` warning fires when a scene exceeds the software-rendering budget.
- **Critic loop guidance.** The `3d-object` skill gains a visual scorecard: seven categories scored 0–3, with automatic failures. After the check is clean, the agent asks a critic, using the host's own subagent where it has one, to judge the review sheet against the brief. The critic must list at least three flaws, each with evidence and a fix, and score every category. The agent fixes the flaws and repeats until every category scores at least 2 with no automatic failure, for at most three critic rounds, then reports what's left.
- **Stage rule fix.** The skill allows an environment behind the object when the brief asks for one, which the baseline's T2 hall needed. The stage stays secondary: darker and less detailed than the object.
- **Ports.** The pixel-metric formula and the scorecard's structure are adapted from majidmanzarpour/threejs-game-skills (MIT), with provenance recorded. No code or text comes from OpenMontage (AGPL).
- The three `3d-object` examples are updated to the new contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `3d-objects`: the ready contract adds scene handles and optional named views; new requirements for the visual scorecard and the critic loop; the stage requirement allows a secondary environment.
- `artifact-visual-check`: new requirements for 3D review views (`views` option, contact sheet), 3D evidence (pixel metrics and renderer statistics) and the `webgl-budget` finding; the CLI check command gains `--views`.

## Impact

- `packages/core/src/export/webgl.ts` (review views, metrics, budget) and `checkArtifact.ts` (the `views` option, contact sheet, result fields); `packages/core/src/vendored/SOURCE.md` (provenance of the ported metric formula).
- The VS Code tool, the MCP tool schema and the CLI `check` command (`views` / `--views`); `docs/reference/tools.md`, `docs/reference/cli.md` and `docs/guides/3d-objects.md`.
- Content: `packages/content/local/skills/3d-object/SKILL.md` and the `3d-object`, `3d-object-glb` and `3d-object-logo` examples, re-synced to every host's assets.
- Existing 3D artifacts without handles keep working: they get today's screenshots and no review views, plus a note saying how to enable them.
- No new dependencies. `pngjs` is already used by `webgl.ts`.
- Validation: rerun T1 and T2 from `docs/test-cases/3d/` and compare with the baseline.
