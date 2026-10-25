// What was asked and what was assumed before a build (openspec add-brief-questions):
// prepare_open_design_brief's `answers` and `assumptions`, the "Build to these
// decisions" section, and register_open_design_artifact's `brief`, kept as
// the manifest's `metadata.brief`.

export const MAX_ASSUMPTIONS = 6;
export const MAX_ASSUMPTION_LENGTH = 160;
export const MAX_DECISIONS_BYTES = 2048;
export const MAX_BRIEF_TEXT_LENGTH = 500;

export interface BriefDecisions {
  /** Question id (from the surface or the design-system recommender) to the answer given. */
  answers?: Record<string, string>;
  /** What the agent decided without asking, one short line each. */
  assumptions?: string[];
}

/** The `brief` input of register_open_design_artifact, stored as `metadata.brief`. */
export interface RegisteredBrief extends BriefDecisions {
  text?: string;
}

export type DecisionsResult = { ok: true; decisions: BriefDecisions } | { ok: false; error: string };

/** Checks `answers` and `assumptions` against their limits and drops empty values. */
export function validateBriefDecisions(answers: unknown, assumptions: unknown): DecisionsResult {
  const out: BriefDecisions = {};
  if (answers !== undefined) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return { ok: false, error: 'answers must be an object of question id to answer, e.g. { "where": "Printed" }.' };
    }
    const entries = Object.entries(answers as Record<string, unknown>)
      .filter(([key, value]) => key.trim() && typeof value === 'string' && value.trim())
      .map(([key, value]) => [key.trim(), (value as string).trim()] as const);
    if (entries.length > 0) out.answers = Object.fromEntries(entries);
  }
  if (assumptions !== undefined) {
    if (!Array.isArray(assumptions) || assumptions.some((a) => typeof a !== 'string')) {
      return { ok: false, error: 'assumptions must be a list of short strings.' };
    }
    const list = (assumptions as string[]).map((a) => a.trim()).filter(Boolean);
    if (list.length > MAX_ASSUMPTIONS) {
      return { ok: false, error: `Too many assumptions: ${list.length} given, at most ${MAX_ASSUMPTIONS}. Keep the ones that change the design most.` };
    }
    const long = list.find((a) => a.length > MAX_ASSUMPTION_LENGTH);
    if (long) return { ok: false, error: `Each assumption is at most ${MAX_ASSUMPTION_LENGTH} characters; this one is ${long.length}: "${long.slice(0, 40)}…".` };
    if (list.length > 0) out.assumptions = list;
  }
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > MAX_DECISIONS_BYTES) {
    return { ok: false, error: `answers and assumptions together are over ${MAX_DECISIONS_BYTES / 1024} KB. Shorten them.` };
  }
  return { ok: true, decisions: out };
}

export type RegisteredBriefResult = { ok: true; brief?: RegisteredBrief } | { ok: false; error: string };

/** Checks register_open_design_artifact's `brief`; undefined when there's nothing to keep. */
export function validateRegisteredBrief(brief: unknown): RegisteredBriefResult {
  if (brief === undefined) return { ok: true };
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) {
    return { ok: false, error: 'brief must be an object: { text, answers, assumptions }.' };
  }
  const b = brief as Record<string, unknown>;
  if (b.text !== undefined && typeof b.text !== 'string') return { ok: false, error: 'brief.text must be a string.' };
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (text.length > MAX_BRIEF_TEXT_LENGTH) {
    return { ok: false, error: `brief.text is at most ${MAX_BRIEF_TEXT_LENGTH} characters (a one-line brief); it is ${text.length}.` };
  }
  const decisions = validateBriefDecisions(b.answers, b.assumptions);
  if (!decisions.ok) return { ok: false, error: `brief: ${decisions.error}` };
  const out: RegisteredBrief = { ...(text ? { text } : {}), ...decisions.decisions };
  return { ok: true, brief: Object.keys(out).length > 0 ? out : undefined };
}

/** The manifest metadata with `brief` set to the latest one; unchanged when none is given, so an edit keeps the earlier record. */
export function withBriefMetadata(metadata: Record<string, unknown> | undefined, brief: RegisteredBrief | undefined): Record<string, unknown> | undefined {
  if (!brief) return metadata;
  return { ...(metadata ?? {}), brief };
}

function hasDecisions(d: BriefDecisions | undefined): d is BriefDecisions {
  return Boolean(d && ((d.answers && Object.keys(d.answers).length > 0) || (d.assumptions && d.assumptions.length > 0)));
}

/** The "Build to these decisions" section, or '' when nothing was asked or assumed. */
export function composeDecisionsSection(d: BriefDecisions | undefined): string {
  if (!hasDecisions(d)) return '';
  const lines: string[] = [];
  for (const [id, answer] of Object.entries(d.answers ?? {})) lines.push(`- ${id}: ${answer}`);
  for (const assumption of d.assumptions ?? []) lines.push(`- Assumed: ${assumption}`);
  return `## Build to these decisions\n\nThese were settled before the build: the user's answers, then what was assumed without asking. Follow them over anything in the skill or craft text that points elsewhere.\n\n${lines.join('\n')}`;
}

/** The sentence added to the Output section: what to pass as `brief` when registering, and the one-line reply. */
export function composeRegisterBriefNote(d: BriefDecisions | undefined): string {
  const pass = hasDecisions(d)
    ? 'pass `brief` with the request in one line (`text`) and the same `answers` and `assumptions`'
    : 'pass `brief` with the request in one line (`text`)';
  const reply = d?.assumptions?.length
    ? ' When you present the design, list the assumptions in one sentence and invite a change (for example: "I assumed a dark theme and a single sign-up button; say if you want otherwise").'
    : '';
  return `When you register it, ${pass}, so later edits can see what was decided.${reply}`;
}
