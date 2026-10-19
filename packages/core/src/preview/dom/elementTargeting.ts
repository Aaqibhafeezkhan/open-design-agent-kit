/// <reference lib="dom" />
// Adapted (not ported verbatim — see openspec design notes) from
// open-design's apps/web/src/edit-mode/bridge.ts: how the preview bridge
// identifies an element for comments and Edit patches. Runs inside the
// previewed page (bridge.ts).

export function findElementByDataOdId(doc: Document, id: string): Element | null {
  return doc.querySelector(`[data-od-id="${cssEscape(id)}"]`);
}

/** Prefix of the ids ensureDataOdId invents; they exist only in the live page, never in the source. */
export const AUTO_OD_ID_PREFIX = 'auto-';

/** The element's `data-od-id` when it came from the source (not one ensureDataOdId invented). */
export function sourceDataOdId(el: Element): string | undefined {
  const id = el.getAttribute('data-od-id');
  return id && !id.startsWith(AUTO_OD_ID_PREFIX) ? id : undefined;
}

export function ensureDataOdId(el: Element): string {
  let id = el.getAttribute('data-od-id');
  if (!id) {
    id = `${AUTO_OD_ID_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
    el.setAttribute('data-od-id', id);
  }
  return id;
}

export function cssSelectorFor(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeName.toLowerCase() !== 'html') {
    let selector = node.nodeName.toLowerCase();
    if (node.id) {
      parts.unshift(`${selector}#${node.id}`);
      break;
    }
    const parent: Element | null = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.nodeName === node!.nodeName);
      const idx = siblings.indexOf(node) + 1;
      selector += `:nth-of-type(${idx})`;
    }
    parts.unshift(selector);
    node = parent;
  }
  return parts.join(' > ');
}

// ── Robust selector (openspec add-browser-preview, element-comments) ──────
// What a comment stores so an agent can find the element in the source:
// the first candidate that matches exactly this element. Ids and attributes
// an author (or the agent) wrote come first, then meaningful classes, and the
// positional chain only when nothing else is unique.

const STABLE_ATTRS = ['data-od-id', 'data-testid', 'data-od-node', 'data-od-slide', 'name', 'aria-label'] as const;

// Utility-framework classes (Tailwind and similar) say how an element looks,
// not what it is, and change with every restyle.
const UTILITY_PREFIX =
  /^-?(p[xytrbl]?|m[xytrbl]?|w|h|size|min-w|min-h|max-w|max-h|gap|space-[xy]|text|bg|from|to|via|flex|grid|col|row|items|justify|self|place|content|rounded|font|leading|tracking|border|divide|outline|ring|shadow|opacity|z|top|left|right|bottom|inset|order|basis|grow|shrink|overflow|cursor|transition|duration|ease|delay|animate|translate|scale|rotate|skew|origin|fill|stroke|object|aspect|line-clamp|decoration|underline-offset|blur|backdrop|drop-shadow)(-|$)/;
const UTILITY_WORDS = new Set([
  'flex', 'grid', 'block', 'inline', 'inline-block', 'inline-flex', 'hidden', 'contents', 'relative', 'absolute', 'fixed', 'sticky', 'static',
  'container', 'italic', 'uppercase', 'lowercase', 'capitalize', 'underline', 'truncate', 'grow', 'shrink', 'sr-only', 'antialiased',
  'active', 'selected', 'open', 'show', 'visible', 'hover', 'focus', 'disabled', 'is-active', 'is-open',
]);

export function isUtilityClass(name: string): boolean {
  return /[:[\]/!.%#@]/.test(name) || UTILITY_PREFIX.test(name) || UTILITY_WORDS.has(name) || /^\d/.test(name);
}

function isStableId(id: string): boolean {
  return /^[a-z][\w-]{0,63}$/i.test(id) && !/\d{4,}/.test(id) && !id.startsWith(AUTO_OD_ID_PREFIX) && !/^(radix|headlessui|react|ember|mui|chakra)[-:]/i.test(id);
}

function matchesOnly(doc: Document, selector: string, el: Element): boolean {
  try {
    const found = doc.querySelectorAll(selector);
    return found.length === 1 && found[0] === el;
  } catch {
    return false;
  }
}

function attrSelector(name: string, value: string): string {
  return `[${name}="${value.replace(/["\\]/g, '\\$&')}"]`;
}

/** A selector for `el` from its own id or stable attribute, when that alone is unique. */
function ownAnchor(doc: Document, el: Element): string | undefined {
  const tag = el.nodeName.toLowerCase();
  if (el.id && isStableId(el.id)) {
    const sel = `${tag}#${cssEscape(el.id)}`;
    if (matchesOnly(doc, sel, el)) return sel;
  }
  for (const name of STABLE_ATTRS) {
    const value = el.getAttribute(name);
    if (!value || value.length > 80) continue;
    if (name === 'data-od-id' && value.startsWith(AUTO_OD_ID_PREFIX)) continue;
    const sel = `${tag}${attrSelector(name, value)}`;
    if (matchesOnly(doc, sel, el)) return sel;
  }
  return undefined;
}

function classSelector(el: Element): string | undefined {
  const classes = Array.from(el.classList).filter((c) => !isUtilityClass(c)).slice(0, 3);
  return classes.length ? `${el.nodeName.toLowerCase()}${classes.map((c) => `.${cssEscape(c)}`).join('')}` : undefined;
}

function nthOfType(node: Element): string {
  const tag = node.nodeName.toLowerCase();
  const parent = node.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter((c) => c.nodeName === node.nodeName);
  return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(node) + 1})` : tag;
}

/**
 * The selector a comment stores: own id or stable attribute; else tag plus
 * non-utility classes, alone or under the nearest anchored ancestor; else the
 * positional chain from that ancestor (or from the root). Always verified to
 * match only `el`.
 */
export function selectorFor(el: Element): string {
  const doc = el.ownerDocument;
  const own = ownAnchor(doc, el);
  if (own) return own;

  let ancestor: Element | null = el.parentElement;
  let ancestorAnchor: string | undefined;
  while (ancestor && ancestor.nodeName.toLowerCase() !== 'html') {
    ancestorAnchor = ownAnchor(doc, ancestor);
    if (ancestorAnchor) break;
    ancestor = ancestor.parentElement;
  }
  if (!ancestorAnchor) ancestor = null;

  const cls = classSelector(el);
  if (cls) {
    if (matchesOnly(doc, cls, el)) return cls;
    if (ancestorAnchor && matchesOnly(doc, `${ancestorAnchor} ${cls}`, el)) return `${ancestorAnchor} ${cls}`;
  }

  // Positional chain up to the anchored ancestor (or the root).
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== ancestor && node.nodeName.toLowerCase() !== 'html') {
    parts.unshift(nthOfType(node));
    node = node.parentElement;
  }
  const chain = (ancestorAnchor ? `${ancestorAnchor} > ` : '') + parts.join(' > ');
  return matchesOnly(doc, chain, el) ? chain : cssSelectorFor(el);
}

export function findElementBySelector(doc: Document, selector: string): Element | null {
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

export function htmlHintFor(el: Element): string {
  const clone = el.cloneNode(false) as Element;
  const opening = clone.outerHTML.split('>')[0] + '>';
  return opening.length > 200 ? `${opening.slice(0, 200)}…` : opening;
}
