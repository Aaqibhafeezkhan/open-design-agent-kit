// list_open_design_skills' result, shared by every host (openspec
// add-surface-picker): the free catalog listing, a surface's entries, or the
// surface catalog itself, or the surfaces a goal leads to.
import type { ContentIndex, SkillSummary } from './contentIndex';

export interface ListSkillsInput {
  query?: string;
  mode?: string;
  source?: string;
  remixableOnly?: boolean;
  /** A surface id for its entries, or "list" for the surfaces (and goals) themselves. */
  surface?: string;
  /** A goal id for the surfaces it leads to (openspec desktop-first-run-welcome). */
  goal?: string;
  /** Where a compact listing's page starts (its nextOffset). */
  offset?: number;
}

/** Above this many matches the free listing drops each entry's long fields, so it fits in one tool result. */
export const LIST_SKILLS_FULL_LIMIT = 40;
/** Entries per page of the compact listing. The whole compact catalog (about 500 entries) is still more than Claude reads in one result. */
export const LIST_SKILLS_PAGE_SIZE = 100;
const SUMMARY_LENGTH = 90;

function summarize(description: string | undefined): string | undefined {
  const text = description?.replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  if (text.length <= SUMMARY_LENGTH) return text;
  const cut = text.slice(0, SUMMARY_LENGTH);
  const space = cut.lastIndexOf(' ');
  return `${(space > SUMMARY_LENGTH / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.—-]+$/, '')}…`;
}

function compactPayload(s: SkillSummary): Record<string, unknown> {
  const summary = summarize(s.description);
  return {
    id: s.id,
    name: s.name,
    ...(summary && summary !== s.name ? { summary } : {}),
    mode: s.mode,
    source: s.source,
    ...(s.category ? { category: s.category } : {}),
    ...(s.exampleArtifactPath ? { remixable: true } : {}),
    ...(s.stub ? { stub: true } : {}),
  };
}

function entryPayload(s: SkillSummary): Record<string, unknown> {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    triggers: s.triggers,
    category: s.category,
    mode: s.mode,
    source: s.source,
    examplePrompt: s.examplePrompt,
    // Not the bundled file's path: agents went looking for it on disk.
    ...(s.exampleArtifactPath ? { remixable: true } : {}),
    ...(s.stub ? { stub: true } : {}),
  };
}

export async function listSkillsPayload(index: ContentIndex, input: ListSkillsInput): Promise<unknown> {
  const goal = input.goal?.trim();
  if (goal && !input.surface?.trim()) {
    const found = await index.getGoal(goal);
    if (!found) {
      const valid = (await index.listGoals()).map((g) => g.id);
      return { error: `Unknown goal "${goal}". Valid goals: ${valid.join(', ')}.` };
    }
    const surfaces = new Map((await index.listSurfaces()).map((s) => [s.id, s]));
    return {
      goal: { id: found.id, label: found.label, description: found.description },
      surfaces: found.surfaces.map((id, i) => {
        const s = surfaces.get(id)!;
        return { id: s.id, label: s.label, description: s.description, entryCount: s.entryCount, prompt: s.prompt, ...(i === 0 ? { default: true } : {}) };
      }),
    };
  }
  const surface = input.surface?.trim();
  if (surface) {
    if (surface === 'list') {
      return {
        surfaces: (await index.listSurfaces()).map((s) => ({ id: s.id, label: s.label, description: s.description, entryCount: s.entryCount, prompt: s.prompt })),
        goals: (await index.listGoals()).map((g) => ({ id: g.id, label: g.label, description: g.description, surfaces: g.surfaces })),
      };
    }
    const found = await index.getSurface(surface);
    const entries = found ? await index.surfaceEntries(surface) : undefined;
    if (!found || !entries) {
      const valid = (await index.listSurfaces()).map((s) => s.id);
      return { error: `Unknown surface "${surface}". Valid surfaces: ${valid.join(', ')}, or "list".` };
    }
    return {
      surface: { id: found.id, label: found.label, description: found.description, prompt: found.prompt, questions: found.questions },
      entries: entries.map(entryPayload),
    };
  }
  const skills = await index.listSkills(input.query, input.mode, input.source, input.remixableOnly);
  if (skills.length <= LIST_SKILLS_FULL_LIMIT) return skills.map(entryPayload);
  // The whole catalog is several hundred thousand characters, more than a host passes to the model in one result,
  // and even without descriptions it is about 25K tokens, Claude's limit for one result. So it comes in pages.
  const offset = Math.min(Math.max(0, Math.floor(Number(input.offset) || 0)), skills.length);
  const page = skills.slice(offset, offset + LIST_SKILLS_PAGE_SIZE);
  const nextOffset = offset + page.length < skills.length ? offset + page.length : undefined;
  const modes: Record<string, number> = {};
  for (const s of skills) modes[s.mode] = (modes[s.mode] ?? 0) + 1;
  return {
    total: skills.length,
    offset,
    ...(nextOffset !== undefined ? { nextOffset } : {}),
    modes,
    note:
      `${skills.length} matches; entries ${offset + 1}–${offset + page.length}, each with a one-line summary instead of its description, triggers and example prompt.` +
      ` Narrow with a query, mode, source or surface (at most ${LIST_SKILLS_FULL_LIMIT} matches) for the full entries` +
      (nextOffset !== undefined ? `, or call again with offset ${nextOffset} for the next page.` : '.'),
    entries: page.map(compactPayload),
  };
}
