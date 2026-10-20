## MODIFIED Requirements

### Requirement: Structured Documentation Tree
The repository SHALL contain a `docs/` tree of plain Markdown, English only, readable on GitHub without a build step, organized as:
- `docs/README.md` (index by audience);
- `getting-started/` (`vscode`, `claude-code`, `claude-desktop`, `codex`, `cli`);
- `guides/` (`generate-a-design`, `design-systems`, `remix-and-gallery`, `social-posts`, `youtube-video`, `export-images`, `export-decks`, `preview-comments-edit`, `figma`, `promote-to-app-code`);
- `reference/` (`tools`, `prompts-and-commands`, `cli`, `settings-and-env`, `artifact-manifest`);
- `troubleshooting.md`;
- `automation/social-pipeline.md`;
- `contributing/` (`architecture`, `content-sync`, `adding-a-skill-or-prompt`, `upstream-ports`, `releasing`).

Every page SHALL start with a single `#` title and be linked from `docs/README.md`.

#### Scenario: Every page is reachable from the index
- **WHEN** the docs tree is checked
- **THEN** every `docs/**/*.md` page except `docs/README.md` and redirect stubs (pages starting "This page moved to …") SHALL be linked, directly or through a section README, from `docs/README.md`, and `npm run lint` SHALL fail naming any page that isn't

#### Scenario: Old Codex link keeps working
- **WHEN** someone follows an existing link to `docs/codex.md`
- **THEN** the page SHALL point them to `docs/getting-started/codex.md`

#### Scenario: Claude Desktop page
- **WHEN** the docs tree is checked
- **THEN** `docs/getting-started/claude-desktop.md` SHALL exist and be linked from `docs/README.md`
