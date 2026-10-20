## ADDED Requirements

### Requirement: Claude Artifact Provider
`publish_open_design_artifact` SHALL accept `provider: "claude-artifact"`. For it, the tool SHALL build the `standalone` export instead of the `site` bundle, run the Artifact Preflight on that file, and return instructions for the agent to publish the file at its path with its own Artifact tool, give the user the link, and record it. When a `claude-artifact` share record exists for the entry, the instructions SHALL tell the agent to publish to that URL so it becomes a new version of the same artifact. The badge SHALL be off by default for this provider. The tool SHALL NOT itself create, upload to or call any artifact service.

#### Scenario: First publish
- **WHEN** the tool is called with `provider: "claude-artifact"` for a registered poster with no share record
- **THEN** it SHALL write `exports/<name>.html`, and the instructions SHALL name that path for the Artifact tool and ask the agent to record the resulting URL

#### Scenario: Republish
- **WHEN** a `claude-artifact` record with URL `https://claude.ai/artifact/abc` exists for the entry
- **THEN** the instructions SHALL tell the agent to publish to `https://claude.ai/artifact/abc` rather than create a new artifact

#### Scenario: Offered with its requirement
- **WHEN** the tool is called without `provider`
- **THEN** the provider choices SHALL include `claude-artifact`, marked as needing Claude Code or Claude Desktop with an Artifact tool

### Requirement: Artifact Preflight
For the `claude-artifact` provider, the system SHALL check the standalone file against the artifact viewer's limits: it SHALL report `artifact-near-limit` from 12 MB and `artifact-too-large` above 16 MB, and SHALL report `artifact-blocked-host` for each remaining remote reference whose host is not allowed for its kind (scripts from cdnjs, jsDelivr `/npm/`, unpkg, the Tailwind CDN and the jQuery CDN; stylesheets and fonts from Google Fonts), naming the URL. `artifact-too-large` SHALL return an error and no publish instructions. Other findings SHALL be listed in the instructions as what will not load.

#### Scenario: Remote texture
- **WHEN** a 3D scene's standalone file still loads a texture from `dl.polyhaven.org`
- **THEN** the preflight SHALL report `artifact-blocked-host` with that URL

#### Scenario: Allowed CDN
- **WHEN** the page loads three.js from `cdn.jsdelivr.net/npm/three@0.160.0`
- **THEN** the preflight SHALL report nothing for it

#### Scenario: Page too large
- **WHEN** the standalone file is 17 MB
- **THEN** the tool SHALL return an `artifact-too-large` error and no instructions

## MODIFIED Requirements

### Requirement: Explicit Confirmation Before Anything Goes Public
The composed publish instructions SHALL require the model to stop before running any deploy command. At that point it SHALL show the user:
- the provider
- the files going out (from the preflight)
- that the result is publicly reachable
- the expiry for temporary providers
- whether the badge is present and how to remove it
- for `github-pages`, that Pages sites are public even from private repositories

It SHALL then proceed only after an explicit yes in the same conversation. The instructions SHALL forbid deploying from any directory other than the bundle directory, and SHALL forbid retrying a failed deploy with guessed commands. This stage SHALL NOT be required for `claude-artifact`, whose result is private to the user until they share it from claude.ai; its instructions SHALL say so.

#### Scenario: Confirmation stage present for every provider
- **WHEN** publish instructions are composed for any of the six hosting providers
- **THEN** they SHALL contain a stop-and-confirm stage before the first deploy command, mentioning public visibility and the badge

#### Scenario: Private artifact
- **WHEN** publish instructions are composed for `claude-artifact`
- **THEN** they SHALL contain no stop-and-confirm stage and SHALL state that the artifact stays private until the user shares it

### Requirement: Share Records
When `publish_open_design_artifact` is called with `published: { provider, url, claimUrl?, expiresAt?, siteRef? }`, it SHALL:
- validate that `url` is `https:`
- write a record `{ provider, url, claimUrl?, expiresAt?, siteRef?, publishedAt }` into the manifest's `metadata.shares`, replacing any record with the same `provider` and `siteRef`
- for `claude-artifact`, use the artifact URL as `siteRef` when none is given
- keep at most 20 records, dropping the oldest

It SHALL NOT rebuild the bundle in this mode. The composed instructions SHALL tell the model to make this call after a successful deploy or publish. When records exist for the chosen provider, they SHALL tell it to redeploy to the recorded `siteRef`, not create a new site or artifact.

#### Scenario: Recording a temporary link
- **WHEN** the tool is called with `published: { provider: "cloudflare-temporary", url: "https://x.workers.dev", claimUrl: "https://dash.cloudflare.com/claim/…", expiresAt: "2026-10-03T13:00:00Z" }`
- **THEN** the manifest's `metadata.shares` SHALL contain that record with a `publishedAt` timestamp

#### Scenario: Recording an artifact
- **WHEN** the tool is called with `published: { provider: "claude-artifact", url: "https://claude.ai/artifact/abc" }`
- **THEN** `metadata.shares` SHALL contain one `claude-artifact` record whose `siteRef` is that URL

#### Scenario: Republishing replaces the record
- **WHEN** a second record for provider `netlify` and the same `siteRef` is recorded
- **THEN** `metadata.shares` SHALL hold one `netlify` record for that `siteRef`, with the newer `url` and `publishedAt`

#### Scenario: Non-https URL rejected
- **WHEN** `published.url` is `http://example.com` or `file:///tmp/x.html`
- **THEN** the tool SHALL return an invalid-args error and SHALL NOT modify the manifest
