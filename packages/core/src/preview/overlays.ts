/// <reference lib="dom" />
// Hover and selection highlights drawn by a preview shell over its design
// iframe, from the rects the bridge reports in the page's viewport. Shared by
// the VS Code Artifact Preview and the browser preview.
import type { BridgeRect } from './protocol';

export interface HostRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A bridge rect (page viewport) in the shell document's coordinates: the iframe's own rect plus the element's rect within it. */
export function hostRectOf(iframe: HTMLIFrameElement, r: BridgeRect): HostRect {
  const iframeRect = iframe.getBoundingClientRect();
  return { left: iframeRect.left + r.left, top: iframeRect.top + r.top, width: r.width, height: r.height };
}

export function highlightBox(rect: HostRect, className: string): HTMLDivElement {
  const box = document.createElement('div');
  box.className = className;
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
  return box;
}

// Figma-style alignment guides: dashed lines extending from the selected
// element's four edges across the full canvas, so you can see how it lines
// up against the rest of the layout at a glance — a simplified version of
// upstream's edit-mode guide layer (which also draws live gap/measurement
// labels between hover and selection; not ported, this is the "grid"
// reference part only).
export function selectionGuides(iframe: HTMLIFrameElement, rect: HostRect): HTMLDivElement[] {
  const stage = iframe.getBoundingClientRect();
  const h = (top: number): HTMLDivElement => {
    const line = document.createElement('div');
    line.className = 'od-guide-line od-guide-h';
    line.style.left = `${stage.left}px`;
    line.style.top = `${top}px`;
    line.style.width = `${stage.width}px`;
    return line;
  };
  const v = (left: number): HTMLDivElement => {
    const line = document.createElement('div');
    line.className = 'od-guide-line od-guide-v';
    line.style.top = `${stage.top}px`;
    line.style.left = `${left}px`;
    line.style.height = `${stage.height}px`;
    return line;
  };
  return [h(rect.top), h(rect.top + rect.height), v(rect.left), v(rect.left + rect.width)];
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
