// Provenance guard for content ported into local/ from other projects
// (openspec add-dev-doc-templates, "Ported Document Templates"): every port
// listed in local/ports.json must exist, carry a "Ported from" header naming
// its commit, and appear in docs/contributing/upstream-ports.md. A port with
// `"kind": "craft"` is a craft doc (local/craft/<id>.md) instead of a skill.
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function read(p) {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return undefined;
  }
}

/** Problems with the ports record, as human-readable strings (empty when fine or absent). */
export async function checkPorts(localRoot, portsDocPath) {
  const raw = await read(path.join(localRoot, 'ports.json'));
  if (raw === undefined) return [];
  let record;
  try {
    record = JSON.parse(raw);
  } catch (err) {
    return [`ports.json is not valid JSON: ${err.message}`];
  }
  const doc = (await read(portsDocPath)) ?? '';
  const problems = [];
  for (const port of Array.isArray(record.ports) ? record.ports : []) {
    const short = String(port.commit ?? '').slice(0, 12);
    if (!port.id || !short || !port.license) {
      problems.push(`${port.id ?? '(no id)'}: needs id, commit and license`);
      continue;
    }
    const rel = port.kind === 'craft' ? path.join('craft', `${port.id}.md`) : path.join('skills', port.id, 'SKILL.md');
    const file = path.basename(rel);
    const skill = await read(path.join(localRoot, rel));
    if (skill === undefined) problems.push(`${port.id}: local/${rel} is missing`);
    else if (!skill.includes('<!-- Ported from') || !skill.includes(short)) problems.push(`${port.id}: ${file} lacks a "Ported from … ${short}" provenance header`);
    for (const example of Array.isArray(port.examples) ? port.examples : []) {
      const md = await read(path.join(localRoot, 'examples', example, 'SKILL.md'));
      if (md === undefined) problems.push(`${port.id}: example ${example} is missing`);
      else if (!md.includes('<!-- Ported from') || !md.includes(short)) problems.push(`${port.id}: example ${example} lacks a provenance header`);
    }
    if (!doc.includes(`\`${port.id}\``)) problems.push(`${port.id}: not listed in docs/contributing/upstream-ports.md`);
  }
  return problems;
}
