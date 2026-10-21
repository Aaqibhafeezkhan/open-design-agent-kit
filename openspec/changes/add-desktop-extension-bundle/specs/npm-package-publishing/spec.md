## MODIFIED Requirements

### Requirement: All Artifacts for One Version Ship From a Single Shared Release
The `.vsix`, the three npm package tarballs and the Claude Desktop extension `.mcpb` for a given version SHALL be built by the same workflow run and attached to the same GitHub Release, rather than produced by independent release pipelines that could drift to different versions or be released at different, untracked times. The `.mcpb` SHALL vendor the content package from the tarball built in that same run.

#### Scenario: One release lists every artifact
- **WHEN** a release is created for a given version
- **THEN** that GitHub Release SHALL include the `.vsix`, the three npm package tarballs, `open-design-<version>.mcpb`, and a checksum for each

#### Scenario: Publishing downloads from the shared release, not a fresh rebuild
- **WHEN** a publish workflow (marketplace or npm) runs
- **THEN** it SHALL download the artifact it publishes from the existing GitHub Release for the requested version and verify its checksum, rather than rebuilding that artifact itself

#### Scenario: Extension bundle checked before release
- **WHEN** the release workflow builds the `.mcpb`
- **THEN** it SHALL validate the manifest, confirm its version matches the release, start the unzipped bundle outside the checkout and complete an MCP `initialize` and `tools/list` handshake, and SHALL fail the release if any step fails or the bundle exceeds the size limit
