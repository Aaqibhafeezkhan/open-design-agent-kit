// The public gallery's address and switch (openspec link-public-gallery,
// "Gallery Address and Switch"): an https url ending in "/" and a boolean
// live. Mirrored by packages/core's gallerySite.ts (keep the two in step).
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Problems with `<assetsRoot>/gallery-site.json`, as human-readable strings (empty when fine or absent). */
export async function checkGallerySite(assetsRoot) {
  let raw;
  try {
    raw = await fs.readFile(path.join(assetsRoot, 'gallery-site.json'), 'utf8');
  } catch {
    return [];
  }
  let site;
  try {
    site = JSON.parse(raw);
  } catch (err) {
    return [`gallery-site.json is not valid JSON: ${err.message}`];
  }
  return checkGallerySiteConfig(site);
}

export function checkGallerySiteConfig(site) {
  const problems = [];
  if (typeof site?.url !== 'string' || !/^https:\/\/[^/]+\/(.*\/)?$/.test(site.url)) problems.push('url must be an https link ending in "/"');
  if (typeof site?.live !== 'boolean') problems.push('live must be true or false');
  return problems;
}
