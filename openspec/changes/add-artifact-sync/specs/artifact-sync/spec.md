## ADDED Requirements

### Requirement: Opt-In Sync Setting
`publish_open_design_artifact` SHALL accept `sync` (boolean) only with `provider: "claude-artifact"`, returning an invalid-args error for any other provider. It SHALL store the setting as `metadata.sync` and use the stored value when `sync` is omitted. With sync on, the page prepared for the artifact SHALL contain one `<script type="application/od-sync+json" id="od-sync">` block; with it off, none. The tool SHALL NOT publish, upload or read any artifact itself.

#### Scenario: Sync turned on
- **WHEN** a registered poster is published with `provider: "claude-artifact"` and `sync: true`
- **THEN** the standalone page SHALL contain the sync block, and the manifest SHALL record `metadata.sync: true`

#### Scenario: Later preview publish keeps sync
- **WHEN** the same poster is published again with `provider: "claude-artifact"` and no `sync` argument
- **THEN** the page SHALL contain an up-to-date sync block

#### Scenario: Other provider
- **WHEN** the tool is called with `provider: "netlify"` and `sync: true`
- **THEN** it SHALL return an invalid-args error and build nothing

### Requirement: Sync Bundle Contents
The sync block SHALL hold:
- the entry file;
- its manifest, with every share record's `claimUrl` removed;
- its `.comments.json`, when present;
- the supporting files its manifest lists;
- the `DESIGN.md` of its design system, when the system is a `user:` one.

It SHALL NOT include the `exports/` folder or `.od-figma.json`. The manifest's `sources` SHALL stay listed by path and hash, and their documents SHALL NOT be copied.

#### Scenario: Working files carried
- **WHEN** a poster with one supporting image and a comments file is published with sync on
- **THEN** the block SHALL contain the entry, manifest, comments file and image, and no file under `exports/`

#### Scenario: Claim URLs removed
- **WHEN** the manifest holds a `netlify-temporary` share record with a `claimUrl`
- **THEN** the manifest copy in the sync block SHALL NOT contain that `claimUrl`

### Requirement: Sync Bundle Format
The sync block SHALL be JSON of the form `{ version: 1, entry, createdAt, files: [{ path, encoding, bytes, sha256, content }] }`:
- `path` SHALL be relative to the output directory;
- `encoding` SHALL be `utf8` for text files, stored as their text, or `base64` for binary files;
- `sha256` SHALL be the hash of the file's bytes, or `null` for a file edited outside the kit.

The block SHALL be escaped so its content cannot close the script element early.

#### Scenario: Entry readable without tools
- **WHEN** the page of a synced HTML design is read as text
- **THEN** the entry file's HTML SHALL appear in the block as a JSON string, not base64 or compressed

#### Scenario: Script-closing text in a file
- **WHEN** the entry contains the text `</script>`
- **THEN** the page SHALL still parse with one complete sync block, and restoring it SHALL give back the original text

### Requirement: Sync Within the Artifact Size Budget
The artifact preflight SHALL count the sync block in the page's size. When the page with the block would exceed 16 MB, the tool SHALL prepare the page without the block, SHALL report `artifact-sync-dropped` with the page and bundle sizes in the instructions, and SHALL still return publish instructions. A page that exceeds 16 MB without the block SHALL fail as it does without sync.

#### Scenario: Bundle would exceed the limit
- **WHEN** a 3D scene's page is 11 MB and its sync bundle 6 MB
- **THEN** the page SHALL be prepared without the block, and the instructions SHALL contain `artifact-sync-dropped` and the publish steps

#### Scenario: Bundle fits
- **WHEN** the page is 400 KB and the bundle 120 KB
- **THEN** the page SHALL include the block and the preflight SHALL report no size finding

### Requirement: Sync Privacy Notice
The first time sync is turned on for an entry, the composed artifact publish instructions SHALL tell the agent to say three things to the person:
- the artifact now carries the design's working files and comments;
- anyone they share the artifact with can read them;
- earlier versions keep their copy even after sync is turned off.

When `sync: false` turns a stored setting off, the instructions SHALL say the next version carries no bundle and earlier versions still do.

#### Scenario: First synced publish
- **WHEN** an entry without `metadata.sync` is published with `sync: true`
- **THEN** the instructions SHALL contain the notice about sharing and earlier versions

#### Scenario: Sync turned off
- **WHEN** an entry with `metadata.sync: true` is published with `sync: false`
- **THEN** the page SHALL contain no sync block, and the instructions SHALL say earlier versions still hold one

### Requirement: Restore From a Synced Artifact
The MCP server SHALL provide `restore_open_design_artifact({ pagePath, artifactUrl, overwrite? })`. `pagePath` is a page the agent saved with its Artifact tool; `artifactUrl` is an `https://claude.ai/...` URL. The tool SHALL write the sync block's files under the output directory at their recorded paths, then record `artifactUrl` as the entry's `claude-artifact` share record. It SHALL NOT make any network request.

#### Scenario: Restore on another machine
- **WHEN** the tool is called in an empty workspace with a page whose bundle holds `pitch/pitch.html` and its manifest, and `artifactUrl` `https://claude.ai/artifact/abc`
- **THEN** both files SHALL be written under the output directory, and the restored manifest's newest `claude-artifact` record SHALL have that URL

#### Scenario: Page without a bundle
- **WHEN** the page has no `application/od-sync+json` block
- **THEN** the tool SHALL return an error saying the artifact was published without sync, and write nothing

### Requirement: Restore Integrity and Report
`restore_open_design_artifact` SHALL check every file's hash before writing. A file whose content does not match a non-null hash SHALL fail the restore with nothing written. A file with a `null` hash SHALL be written and reported as edited outside the kit, and the manifest's `updatedAt` SHALL be set to the restore time. The result SHALL list:
- the files written;
- the files skipped because they were identical;
- the files edited outside the kit;
- the manifest `sources` not present locally.

#### Scenario: Edited outside the kit
- **WHEN** the bundle's entry has `sha256: null`
- **THEN** the entry SHALL be written and listed as edited outside the kit

#### Scenario: Corrupt file
- **WHEN** a file's content does not match its non-null `sha256`
- **THEN** the tool SHALL return an error naming that file and write nothing

### Requirement: Restore Safety
`restore_open_design_artifact` SHALL refuse the whole restore, writing nothing, when any recorded path:
- is absolute;
- contains a `..` segment;
- resolves outside the output directory.

When a target file exists with different content and `overwrite` is not true, the tool SHALL write nothing and list the differing files. Files that exist with identical content SHALL be left untouched.

#### Scenario: Path escape
- **WHEN** the bundle holds a file at `../../.ssh/config`
- **THEN** the tool SHALL return an error and write no file

#### Scenario: Newer local work
- **WHEN** `pitch/pitch.html` exists locally with content different from the bundle, and `overwrite` is not given
- **THEN** the tool SHALL write nothing and name `pitch/pitch.html` as differing

#### Scenario: Overwrite confirmed
- **WHEN** the same call is made with `overwrite: true`
- **THEN** the tool SHALL write the bundle's version of `pitch/pitch.html`

### Requirement: Sync and Restore Guidance
The Claude-facing skills SHALL tell the agent, when it has an Artifact tool:
- to offer sync once when the person says they will continue on another device or in a session without the workspace, and to turn it on only after they agree;
- to restore by reading the artifact with the Artifact tool and passing the saved file's path to `restore_open_design_artifact`.

Skills generated for Codex and the VS Code instructions SHALL NOT contain this guidance.

#### Scenario: Continue elsewhere
- **WHEN** the person says in Claude Code that they'll pick the poster up on their laptop later
- **THEN** the agent SHALL offer sync and SHALL NOT turn it on without their agreement

#### Scenario: Picking it back up
- **WHEN** the person gives a synced artifact link in a new Claude Code session
- **THEN** the agent SHALL read the artifact and call `restore_open_design_artifact` with the saved page's path and the link

#### Scenario: Not for other agents
- **WHEN** the Codex skills and VS Code instructions are generated
- **THEN** they SHALL contain no sync or restore guidance

### Requirement: Editing a Synced Design Without the Kit
The Claude-facing skills SHALL tell the agent what to do in a chat where it has an Artifact tool but the kit's tools are unavailable:
- take the entry from the sync block and edit it;
- republish the edited entry as the page, to the same artifact URL;
- keep the sync block, with that entry's text replaced and its `sha256` set to `null`.

#### Scenario: Chat with no folder
- **WHEN** the person asks to change the headline of a synced poster in a Claude chat without the kit's tools
- **THEN** the agent SHALL republish the edited page to the same artifact URL, with the block's entry updated and its `sha256` set to `null`
