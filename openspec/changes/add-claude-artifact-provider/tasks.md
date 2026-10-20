## 1. Artifact preflight (core)

- [ ] 1.1 `export/artifactPreflight.ts`: one constant for the allowed hosts (scripts: cdnjs.cloudflare.com, cdn.jsdelivr.net/npm/, unpkg.com, cdn.tailwindcss.com, code.jquery.com; stylesheets and fonts: fonts.googleapis.com, fonts.gstatic.com)
- [ ] 1.2 Scan the standalone file's remaining remote references (scripts, stylesheets, images, media, fetch-able URLs found by the bundler) and report each blocked one with a code (`artifact-blocked-host`)
- [ ] 1.3 Size check: `artifact-near-limit` from 12 MB, `artifact-too-large` above 16 MB
- [ ] 1.4 Unit tests: allowed CDN kept quiet, Poly Haven texture flagged, external `<img>` flagged, 17 MB page fails

## 2. Provider (core)

- [ ] 2.1 Add `claude-artifact` to the provider set and table, with "needs Claude Code or Claude Desktop with an Artifact tool"
- [ ] 2.2 Recipe: build `standalone` (badge off unless asked), run the artifact preflight, compose publish-by-path instructions; reuse a recorded `claude-artifact` URL as the update target
- [ ] 2.3 No stop-and-confirm stage for this provider; state that the artifact is private until shared
- [ ] 2.4 `artifact-too-large` returns an error and no instructions
- [ ] 2.5 Share records: accept `claude-artifact`, use the URL as `siteRef`, accept `https://claude.ai/...` URLs

## 3. Hosts

- [ ] 3.1 MCP server and VS Code tool schemas: provider enum
- [ ] 3.2 VS Code Share quick pick: leave `claude-artifact` out (VS Code chat has no Artifact tool)

## 4. Content and docs

- [ ] 4.1 `publish` prompt and overview skill: offer the artifact link first when an Artifact tool is available; exports stay files
- [ ] 4.2 Run the content drift check
- [ ] 4.3 Share and publish guide, tools reference (checked by `scripts/check-docs.mjs`)

## 5. Verification

- [ ] 5.1 Publish the Swiss deck example and a poster through the provider from Claude Code; republish updates the same URL
- [ ] 5.2 Confirm whether Claude Desktop Chat with a folder can publish (the spike saw a private publish there; repeat with the real tool)
