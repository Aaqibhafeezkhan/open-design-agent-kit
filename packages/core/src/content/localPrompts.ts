// Runtime reader for the hand-written, host-agnostic prompts that
// packages/content's apply-local-overlay.mjs copies into
// `<assetsRoot>/prompts/` (e.g. open-design-social-post). Mirrors
// packages/content/scripts/localPrompts.mjs, which the build-time
// generators use (they have no TS build step to import this through).
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';

export const BRIEF_PLACEHOLDER = '{{brief}}';

export interface LocalPrompt {
  name: string;
  description: string;
  argumentHint?: string;
  /** When the model should reach for this prompt's skill on its own (appended to skill descriptions). */
  modelTrigger?: string;
  placeholder: string;
  /** Hosts that get this prompt (vscode, claude, codex, mcp); all when absent. */
  hosts?: string[];
  body: string;
}

/** Every well-formed prompt under `<assetsRoot>/prompts/`, sorted by file name. Malformed files are skipped. */
export async function loadLocalPrompts(assetsRoot: string): Promise<LocalPrompt[]> {
  const dir = path.join(assetsRoot, 'prompts');
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith('.md')).sort();
  } catch {
    return [];
  }
  const prompts: LocalPrompt[] = [];
  for (const file of names) {
    const { data, content } = matter(await fs.readFile(path.join(dir, file), 'utf8'));
    if (typeof data.name !== 'string' || typeof data.description !== 'string' || !content.includes(BRIEF_PLACEHOLDER)) continue;
    prompts.push({
      name: data.name,
      description: data.description,
      argumentHint: typeof data.argument_hint === 'string' ? data.argument_hint : undefined,
      modelTrigger: typeof data.model_trigger === 'string' ? data.model_trigger : undefined,
      placeholder: typeof data.placeholder === 'string' ? data.placeholder : 'Describe what you want.',
      hosts: Array.isArray(data.hosts) ? data.hosts.map(String) : undefined,
      body: content.trim(),
    });
  }
  return prompts;
}

// Mirrors forHost() in packages/content/scripts/localPrompts.mjs.
const CLAUDE_ONLY_RE = /\n?<!-- claude-only -->[\s\S]*?<!-- \/claude-only -->\n?/g;

/** `text` with claude-only blocks (Artifact-tool guidance) kept for claude and mcp, removed for other hosts. */
export function localPromptForHost(text: string, host: string): string {
  if (host === 'claude' || host === 'mcp') return text;
  const trailing = /\s*$/.exec(text)?.[0] ?? '';
  return text.replace(CLAUDE_ONLY_RE, '\n').replace(/\n{3,}/g, '\n\n').trimEnd() + trailing;
}

/** The MCP server's rendering: claude-only blocks are kept, since Claude clients use it too. */
export function renderLocalPrompt(prompt: LocalPrompt, briefText: string, host = 'mcp'): string {
  return localPromptForHost(prompt.body.split(BRIEF_PLACEHOLDER).join(briefText), host);
}
