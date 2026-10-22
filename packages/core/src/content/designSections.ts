// Applies a bundled design system's DESIGN.sections.md overlay to its
// vendored DESIGN.md (openspec reconcile-design-system-sources). The overlay
// is whole `## ` sections generated from tokens.css; each replaces the
// vendored section with the same heading text, ignoring the leading number
// ("## Color" replaces "## 2. Color"). Every other section stays verbatim.
// Mirrors applyDesignSections() in packages/content/scripts/designSystemConsistency.mjs,
// which validates the overlay when it's applied; keep the two in step.

export const DESIGN_SECTIONS_FILE = 'DESIGN.sections.md';

interface Section {
  heading: string;
  title: string;
  lines: string[];
}

/** `## 2. Color` → `color`. */
function sectionTitle(headingLine: string): string {
  return headingLine.replace(/^##\s+/, '').replace(/^\d+[.)]\s*/, '').trim().toLowerCase();
}

function splitSections(markdown: string): { preamble: string[]; sections: Section[] } {
  const preamble: string[] = [];
  const sections: Section[] = [];
  let current: Section | undefined;
  let fence = false;
  for (const line of markdown.split('\n')) {
    if (/^(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^## /.test(line)) {
      current = { heading: line, title: sectionTitle(line), lines: [] };
      sections.push(current);
    } else if (current) current.lines.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

/** The vendored DESIGN.md with the overlay's sections swapped in. Throws on a heading the vendored file lacks. */
export function applyDesignSections(designMd: string, sectionsMd: string, label = 'design system'): string {
  const base = splitSections(designMd);
  const overlay = splitSections(sectionsMd.replace(/^\s*<!--[\s\S]*?-->\s*\n?/, ''));
  for (const section of overlay.sections) {
    const target = base.sections.find((s) => s.title === section.title);
    if (!target) throw new Error(`${label}: ${DESIGN_SECTIONS_FILE} names a section DESIGN.md doesn't have: "${section.heading.replace(/^##\s+/, '')}"`);
    const body = [...section.lines];
    while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
    const hadTrailingBlank = target.lines.length > 0 && target.lines[target.lines.length - 1].trim() === '';
    target.lines = hadTrailingBlank ? [...body, ''] : body;
  }
  return [...base.preamble, ...base.sections.flatMap((s) => [s.heading, ...s.lines])].join('\n');
}
