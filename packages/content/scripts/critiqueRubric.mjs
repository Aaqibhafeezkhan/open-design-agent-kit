// The design critic's rubric (openspec add-design-critic), kept once in the
// open-design-critique prompt (local/prompts/critique.md) between the region
// markers below. The Claude plugin's design-critic agent carries a copy in
// the same region, filled by the Claude generator and checked by the skills
// sync check, so the agent and the inline fallback judge alike.
export const RUBRIC_START = '<!-- rubric:start -->';
export const RUBRIC_END = '<!-- rubric:end -->';
export const CRITIQUE_PROMPT_NAME = 'open-design-critique';

/** The rubric text between the markers in `text` (trimmed); throws when the markers are missing. */
export function extractRubric(text) {
  const start = text.indexOf(RUBRIC_START);
  const end = text.indexOf(RUBRIC_END);
  if (start < 0 || end < start) throw new Error(`missing ${RUBRIC_START} … ${RUBRIC_END} region`);
  return text.slice(start + RUBRIC_START.length, end).trim();
}

/** The rubric from the loaded open-design-critique prompt among `prompts` (from loadLocalPrompts). */
export function rubricFromPrompts(prompts) {
  const prompt = prompts.find((p) => p.name === CRITIQUE_PROMPT_NAME);
  if (!prompt) throw new Error(`no ${CRITIQUE_PROMPT_NAME} prompt to take the critic's rubric from`);
  return extractRubric(prompt.body);
}

/** `text` with the region between the rubric markers replaced by `rubric`. */
export function fillRubricRegion(text, rubric) {
  const start = text.indexOf(RUBRIC_START);
  const end = text.indexOf(RUBRIC_END);
  if (start < 0 || end < start) throw new Error(`missing ${RUBRIC_START} … ${RUBRIC_END} region`);
  return `${text.slice(0, start + RUBRIC_START.length)}\n${rubric}\n${text.slice(end)}`;
}

/** Whether `text`'s rubric region holds exactly `rubric`. */
export function rubricRegionIsCurrent(text, rubric) {
  try {
    return fillRubricRegion(text, rubric) === text;
  } catch {
    return false;
  }
}
