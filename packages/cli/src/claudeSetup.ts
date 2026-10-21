import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { pinned } from './packageVersion';
import { writeSkillTree } from './skillWriter';

/** Writes the bundled Claude Code skill content into `<targetPath>/.claude/skills/`. */
export async function writeClaudeSkills(targetPath: string, assetRoot: string): Promise<{ writtenCount: number }> {
  return writeSkillTree(path.join(targetPath, '.claude', 'skills'), assetRoot);
}

/** The MCP server, pinned to this CLI's version (see packageVersion.ts). */
export function openDesignMcpEntry(version?: string): { command: string; args: string[] } {
  return { command: 'npx', args: ['-y', pinned('@feimacode/open-design-agent-kit-mcp', version)] };
}

export class MalformedMcpJsonError extends Error {
  constructor(mcpJsonPath: string, cause: unknown) {
    super(`Could not parse existing ${mcpJsonPath} as JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merges an `open-design` entry into `<targetPath>/.mcp.json`'s `mcpServers`,
 * preserving every other key untouched. Creates the file fresh if absent.
 * Safe to do as a real parse-merge-write (unlike the Codex/TOML case) since
 * JSON has no comments or meaningful formatting to lose.
 */
export async function mergeClaudeMcpConfig(targetPath: string): Promise<{ created: boolean }> {
  const mcpJsonPath = path.join(targetPath, '.mcp.json');

  let config: Record<string, unknown> = {};
  let created = true;
  if (await pathExists(mcpJsonPath)) {
    created = false;
    const raw = await fs.readFile(mcpJsonPath, 'utf8');
    try {
      config = raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch (err) {
      throw new MalformedMcpJsonError(mcpJsonPath, err);
    }
  }

  const mcpServers = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
  mcpServers['open-design'] = openDesignMcpEntry();
  config.mcpServers = mcpServers;

  await fs.writeFile(mcpJsonPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return { created };
}

/** Fixed so the `.claude/launch.json` entry can name it; loopback-only, like every preview. */
export const LAUNCH_PREVIEW_PORT = 5317;

/**
 * The browser preview as a Claude Desktop launch configuration, so the Code
 * tab can open it in its Browser pane (openspec add-claude-desktop-guide).
 * Uses the launch.json configuration shape (name, runtimeExecutable, runtimeArgs, port).
 */
export function openDesignLaunchEntry(version?: string) {
  return {
    name: 'open-design-preview',
    runtimeExecutable: 'npx',
    runtimeArgs: ['-y', pinned('@feimacode/open-design-agent-kit', version), 'preview', '--no-open', '--root-redirect', '--port', String(LAUNCH_PREVIEW_PORT)],
    port: LAUNCH_PREVIEW_PORT,
  };
}

/**
 * Merges the `open-design-preview` configuration into
 * `<targetPath>/.claude/launch.json`, creating the file if absent, replacing
 * our own entry in place and leaving every other configuration untouched.
 * Doesn't rewrite the file when nothing would change.
 */
export async function mergeClaudeLaunchConfig(targetPath: string): Promise<{ outcome: 'created' | 'updated' | 'unchanged' }> {
  const launchJsonPath = path.join(targetPath, '.claude', 'launch.json');

  let config: Record<string, unknown> = { version: '0.0.1' };
  let raw: string | undefined;
  if (await pathExists(launchJsonPath)) {
    raw = await fs.readFile(launchJsonPath, 'utf8');
    try {
      if (raw.trim().length > 0) config = JSON.parse(raw);
    } catch (err) {
      throw new MalformedMcpJsonError(launchJsonPath, err);
    }
  }

  const entry = openDesignLaunchEntry();
  const configurations = Array.isArray(config.configurations) ? [...config.configurations] : [];
  const ours = configurations.findIndex((c) => (c as { name?: unknown } | null)?.name === entry.name);
  if (ours >= 0) configurations[ours] = entry;
  else configurations.push(entry);
  config.configurations = configurations;

  const next = JSON.stringify(config, null, 2) + '\n';
  if (raw === next) return { outcome: 'unchanged' };
  await fs.mkdir(path.dirname(launchJsonPath), { recursive: true });
  await fs.writeFile(launchJsonPath, next, 'utf8');
  return { outcome: raw === undefined ? 'created' : 'updated' };
}
