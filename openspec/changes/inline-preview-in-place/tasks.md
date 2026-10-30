## 1. Revision

- [x] 1.1 `revisionOnly` on `get_open_design_preview_state` for artifact, exploration and campaign targets: a short hash of manifest, entry and supporting-file times plus the open comment count
- [x] 1.2 Unit tests: the revision changes after a re-register, a file edit and a saved comment; it doesn't change otherwise

## 2. Inline views

- [x] 2.1 Artifact, exploration and campaign views: poll while visible (3 s, 10 s after 2 min idle, reset on change or click), reload on change, "Updated" note
- [x] 2.2 Hold the reload while a comment draft is open; stop polling after a failed call and show the reload button
- [x] 2.3 Browser test with the reference host: re-register the shown design and see the view update without a new tool result; no calls while hidden

## 3. Register text and skills

- [x] 3.1 Track entries shown inline per process; `previewNoteAfterRegister`: in an MCP Apps host, "updates by itself" for an entry already shown in this process, else "call show_open_design_artifact"; never the browser preview there
- [x] 3.2 Overview skill and `open-design-preview`: show inline once per design per conversation; later rounds update in place
- [x] 3.3 Regenerate skill copies; content drift check passes

## 4. Annotations

- [x] 4.1 `TOOL_ANNOTATIONS` for every tool (read-only, writes in the workspace, reaches other services), copied in at registration
- [x] 4.2 Unit test: every listed tool has annotations; spot checks for `list_open_design_skills`, `check_open_design_artifact`, `publish_open_design_artifact`

## 5. Docs

- [x] 5.1 `docs/guides/inline-preview.md`: the design updates in place; the reload button stays for older copies
- [x] 5.2 `docs/reference/tools.md`: annotations per tool, `revisionOnly`, the register note

## 6. Verification

- [ ] 6.1 Desktop Chat with a folder (macOS): two rounds of comments update one inline copy
- [ ] 6.2 The device-link route on current Desktop (macOS and Windows): does it draw MCP Apps now? Update the guide's table either way
- [ ] 6.3 Check whether Desktop shows the page's background calls; raise the interval if it does
