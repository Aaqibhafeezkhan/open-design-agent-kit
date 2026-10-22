// The design-system descriptor guard (openspec add-design-system-matching,
// "Design System Profile Index"): every bundled design system needs a row in
// design-system-descriptors.json, every row must name a real system, and
// every value must come from the file's own vocabulary.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LIST_FIELDS = { moods: 'moods', industries: 'industries', surfaces: 'surfaces' };

/** Problems with `<assetsRoot>/design-system-descriptors.json`, as human-readable strings (empty when fine). */
export async function checkDescriptors(assetsRoot) {
  const file = path.join(assetsRoot, 'design-system-descriptors.json');
  let doc;
  try {
    doc = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    return [err.code === 'ENOENT' ? 'design-system-descriptors.json is missing' : `design-system-descriptors.json is not valid JSON: ${err.message}`];
  }
  const vocab = doc.vocabulary ?? {};
  const rows = doc.systems ?? {};
  const problems = [];
  const dsRoot = path.join(assetsRoot, 'design-systems');
  const bundled = (await fs.readdir(dsRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  for (const id of bundled) if (!rows[id]) problems.push(`${id}: no descriptor row`);
  const bundledSet = new Set(bundled);
  for (const [id, row] of Object.entries(rows)) {
    if (!bundledSet.has(id)) problems.push(`${id}: descriptor for a design system that doesn't exist`);
    if (!(vocab.kinds ?? []).includes(row.kind)) problems.push(`${id}: kind "${row.kind}" is not in vocabulary.kinds`);
    for (const [field, vocabKey] of Object.entries(LIST_FIELDS)) {
      const values = row[field];
      if (!Array.isArray(values) || values.length === 0) {
        problems.push(`${id}: ${field} must be a non-empty list`);
        continue;
      }
      for (const v of values) if (!(vocab[vocabKey] ?? []).includes(v)) problems.push(`${id}: ${field} value "${v}" is not in vocabulary.${vocabKey}`);
    }
  }
  return problems;
}
