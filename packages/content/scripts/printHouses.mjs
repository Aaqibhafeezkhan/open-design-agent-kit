// The print-house guard (openspec add-print-house-images, "Print-House Build
// Guard"): every profile needs a source page and a check date, and sane format
// entries. Whether each format id exists and its size fits the bleed box is
// checked in packages/core (printHouses.ts and its shipped-catalog test),
// which owns the format catalog.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const TYPES = new Set(['png', 'jpeg', 'pdf']);
const BACKS = new Set(['per-card', 'shared', 'none']);

/** Problems with `<assetsRoot>/print-houses.json`, as human-readable strings (empty when fine or absent). */
export async function checkPrintHouses(assetsRoot) {
  let raw;
  try {
    raw = await fs.readFile(path.join(assetsRoot, 'print-houses.json'), 'utf8');
  } catch {
    return [];
  }
  let catalog;
  try {
    catalog = JSON.parse(raw);
  } catch (err) {
    return [`print-houses.json is not valid JSON: ${err.message}`];
  }
  return checkPrintHouseCatalog(catalog);
}

export function checkPrintHouseCatalog(catalog) {
  const problems = [];
  const ids = new Set();
  for (const p of Array.isArray(catalog?.printHouses) ? catalog.printHouses : []) {
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9-]+$/.test(p.id)) {
      problems.push('a print house has no kebab-case id');
      continue;
    }
    if (ids.has(p.id)) problems.push(`${p.id}: id used twice`);
    ids.add(p.id);
    if (typeof p.label !== 'string' || !p.label) problems.push(`${p.id}: needs a label`);
    for (const key of ['url', 'source']) if (typeof p[key] !== 'string' || !/^https:\/\//.test(p[key])) problems.push(`${p.id}: ${key} must be an https link`);
    if (typeof p.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.checkedAt)) problems.push(`${p.id}: checkedAt must be a YYYY-MM-DD date`);
    if (!BACKS.has(p.backs)) problems.push(`${p.id}: backs must be per-card, shared or none`);
    if (!Array.isArray(p.formats) || p.formats.length === 0) problems.push(`${p.id}: needs at least one format`);
    const seen = new Set();
    for (const f of Array.isArray(p.formats) ? p.formats : []) {
      if (!f || typeof f.format !== 'string') {
        problems.push(`${p.id}: a format entry has no format id`);
        continue;
      }
      if (seen.has(f.format)) problems.push(`${p.id}: ${f.format} listed twice`);
      seen.add(f.format);
      if (!TYPES.has(f.type)) problems.push(`${p.id} ${f.format}: type must be png, jpeg or pdf`);
      if (f.type !== 'pdf') {
        if (!Number.isInteger(f.width) || !Number.isInteger(f.height) || f.width < 16 || f.height < 16 || f.width > 8192 || f.height > 8192) problems.push(`${p.id} ${f.format}: width and height must be whole pixels from 16 to 8192`);
        if (!Number.isInteger(f.dpi) || f.dpi < 150 || f.dpi > 600) problems.push(`${p.id} ${f.format}: dpi must be from 150 to 600`);
      }
    }
  }
  return problems;
}
