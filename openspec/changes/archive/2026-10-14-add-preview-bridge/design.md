## Context

The artifact preview (`packages/vscode/src/webview/main.ts`, about 1,000 lines) has two modes that work on the page itself:
- **Comment:** hover highlight, click to anchor a note, pins positioned on their elements.
- **Edit:** hover highlight, click to open a panel prefilled from the element's content and computed styles, then save. A patch is applied to the page's DOM, the DOM is serialized, and the result is written back to the file.

Both reach into the page through `iframe.contentDocument`, which works only because the page is a same-origin `srcdoc` document. The served-preview pilot loads the page from `http://127.0.0.1:<port>/<token>/…`, a different origin, where `contentDocument` is `null`. Upstream open-design's own app has the same constraint and solves it with an injected selection bridge (`apps/web/src/runtime/srcdoc.ts`).

The DOM helpers Comment and Edit use are already page-agnostic:
- `dom/elementTargeting.ts`: `ensureDataOdId`, `cssSelectorFor`, `htmlHintFor`, lookups;
- `dom/sourcePatches.ts`: `applyPatch`, `serializeDocument`, which strips `data-od-preview-only`;
- `dom/commentOverlay.ts`: anchor resolution;
- core's `captureFigmaIr`.

## Goals / Non-Goals

**Goals:**
- Comment, Edit and Export → Figma work on the served page, unchanged for the user.
- One code path in the preview for those features, whichever way the page is loaded.
- Bridge messages can't be used to write anything the user didn't ask for.

**Non-Goals:**
- Tweaks and fluid-poster shape previews over the bridge (follow-up).
- Turning the served preview on by default, or deleting the `srcdoc` workarounds (follow-up, once the above lands).
- Changing what Comment or Edit can do.

## Decisions

### 1. The bridge runs in every preview, served or not

The same bridge script is injected into the served entry and into the `srcdoc` copy. On the `srcdoc` copy it gets the panel nonce like any other script. Comment, Edit and Figma capture in `main.ts` talk only to the bridge, so `main.ts` no longer touches `contentDocument` for them. Tweaks and the shape override keep their direct access, and they only run on the `srcdoc` copy (Decision 6).

Alternative considered: an adapter with a direct implementation for `srcdoc` and a bridge one for served pages. That was rejected because it means two implementations to keep in step, and the direct one goes away anyway when `srcdoc` does.

### 2. Delivery

The bridge is its own esbuild browser bundle (`dist/webview/bridge.js`, an IIFE with no imports at runtime). The extension reads it once and injects it as an inline `<script data-od-preview-only>`, first in `<head>` after the error reporter:
- into the served entry, through the static server's `transformEntry`, which already serves the editor buffer;
- into the `srcdoc` HTML, in `previewHtml()`.

`serializeDocument` already drops `data-od-preview-only` elements, so the bridge and its pick-mode style never reach the saved file.

### 3. Protocol

Every message carries `od: 'bridge'`.

**Preview → page:**
- `set-mode {mode}`: `view`, `comment` or `edit`. In `comment`/`edit` the bridge adds the pick-mode style (every element hit-testable, pointer cursor) and captures hover and click. Clicks in those modes are `preventDefault`ed, as today.
- `clear-selection`.
- `set-comments {comments}`: anchors for pins (id, `elementId`, selector).
- `apply-patch {requestId, patch}`: a `ManualEditPatch`.
- `capture-figma {requestId}`.

**Page → preview:**
- `ready {title}`.
- `hover {rect | null}`.
- `select {element}`. `element` is a plain snapshot: `elementId` (ensured with `data-od-id`), `selector`, `htmlHint`, `tag`, `childCount`, `text`, `outerHTML`, `attrs {src, alt, href}` (`src` prefers `data-od-preview-src`), `rect`, and `styles` (the computed values the Edit panel shows).
- `rects {hover, selection, pins: [{commentId, rect | null}]}`, sent on scroll, resize and layout changes, at most once per animation frame, and only while the mode isn't `view` or pins are shown.
- `patched {requestId, ok, newSource?}`.
- `figma-capture {requestId, capture, truncated}`.
- `open-local-link {href}`: a click in `view` mode on a relative link to a neighbouring file. On the `srcdoc` copy, `#hash` links are also scrolled by the bridge, as today; on the served page the browser handles them.

Rects are in the page's viewport coordinates, and the preview adds the iframe's own offset, as it does today. The preview keeps no references to page elements, only `elementId`s and snapshots.

### 4. Trust

The page runs model-generated code, so bridge messages are treated as data:
- The preview accepts a message only when `event.source === iframe.contentWindow`. That already applies to the error reporter.
- A `patched` or `figma-capture` reply is acted on only when its `requestId` matches a request the preview sent and hasn't settled. Each id is single-use.
- The preview sends a page's `newSource` to the extension only after a Save, Remove or other user action that issued the request. A page can't rewrite its own file by posting a `patched` message unprompted.
- Strings from the page are escaped before going into panel HTML, as `escapeHtml` already does today.

### 5. What gets saved is unchanged

`applyPatch` + `serializeDocument` run in the page exactly as they ran on `contentDocument` before, so the saved source matches today's: the live DOM minus preview-only nodes. One known, pre-existing caveat: changes the page's own scripts make to the DOM, such as a tab switch's `active` class, are serialized too. Whether to patch the source text instead of the live DOM is out of scope here and noted for later.

### 6. When the preview still uses the `srcdoc` copy

With the setting on, the served page is used unless:
- Tweaks is open, or
- the design is a fluid poster (`shapeInfo.fluid`), whose fit and shape override are applied inside the page.

Both are covered by the follow-up. Comment and Edit no longer force the `srcdoc` copy.

## Risks / Trade-offs

- **Timing.** Hover and highlight now round-trip through `postMessage`. That's same-process and sub-millisecond, but scroll-driven updates are throttled to one per animation frame to stay smooth.
- **Pages that break the bridge.** A page that overrides `postMessage`, stops event propagation in capture phase, or throws early could interfere. The bridge listens in capture phase on `window` and installs before the page's own scripts, as the error reporter does. If the bridge never says `ready`, the preview shows Comment and Edit as unavailable for this page instead of failing silently.
- **Bigger `main.ts` change.** Comment and Edit move from element references to snapshots. Mitigation: the snapshot carries exactly the fields the panels already read, and the bridge has unit tests for snapshotting, patch round-trips and request matching.

## Migration Plan

The behaviour stays behind `openDesign.experimental.servedPreview` (off by default). The `srcdoc` path gets the bridge as well, so with the setting off Comment and Edit run through the bridge too. That's the main regression surface, covered by the existing Comment/Edit manual checks and the new bridge tests.
