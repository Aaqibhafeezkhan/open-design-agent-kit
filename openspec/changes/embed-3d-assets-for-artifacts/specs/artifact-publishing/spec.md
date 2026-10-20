## ADDED Requirements

### Requirement: Artifact Publishing Embeds Declared Assets
For `provider: "claude-artifact"`, `publish_open_design_artifact` SHALL build the standalone export with `embedAssets: true` whenever the page declares remote assets, and the artifact preflight SHALL then report only remote references that remain.

#### Scenario: 3D scene published as an artifact
- **WHEN** a `3d-scene` design is published with `provider: "claude-artifact"`
- **THEN** its Poly Haven assets SHALL be embedded and the preflight SHALL NOT report `dl.polyhaven.org`
