## 1. Sync bundle (core)

- [x] 1.1 `workspace/artifactSync.ts`: collect the entry, manifest (claim URLs removed), `.comments.json`, manifest `supportingFiles`, and a `user:` design system's `DESIGN.md`; list `sources` by path and hash; leave out `exports/` and `.od-figma.json`
- [x] 1.2 Encode: `{ version: 1, entry, createdAt, files: [{ path, encoding: "utf8" | "base64", bytes, sha256, content }] }`, with paths relative to the output directory; escape `</script` safely
- [x] 1.3 Parse and check: block found, version known, paths safe, hashes match (or `null` = edited outside the kit)
- [x] 1.4 Unit tests: round trip of a poster with an image, claim URL removed, `..` path rejected, `null` hash accepted and reported

## 2. Publish (core and MCP)

- [x] 2.1 `sync` option on `publish_open_design_artifact` for `claude-artifact`; store `metadata.sync`; recorded value used when `sync` is omitted; rejected for other providers
- [x] 2.2 `prepareArtifact`: inject the block into the standalone export before the preflight; the preflight counts it; over 16 MB, publish without it and report `artifact-sync-dropped`
- [x] 2.3 `composeArtifactPublishInstructions`: notice the first time sync is on (who can read it, earlier versions keep it); note when dropped; note when turned off
- [x] 2.4 MCP tool schema; VS Code left as is (no Artifact tool)

## 3. Restore (core and MCP)

- [x] 3.1 `generation/restoreArtifact.ts` and the `restore_open_design_artifact` tool: `pagePath`, `artifactUrl`, `overwrite`
- [x] 3.2 Write under the output directory only; all-or-nothing on unsafe paths or differing files; list what was written, skipped as identical, and edited outside the kit
- [x] 3.3 Record the `claude-artifact` share with `validatePublished`; report sources that aren't present locally
- [x] 3.4 Unit tests: fresh workspace, identical files, differing file without and with `overwrite`, page with no bundle, non-claude.ai URL

## 4. Content and docs

- [x] 4.1 Claude-only guidance: offer sync once when the person works across devices or in a session without a folder; how to restore (read the artifact, pass the saved path; in Desktop with a folder, use the host path); folderless-chat editing of the bundle
- [x] 4.2 Regenerate the Claude plugin and CLI skills; run the content drift check; confirm Codex and VS Code output has no sync text
- [x] 4.3 Share and publish guide, tools reference, manifest reference (`metadata.sync`); `scripts/check-docs.mjs`

## 5. Verification

- [ ] 5.1 Claude Code: publish a poster with sync, restore it in a fresh Claude Code cloud session, republish, and confirm the same artifact URL
- [ ] 5.2 3D scene with embedded assets: measure page plus bundle; confirm the drop path if over budget
- [ ] 5.3 Claude Chat with no folder: confirm the Artifact tool can read the raw page; edit the entry by hand; restore it in Claude Code and see it reported as edited outside the kit
