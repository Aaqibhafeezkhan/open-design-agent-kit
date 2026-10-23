// Host-agnostic hand-written prompts from local/prompts/ (copied into
// assets/open-design/prompts/ by apply-local-overlay.mjs). One source file per
// prompt; each host renders it with its own way of passing the user's brief,
// substituted for the `{{brief}}` placeholder. Used by every host's generator
// (and at runtime by the MCP server), so the prompt text lives in one place.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { VOICE_PLACEHOLDER, loadVoice } from './voice.mjs';

export const BRIEF_PLACEHOLDER = '{{brief}}';

/** Every prompt under `<assetsRoot>/prompts/`, sorted by name, with the shared voice block filled in. */
export async function loadLocalPrompts(assetsRoot) {
  const dir = path.join(assetsRoot, 'prompts');
  let names;
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith('.md'));
  } catch {
    return [];
  }
  const voice = await loadVoice(assetsRoot);
  const prompts = [];
  for (const file of names.sort()) {
    const { data, content } = matter(await fs.readFile(path.join(dir, file), 'utf8'));
    if (typeof data.name !== 'string' || typeof data.description !== 'string') {
      throw new Error(`prompts/${file} needs string "name" and "description" frontmatter.`);
    }
    if (!content.includes(BRIEF_PLACEHOLDER)) throw new Error(`prompts/${file} must contain ${BRIEF_PLACEHOLDER}.`);
    if (!content.includes(VOICE_PLACEHOLDER)) throw new Error(`prompts/${file} must contain ${VOICE_PLACEHOLDER}.`);
    prompts.push({
      name: data.name,
      description: data.description,
      argumentHint: typeof data.argument_hint === 'string' ? data.argument_hint : undefined,
      // When the model should reach for this prompt's skill on its own (appended to skill descriptions).
      modelTrigger: typeof data.model_trigger === 'string' ? data.model_trigger : undefined,
      placeholder: typeof data.placeholder === 'string' ? data.placeholder : 'Describe what you want.',
      // Hosts that get this prompt (vscode, claude, codex, mcp); all when absent.
      hosts: Array.isArray(data.hosts) ? data.hosts.map(String) : undefined,
      body: content.split(VOICE_PLACEHOLDER).join(voice).trim(),
    });
  }
  return prompts;
}

// Text only Claude can act on (its Artifact tool), between these comments.
// Kept for the claude and mcp hosts, removed with the comments for the
// others (openspec add-artifact-preview).
const CLAUDE_ONLY_RE = /\n?<!-- claude-only -->[\s\S]*?<!-- \/claude-only -->\n?/g;
const CLAUDE_HOSTS = new Set(['claude', 'mcp']);

/** `text` as `host` sees it: claude-only blocks dropped unless host is claude or mcp. */
export function forHost(text, host) {
  if (CLAUDE_HOSTS.has(host)) return text;
  const trailing = text.match(/\s*$/)[0];
  return text.replace(CLAUDE_ONLY_RE, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + trailing;
}

export function renderPromptBody(prompt, briefText, host) {
  return forHost(prompt.body.split(BRIEF_PLACEHOLDER).join(briefText), host);
}

/** Whether `host` (vscode, claude, codex or mcp) gets this prompt. */
export function promptIsForHost(prompt, host) {
  return !prompt.hosts || prompt.hosts.includes(host);
}
