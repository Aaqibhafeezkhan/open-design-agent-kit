import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * The public gallery's address and switch (openspec link-public-gallery):
 * `<assetsRoot>/gallery-site.json`, copied from packages/content/local/. The
 * shape check mirrors packages/content/scripts/gallerySite.mjs.
 */
export interface GallerySite {
  url: string;
  live: boolean;
}

export const GALLERY_SITE_FILE = 'gallery-site.json';

/** The gallery's settings, or undefined when the file is absent or invalid (no links then). */
export async function loadGallerySite(assetsRoot: string): Promise<GallerySite | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(assetsRoot, GALLERY_SITE_FILE), 'utf8')) as Partial<GallerySite>;
    if (typeof raw.url !== 'string' || !/^https:\/\/[^/]+\/(.*\/)?$/.test(raw.url) || typeof raw.live !== 'boolean') return undefined;
    return { url: raw.url, live: raw.live };
  } catch {
    return undefined;
  }
}

/** A hub's URL, filtered by a free-text query through the hub's #q= hash. */
export function galleryHubUrl(site: GallerySite, hub: 'examples' | 'design-systems', query?: string): string {
  const q = query?.trim();
  return `${site.url}${hub}/${q ? `#q=${encodeURIComponent(q)}` : ''}`;
}

/** Only bundled design systems have a gallery page; the live site builds every one of them. */
export function hasGalleryPage(designSystem: { source: string }): boolean {
  return designSystem.source === 'built-in';
}

export function galleryDesignSystemUrl(site: GallerySite, id: string): string {
  return `${site.url}design-systems/${encodeURIComponent(id)}/`;
}
