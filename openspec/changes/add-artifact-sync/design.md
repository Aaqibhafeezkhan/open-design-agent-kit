## Context

The preview artifact is published by the agent from a file path: `prepareArtifact` writes `exports/<name>.html` and runs the artifact preflight, and the instructions tell the agent to publish that path with its Artifact tool (`packages/core/src/generation/publishArtifact.ts`, `publishInstructions.ts`). Reading an artifact back is the Artifact tool's `read` action. For the person's own artifact, or one they can edit, it returns the raw page and saves it to a local file. The kit's server never talks to claude.ai.

## Decisions

### Carry the files inside the page, not in artifact runtime storage

| Option | Why not (or why) |
|---|---|
| **`db` capability** (shared documents, which the agent reads and writes with `ArtifactData`) | Built for small records, not files of hundreds of KB. The page would have to declare `db` and `user`, which brings a consent prompt and access rules to a page that is only a preview. Each write is a separate approved call, and a row can't be written in the same step as a page version, so the files and the preview can get out of step. |
| **`assets` capability** (uploaded blobs, 20 MiB each) | The page has to declare `assets`, and only Editors get it. Each file is a separate upload, and the asset ids have to be tracked somewhere. JSON and text files are accepted, but `.glb`/`.hdr` were already refused as artifact files (embed-3d-assets-for-artifacts). Assets also aren't versioned with the page. |
| **`artifact` capability** (the page republishes itself) | For state a viewer changes on the page. Nothing here is edited by viewers. |
| **Supporting `files` on the publish** (`od-sync/bundle.json` beside the page) | Workable: each text file has its own 16 MB limit, and files are versioned with the page. But the kit's publish-by-path step becomes a `files` map, and a restore has to read the page and a second path. This is the fallback if the in-page budget turns out too tight (see Open Questions). |
| **A JSON block in the page** (chosen) | One publish, one version. The preview and its sources always match. No capability, no consent prompt and no extra tool calls. One `read` brings back everything, saved to a file. This is the same approach as `application/od-embedded-assets+json`, which the viewer already serves. |

### Plain text, not compressed

Text files (HTML, JSON, Markdown, CSS) are stored as JSON strings, and only binary supporting files are base64. That costs bytes, but a model with no kit server can read the entry straight from the page and write it back. Compression would need code execution to open the bundle. Working files are usually tens of KB, small next to the 16 MB limit. Supporting images are the exception, and they count toward the budget like everything else.

### Sync gives way to the preview

The budget check runs on page plus bundle. Over 16 MB, the page goes out without the bundle and the instructions say so (`artifact-sync-dropped`). The preview is the reason the artifact exists, so sync is never a reason to fail a publish. From 12 MB the usual `artifact-near-limit` warning names the bundle's share.

### Opt-in, kept in the manifest

Anyone the person shares the artifact with can read the bundle, and every version keeps its own copy. So sync is off until the person agrees. `metadata.sync: true` keeps it on for later preview publishes, which the agent makes without asking each time (add-artifact-preview). `sync: false` turns it off and the next version carries no bundle. The instructions say that earlier versions still hold it.

### Restore takes a path, not page text

`restore_open_design_artifact({ pagePath, artifactUrl, overwrite? })` reads the file the Artifact tool saved, so the page never passes through the model's context. It writes only under the output directory, relative to the paths recorded in the bundle (which are relative to the output directory, not the old workspace). A path that is absolute, contains `..`, or ends up outside the output directory is refused, and so is the whole restore. If any target file exists with different content and `overwrite` isn't set, nothing is written and the differing files are listed. After writing, it records `{ provider: "claude-artifact", url: artifactUrl }` through the same `validatePublished` path, so the restored design keeps publishing to the same artifact.

### Folderless chat edits the bundle by hand

Claude Chat without a folder doesn't run the kit's local server. Restoring there would mean nothing to write to. Instead, the skill tells Claude to:

1. read the artifact;
2. take the entry text from the bundle;
3. edit it;
4. republish a page made of the edited entry plus the bundle, with that entry's text replaced and its `sha256` set to `null`.

The page is then the raw entry rather than the kit's standalone export, so remote-asset embedding and the preflight don't run. A later restore treats a `null` hash as "edited outside the kit". It writes the file, reports it, and bumps the manifest's `updatedAt`.

## Risks

- **Shared too widely.** A person who shares the preview also shares the sources and the comment threads. Mitigations: opt-in, the notice, and no claim URLs in the bundle.
- **Path views differ in Desktop with a folder.** Claude saves the read page under its own `/sessions/...` mount, and the server sees host paths (`/mnt/project-files/cowork-spike/FINDINGS.md`). The skill tells Claude to save or copy the page into the connected folder and pass the host path, as for other kit paths.
- **Stale copy wins.** Restoring an older artifact over newer local work is blocked by the differing-file check. Two edited copies are not merged.
- **Hand edits break the page.** A folderless-chat edit that breaks the JSON leaves a bundle the restore rejects. The previous version is still in the artifact's history.

## Open Questions

- Does a Claude Chat with no folder have an Artifact tool that can `read`, and does it see the raw page? This is checked in tasks 5.3; if not, the folderless path is limited to the preview.
- Should the bundle move to a supporting file (`od-sync/bundle.json`) when the page is close to the limit, instead of being dropped? Decide after measuring real 3D pages with embedded assets.
