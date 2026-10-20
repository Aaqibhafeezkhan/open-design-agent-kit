## 1. Content

- [ ] 1.1 Add the artifact-preview section to the shared instruction source, conditional on having an Artifact tool
- [ ] 1.2 Milestone list: first registration, each feedback round, exploration comparison page
- [ ] 1.3 Regenerate Claude plugin and CLI skills; run the content drift check; confirm Codex and VS Code output has no artifact text

## 2. MCP server

- [ ] 2.1 `register_open_design_artifact`: when the client is Claude (Code or Desktop) and the entry has no `claude-artifact` share record, add one line suggesting the preview
- [ ] 2.2 `get_open_design_artifact`: include `previewUrl` from the newest `claude-artifact` record
- [ ] 2.3 Unit tests for both, including a non-Claude client getting no hint

## 3. Docs

- [ ] 3.1 Claude Code getting started: the artifact preview
- [ ] 3.2 Tools reference for the new field

## 4. Verification

- [ ] 4.1 Claude Code: make a poster, confirm one artifact link after registration and an in-place update after a feedback round
- [ ] 4.2 Exploration: comparison page published once
- [ ] 4.3 Claude Desktop Chat with a folder: same flow
