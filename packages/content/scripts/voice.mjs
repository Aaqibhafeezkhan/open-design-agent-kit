// The shared voice block (openspec plain-language-replies): how the agent
// talks to the user, kept once in local/voice.md and copied to
// assets/open-design/voice.md by apply-local-overlay.mjs. Local prompts pull
// it in through the {{voice}} placeholder; the hand-authored overviews carry
// it between the region markers below, filled by the Claude generator and
// checked by the skills sync check.
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const VOICE_PLACEHOLDER = '{{voice}}';
export const VOICE_START = '<!-- voice:start -->';
export const VOICE_END = '<!-- voice:end -->';

/** The voice block's text from `<assetsRoot>/voice.md`, trimmed. */
export async function loadVoice(assetsRoot) {
  return (await fs.readFile(path.join(assetsRoot, 'voice.md'), 'utf8')).trim();
}

/** `text` with the region between the voice markers replaced by `voice`; throws when the markers are missing. */
export function fillVoiceRegion(text, voice) {
  const start = text.indexOf(VOICE_START);
  const end = text.indexOf(VOICE_END);
  if (start < 0 || end < start) throw new Error(`missing ${VOICE_START} … ${VOICE_END} region`);
  return `${text.slice(0, start + VOICE_START.length)}\n${voice}\n${text.slice(end)}`;
}

/** Whether `text`'s voice region holds exactly `voice`. */
export function voiceRegionIsCurrent(text, voice) {
  try {
    return fillVoiceRegion(text, voice) === text;
  } catch {
    return false;
  }
}
