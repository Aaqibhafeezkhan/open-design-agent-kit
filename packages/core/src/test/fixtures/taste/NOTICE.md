# Taste check fixtures

Good and bad pages for the taste checks in `collectPreflight` (openspec `add-taste-checks`): `slop-glow`, `card-row`, `uniform-surface`, `type-scale` and `intent`, one `-bad.html` that must report the code and one `-good.html` that must not.

The fixtures are written for this kit. The patterns they exercise follow the detectors of two MIT-licensed projects; no code or fixture file was copied from either:

- [OpenPencil](https://github.com/ZSeven-W/openpencil) (MIT): `crates/op-design-lint/src/detectors/slop.rs` (`purple-glow-gradient`, `three-card-feature-row`, `rounded-card-wall`).
- [ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) (XIAS, MIT): `slop_tells.mjs`, `lint_intent.mjs`, `taste_audit.mjs` and `tests/fixtures/bad`.
