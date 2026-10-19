/// <reference lib="dom" />
// Adapted (simplified — see openspec design notes) from open-design's
// apps/web/src/edit-mode/source-patches.ts. Curated patch set — extended
// closer to upstream's real ManualEditPatch union (set-link, set-image,
// set-outer-html alongside set-text/set-style/remove-element) after a
// direct read of apps/web/src/components/ManualEditPanel.tsx; still
// without upstream's set-token/set-attributes/set-full-source or its
// history-entry/undo-redo machinery — VS Code's own document undo already
// covers every applied patch here, since each one is written back through
// a real WorkspaceEdit.
import { AUTO_OD_ID_PREFIX } from './elementTargeting';

export interface CuratedStyles {
  color?: string;
  backgroundColor?: string;
  opacity?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: string;
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
}

export type ManualEditPatch =
  | { kind: 'set-text'; elementId: string; value: string }
  | { kind: 'set-link'; elementId: string; text: string; href: string }
  | { kind: 'set-image'; elementId: string; src: string; alt: string }
  | { kind: 'set-outer-html'; elementId: string; html: string }
  | { kind: 'set-style'; elementId: string; styles: CuratedStyles }
  | { kind: 'remove-element'; elementId: string };

export function applyPatch(doc: Document, patch: ManualEditPatch): boolean {
  const el = doc.querySelector(`[data-od-id="${patch.elementId}"]`) as HTMLElement | null;
  if (!el) return false;

  switch (patch.kind) {
    case 'set-text':
      el.textContent = patch.value;
      return true;
    case 'set-link':
      el.textContent = patch.text;
      el.setAttribute('href', patch.href);
      return true;
    case 'set-image':
      el.removeAttribute(PREVIEW_SRC_ATTR);
      el.setAttribute('src', patch.src);
      el.setAttribute('alt', patch.alt);
      return true;
    case 'set-outer-html':
      // Replaces the node outright — relies on `patch.html` still carrying
      // the element's own `data-od-id` (the edit panel pre-fills the raw
      // HTML from the element's own current outerHTML, which already has
      // it), so a later patch can still find it via the same selector.
      el.outerHTML = patch.html;
      return true;
    case 'set-style':
      for (const [prop, value] of Object.entries(patch.styles)) {
        if (value !== undefined) (el.style as any)[prop] = value;
      }
      return true;
    case 'remove-element':
      el.remove();
      return true;
    default:
      return false;
  }
}

/** Marks preview-only nodes (pick-mode overrides, the Shape switcher's style) that must never reach the saved source. */
export const PREVIEW_ONLY_ATTR = 'data-od-preview-only';
/** Same as content/exampleHtml.ts's PREVIEW_SRCDOC_ATTR (that module imports node:fs, so it can't be imported here). */
export const PREVIEW_SRCDOC_ATTR = 'data-od-preview-srcdoc';
/** Same as content/exampleHtml.ts's PREVIEW_SRC_ATTR: an image's original src, swapped for a data: URI in the preview. */
export const PREVIEW_SRC_ATTR = 'data-od-preview-src';

export function serializeDocument(doc: Document): string {
  const doctype = doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : '<!doctype html>\n';
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`[${PREVIEW_ONLY_ATTR}]`).forEach((el) => el.remove());
  // Ids the bridge invented so Edit patches could find their targets (ensureDataOdId).
  clone.querySelectorAll(`[data-od-id^="${AUTO_OD_ID_PREFIX}"]`).forEach((el) => el.removeAttribute('data-od-id'));
  // Frames the preview filled from their local src (see inlineLocalFrames).
  clone.querySelectorAll(`[${PREVIEW_SRCDOC_ATTR}]`).forEach((el) => {
    el.removeAttribute('srcdoc');
    el.removeAttribute(PREVIEW_SRCDOC_ATTR);
  });
  // Images the preview inlined from their local src (see inlineLocalImages).
  clone.querySelectorAll(`[${PREVIEW_SRC_ATTR}]`).forEach((el) => {
    el.setAttribute('src', el.getAttribute(PREVIEW_SRC_ATTR)!);
    el.removeAttribute(PREVIEW_SRC_ATTR);
  });
  return doctype + clone.outerHTML;
}
