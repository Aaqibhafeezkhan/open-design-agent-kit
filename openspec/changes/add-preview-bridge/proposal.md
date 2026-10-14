## Why

The VS Code preview shows a design as `srcdoc` text inside the webview. The design inherits the webview's content-security policy and has no URL of its own, so the preview needs a growing set of workarounds (an injected `<base>`, inlined images and frames, script nonces, an error reporter, stripping all of it again on save), and some things still break silently. On 2026-10-14 a generated mobile prototype's tab bar was dead in the preview because the policy blocks inline `onclick` handlers, while the same file worked in a browser, in `check_open_design_artifact` and in exports.

A pilot behind `openDesign.experimental.servedPreview` loads the design from a loopback server instead (`<iframe src>`, its own origin). It fixed the tabs and was verified in a VS Code test host and in VS Code Insiders on WSL. But it only covers View mode. Comment and Edit read the page's DOM directly, which a cross-origin page doesn't allow, so they still switch back to the `srcdoc` copy. Export → Figma silently does nothing on the served page, and fluid posters lose their shape preview there.

## What Changes

- **A preview bridge:** a small script the served-preview server injects into the design it serves (marked preview-only, so it never reaches the saved file). It runs inside the page and talks to the preview over `postMessage`. It does what Comment and Edit do to the page today:
  - pick mode (every element hit-testable, pointer cursor);
  - hover and click capture;
  - element rectangles, kept current on scroll, resize and layout changes;
  - the selected element's details: selector, HTML hint, kind, content fields and computed styles;
  - comment pin positions;
  - applying an edit patch and returning the serialized source.
- **Comment and Edit run on the served page** through the bridge. The panels, pins, highlights and guides stay in the preview and look and behave as they do today.
- **Export → Figma** captures the served page through the bridge.
- **Embedded copy only where still needed:** Tweaks and fluid-poster shape previews keep using the `srcdoc` copy until they're bridged in a follow-up change.
- **Edit saves only what changed.** Today Save writes every Style field, prefilled from computed styles, so a single text edit also pins a dozen inline styles, including a black background where it was transparent. This was found while testing the bridge, and is fixed here because the Edit flow is being reworked anyway.
- **Bridge messages are untrusted.** The preview accepts them only from its own iframe. It writes a patched source only in reply to a patch request it made, matched by request id.
- **The setting stays experimental (off by default)** in this change. Turning it on by default, bridging Tweaks and shapes, and deleting the `srcdoc` workarounds is the follow-up.

## Capabilities

### New Capabilities
- `served-preview`: the loopback-served preview (pilot behaviour, now specified) and the bridge that lets Comment, Edit and Figma capture work on it.

### Modified Capabilities
<!-- None: Comment and Edit keep their existing requirements; only how the preview reaches the page changes. -->

## Impact

- `packages/vscode/src/webview/bridge/` (new): the in-page bridge, bundled as its own browser script, reusing `dom/elementTargeting.ts`, `dom/sourcePatches.ts`, the comment anchor lookup and core's `captureFigmaIr`.
- `packages/vscode/src/webview/main.ts`: Comment and Edit read element details and positions from bridge messages on the served page, and from `contentDocument` on the `srcdoc` copy.
- `packages/vscode/src/extension/customEditors/artifactEditorProvider.ts`: injects the bridge into the served entry.
- `packages/vscode/.esbuild.ts`: one more webview bundle.
- No new dependencies. Core is unchanged apart from what the pilot already added.
