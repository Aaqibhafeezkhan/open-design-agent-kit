/// <reference lib="dom" />
// Anchor lookup for comment pins. Anchor resolution here is a deliberately
// simplified version of open-design's apps/web/src/comments.ts drift ladder
// (exact elementId match, else a CSS selector match, else a text-excerpt
// match among elements of the same tag, else "lost") rather than upstream's
// fuzzy htmlHint/text similarity matching — see openspec design notes.
import type { ArtifactComment } from '../../workspace/artifactCommentTypes';
import { findElementByDataOdId, findElementBySelector } from './elementTargeting';

export type { ArtifactComment };

/** The fields anchor resolution needs. */
export type CommentAnchor = Pick<ArtifactComment, 'elementId' | 'selector'> & Partial<Pick<ArtifactComment, 'text' | 'htmlHint'>>;

function tagOfHint(htmlHint: string | undefined): string | undefined {
  return /^<([a-z][a-z0-9-]*)/i.exec(htmlHint ?? '')?.[1]?.toLowerCase();
}

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

export function resolveCommentAnchor(doc: Document, comment: CommentAnchor): Element | null {
  if (comment.elementId) {
    const byId = findElementByDataOdId(doc, comment.elementId);
    if (byId) return byId;
  }
  if (comment.selector) {
    const bySelector = findElementBySelector(doc, comment.selector);
    if (bySelector) return bySelector;
  }
  // The selector drifted (an edit moved the element): find the one element
  // of the same tag whose text still starts with the stored excerpt.
  const tag = tagOfHint(comment.htmlHint);
  const excerpt = collapse(comment.text).replace(/…$/, '');
  if (tag && excerpt.length >= 3) {
    const matches = Array.from(doc.getElementsByTagName(tag)).filter((el) => collapse(el.textContent).startsWith(excerpt));
    if (matches.length === 1) return matches[0];
  }
  return null;
}
