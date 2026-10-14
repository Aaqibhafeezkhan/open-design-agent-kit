// Guard against shipping an extraction scaffold (openspec
// add-mobile-design-systems): the typeui and iOS extractors mark every
// unconfirmed value with a TODO comment and the file header with
// "SCAFFOLD, NOT FINAL", and none of those may reach local/design-systems/.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const SCAFFOLD_MARKERS = ['TODO', 'SCAFFOLD, NOT FINAL'];

/** Local design systems whose tokens.css still carries a scaffold marker, as `<id>` strings. */
export async function findUnreviewedScaffolds(localRoot) {
  const dsRoot = path.join(localRoot, 'design-systems');
  let ids;
  try {
    ids = (await fs.readdir(dsRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  const found = [];
  for (const id of ids.sort()) {
    let css;
    try {
      css = await fs.readFile(path.join(dsRoot, id, 'tokens.css'), 'utf8');
    } catch {
      continue;
    }
    if (SCAFFOLD_MARKERS.some((m) => css.includes(m))) found.push(id);
  }
  return found;
}
