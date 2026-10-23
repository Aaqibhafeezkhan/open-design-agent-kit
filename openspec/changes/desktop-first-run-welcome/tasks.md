## 1. Goals in the catalog

- [x] 1.1 `packages/content/local/surfaces.json`: add `goals` (id, label, description, icon, ordered `surfaces`) with the starter set from design.md
- [x] 1.2 `packages/content/scripts/surfaces.mjs`: fail on a goal that names an unknown or non-ready surface, an empty `surfaces` list, or a duplicate goal id; test
- [x] 1.3 `packages/core/src/content/contentIndex.ts`: parse goals (mirroring the guard) and expose `listGoals()` and `getGoal(id)`
- [x] 1.4 `listSkillsPayload.ts`: `surface: "list"` adds `goals`; new `goal` argument returns the goal's ready surfaces in order with the first marked `default: true`; unknown goal returns an error listing valid ids
- [x] 1.5 `packages/mcp-server/src/index.ts`: `goal` input on `list_open_design_skills`, description updated; unit tests for list, goal and unknown goal

## 2. Welcome text

- [x] 2.1 Overview skill step 0: replace the Desktop Chat no-tools sentence with the plain welcome (one sentence on what's missing, two numbered options with clicks and the releases link, then "What's it for?"); keep the single-page artifact fallback on request
- [x] 2.2 Overview skill Desktop lines: after `set_open_design_workspace` or `use_open_design_managed_workspace`, tell the user once per session where designs are saved
- [x] 2.3 Overview skill: when a request names no kind of thing to make, show goals from `surface: "list"` and ask what it's for
- [x] 2.4 `packages/content/local/prompts/new.md`: step 1 leads with goals for an empty or vague request, then the goal's surfaces; a named surface still goes straight through
- [x] 2.5 Home-folder guard message in `packages/mcp-server/src/index.ts` reworded so it can be relayed as is
- [x] 2.6 Regenerate skill copies and prompts; content drift check passes

## 3. Docs

- [x] 3.1 `docs/getting-started/claude-desktop.md`: "Your first design" section showing the welcome
- [x] 3.2 `docs/reference/tools.md`: `goal` input and `goals` field

## 4. Verification

- [ ] 4.1 Desktop plain Chat, plugin only: "help me make something for my café" gets the welcome with both options and the goal question, and no file names
- [ ] 4.2 Desktop plain Chat, extension: the first reply names the `~/Documents/Open Design/<name>/` folder once
- [ ] 4.3 Desktop Chat with a folder: the first reply names the folder once; a second design in the same chat doesn't repeat it
- [ ] 4.4 Claude Code: `/open-design:open-design-new` with no argument shows goals; `/open-design:open-design-new wireframe` goes straight to the wireframe surface
