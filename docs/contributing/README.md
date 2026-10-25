# Contributing

How the project is put together and how to change it.

- [Architecture](architecture.md): the packages and how a request flows through them
- [Content sync](content-sync.md): the upstream pin, the local overlay, curation, mirrors and drift checks
- [Adding a skill or prompt](adding-a-skill-or-prompt.md)
- [Upstream ports](upstream-ports.md): code adapted from Open Design, and how we keep track of it
- [Releasing](releasing.md)

## Evals

`npm run evals` runs a fixed set of briefs (a poster, a landing page, a deck, a shop pack, a card set, a dashboard and two vague requests) headless through Claude Code with this checkout's plugin, and scores every design with the kit's own checks. See [evals/README.md](../../evals/README.md) for the brief format, the options and what each score means.

It costs model tokens and isn't run in CI. Run it by hand:

- **Before and after** a change to checks, skills or craft content (`packages/content/local/`, `packages/claude-plugin/skills/`, `packages/core/src/poster/preflight.ts` and the check code). Run it on the base branch with `--label "before <change>"`, then on your branch with `--label "after <change>"`.
- Put both tables from `evals/RESULTS.md` in the PR description, and commit the two RESULTS.md sections and their contact sheets.
- A change counts as an improvement when the error total drops on both repeats and no brief gets worse by more than one error.

Use `--only <id> --repeat 1` while iterating. For designs made in Claude Desktop or Codex, which the runner can't drive, use `--score-only <dir>`.
