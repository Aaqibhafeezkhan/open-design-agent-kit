import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { mergeClaudeLaunchConfig as mergeLaunchConfig } from '@feimacode/open-design-agent-kit-core';
import { cliVersion, pinned } from './packageVersion';
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

/**
 * Merges the `open-design-preview` configuration into
 * `<targetPath>/.claude/launch.json`, pinned to this CLI's version, so Claude
 * Desktop's Code tab can open the preview in its Browser pane. The merge
 * itself lives in core, shared with the MCP server's
 * set_up_open_design_browser_pane (openspec code-tab-browser-pane).
 */
export async function mergeClaudeLaunchConfig(targetPath: string): Promise<{ outcome: 'created' | 'updated' | 'unchanged' }> {
  const { outcome } = await mergeLaunchConfig({ workspaceRoot: targetPath, version: cliVersion() });
  return { outcome };
}
