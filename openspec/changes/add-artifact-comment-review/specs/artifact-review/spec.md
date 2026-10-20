## ADDED Requirements

### Requirement: Import Artifact Comments
The MCP server SHALL provide `import_open_design_comments` taking `entryPath`, `source` (`"claude-artifact"`), `artifactUrl` and `comments`, each with `externalId`, `text`, optional `author`, optional `anchor` (`selector`, `text`, `odId`) and optional `createdAt`. It SHALL merge them into `<entry>.comments.json` by `externalId`: new ones as status `open`, existing ones keeping their status, each with `source` and `threadUrl`. It SHALL NOT reach the artifact service itself. Imported comments SHALL appear in `get_open_design_artifact`'s `openComments` and be resolvable through `resolvedCommentIds` like any other.

#### Scenario: First import
- **WHEN** the agent imports three artifact comments for a registered poster
- **THEN** the sidecar SHALL contain three open comments with `source: "claude-artifact"`, and `get_open_design_artifact` SHALL list them

#### Scenario: Re-import
- **WHEN** the same comments are imported again after one was resolved
- **THEN** no duplicates SHALL be added and the resolved one SHALL stay resolved

#### Scenario: Unregistered entry
- **WHEN** the entry has no manifest
- **THEN** the tool SHALL return a not-registered result and SHALL NOT write a sidecar

### Requirement: Artifact Review Guidance
The Claude-facing skills SHALL tell the agent, when it has artifact comment tools and a comment on a design's artifact reaches it or the person says reviewers commented: read the threads, import them with `import_open_design_comments`, apply the changes, republish the artifact, reply in each thread with what changed, and resolve the comments it addressed. Replies SHALL speak only about the design.

#### Scenario: Comment sent to Claude
- **WHEN** a reviewer's comment "make the headline smaller" on the poster's artifact is sent to Claude
- **THEN** the agent SHALL import it, edit the poster, republish to the same artifact, and reply in that thread

### Requirement: Direction Picks in an Artifact
When an exploration's comparison page is published as an artifact, it SHALL offer a pick control per direction that records `{ direction, reviewer, note }` in the artifact's database. The skill SHALL tell the agent to read the picks, show the person a tally, and call `choose_open_design_direction` only with the direction the person confirms.

#### Scenario: Reviewers disagree
- **WHEN** two reviewers pick direction A and one picks B
- **THEN** the agent SHALL show the 2–1 tally and ask the person, and SHALL NOT call `choose_open_design_direction` before they answer
