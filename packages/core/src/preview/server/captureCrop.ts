// A comment's cropped screenshot (openspec add-browser-preview, D5): the
// element plus some context, from the preview window the user sees when this
// process drives it, else re-rendered headless at the comment's viewport.
import type { Page } from 'puppeteer-core';
import { findBrowser } from '../../export/browserDiscovery';
import { openArtifactPage } from '../../export/artifactPage';
import { loadPage } from '../../export/exportArtifact';

export const CROP_CONTEXT_PX = 24;
export const MAX_CROP_EDGE = 800;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The element's box grown by CROP_CONTEXT_PX, clamped to `bounds`, scaled so the long edge is at most MAX_CROP_EDGE. */
export function cropClip(element: Box, bounds: Box): (Box & { scale: number }) | undefined {
  const left = Math.max(bounds.x, element.x - CROP_CONTEXT_PX);
  const top = Math.max(bounds.y, element.y - CROP_CONTEXT_PX);
  const right = Math.min(bounds.x + bounds.width, element.x + element.width + CROP_CONTEXT_PX);
  const bottom = Math.min(bounds.y + bounds.height, element.y + element.height + CROP_CONTEXT_PX);
  const width = Math.floor(right - left);
  const height = Math.floor(bottom - top);
  if (width < 1 || height < 1) return undefined;
  const scale = Math.min(1, MAX_CROP_EDGE / Math.max(width, height));
  return { x: Math.floor(left), y: Math.floor(top), width, height, scale };
}

/**
 * From the window the user sees: `element` and `stage` (the design iframe's
 * box) are in the shell page's viewport, which doesn't scroll, so they are
 * also its document coordinates.
 */
export async function captureWindowCrop(page: Page, element: Box, stage: Box): Promise<Buffer | undefined> {
  const clip = cropClip(element, stage);
  if (!clip) return undefined;
  return Buffer.from(await page.screenshot({ type: 'png', clip, captureBeyondViewport: false }));
}

/** Re-rendered headless at `viewport`, cropping the element's document box. Undefined without a browser. */
export async function captureRerenderedCrop(options: {
  workspaceRoot: string;
  entryPath: string;
  docRect: Box;
  viewport: { width: number; height: number };
  browserPath?: string;
}): Promise<Buffer | undefined> {
  const found = await findBrowser({ explicitPath: options.browserPath });
  if (!found.ok) return undefined;
  const session = await openArtifactPage({ workspaceRoot: options.workspaceRoot, relEntry: options.entryPath, executablePath: found.executablePath });
  try {
    const width = Math.max(320, Math.min(3840, Math.round(options.viewport.width)));
    const height = Math.max(320, Math.min(2160, Math.round(options.viewport.height)));
    await session.page.setViewport({ width, height });
    await loadPage(session.page, session.url, 15000, 300, []);
    const docHeight = Number(await session.page.evaluate('document.documentElement.scrollHeight')) || height;
    const clip = cropClip(options.docRect, { x: 0, y: 0, width, height: Math.max(height, docHeight) });
    if (!clip) return undefined;
    return Buffer.from(await session.page.screenshot({ type: 'png', clip, captureBeyondViewport: true }));
  } finally {
    await session.close();
  }
}
