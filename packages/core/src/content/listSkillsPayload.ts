// list_open_design_skills' result, shared by every host (openspec
// add-surface-picker): the free catalog listing, a surface's entries, or the
// surface catalog itself.
import type { ContentIndex, SkillSummary } from './contentIndex';

export interface ListSkillsInput {
  query?: string;
  mode?: string;
  source?: string;
  remixableOnly?: boolean;
  /** A surface id for its entries, or "list" for the surfaces themselves. */
  surface?: string;
}

/** Above this many matches the free listing drops each entry's long fields, so it fits in one tool result. */
export const LIST_SKILLS_FULL_LIMIT = 40;

function compactPayload(s: SkillSummary): Record<string, unknown> {
  return {
    id: s.id,
    name: s.name,
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
    exampleArtifactPath: s.exampleArtifactPath,
    ...(s.stub ? { stub: true } : {}),
  };
}

export async function listSkillsPayload(index: ContentIndex, input: ListSkillsInput): Promise<unknown> {
  const surface = input.surface?.trim();
  if (surface) {
    if (surface === 'list') {
      return {
        surfaces: (await index.listSurfaces()).map((s) => ({ id: s.id, label: s.label, description: s.description, entryCount: s.entryCount, prompt: s.prompt })),
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
  // The whole catalog is several hundred thousand characters, more than a host passes to the model in one result.
  return {
    total: skills.length,
    note: `${skills.length} matches, listed without descriptions, triggers or example prompts. Call again with a query, mode, source or surface (at most ${LIST_SKILLS_FULL_LIMIT} matches) for the full entries.`,
    entries: skills.map(compactPayload),
  };
}
