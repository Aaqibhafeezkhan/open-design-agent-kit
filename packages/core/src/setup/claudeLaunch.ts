import { existsSync, realpathSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * The browser preview as a Claude Desktop launch configuration, so the Code
 * tab can open it in its Browser pane (openspec add-claude-desktop-guide,
 * code-tab-browser-pane). Shared by the CLI's `init` and the MCP server's
 * set_up_open_design_browser_pane, so the two write the same entry.
 */
export const LAUNCH_CONFIG_NAME = 'open-design-preview';
export const LAUNCH_PORT_BASE = 5317;
const LAUNCH_PORT_SPAN = 100;
const CLI_PACKAGE = '@feimacode/open-design-agent-kit';

export interface LaunchEntry {
  name: string;
  runtimeExecutable: string;
  runtimeArgs: string[];
  port: number;
}

/** FNV-1a, 32 bit: stable everywhere, so a path always gets the same port. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The project's own port in 5317–5416, from its real path, so two projects' previews can run at once. */
export function launchPortFor(workspaceRoot: string): number {
  let real = path.resolve(workspaceRoot);
  try {
    real = realpathSync(real);
  } catch {
    // Not created yet: the resolved path is as stable.
  }
  return LAUNCH_PORT_BASE + (fnv1a(real) % LAUNCH_PORT_SPAN);
}

/**
 * The `npx` beside the Node running this process (nvm, Homebrew, Volta and the
 * installers all put it there), since Desktop starts the entry without the
 * user's shell PATH. Plain `npx` when there's none.
 */
export function npxBesideNode(execPath: string = process.execPath, exists: (p: string) => boolean = existsSync, platform: NodeJS.Platform = process.platform): string {
  const candidate = path.join(path.dirname(execPath), platform === 'win32' ? 'npx.cmd' : 'npx');
  return exists(candidate) ? candidate : 'npx';
}

export function openDesignLaunchEntry(input: { workspaceRoot: string; version: string; npx?: string }): LaunchEntry {
  const port = launchPortFor(input.workspaceRoot);
  return {
    name: LAUNCH_CONFIG_NAME,
    runtimeExecutable: input.npx ?? npxBesideNode(),
    runtimeArgs: ['-y', `${CLI_PACKAGE}@${input.version}`, 'preview', '--no-open', '--root-latest', '--port', String(port)],
    port,
  };
}

export class MalformedLaunchJsonError extends Error {
  constructor(file: string, cause: unknown) {
    super(`Could not parse existing ${file} as JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

/**
 * Merges the `open-design-preview` configuration into
 * `<workspaceRoot>/.claude/launch.json`, creating the file if absent, replacing
 * our own entry in place and leaving every other configuration untouched.
 * Doesn't rewrite the file when nothing would change; refuses a malformed one.
 */
export async function mergeClaudeLaunchConfig(input: { workspaceRoot: string; version: string; npx?: string }): Promise<{ outcome: 'created' | 'updated' | 'unchanged'; entry: LaunchEntry; file: string }> {
  const file = path.join(input.workspaceRoot, '.claude', 'launch.json');
  let config: Record<string, unknown> = { version: '0.0.1' };
  let raw: string | undefined;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    raw = undefined;
  }
  if (raw !== undefined && raw.trim().length > 0) {
    try {
      config = JSON.parse(raw);
    } catch (err) {
      throw new MalformedLaunchJsonError(file, err);
    }
  }

  const entry = openDesignLaunchEntry(input);
  const configurations = Array.isArray(config.configurations) ? [...config.configurations] : [];
  const ours = configurations.findIndex((c) => (c as { name?: unknown } | null)?.name === entry.name);
  if (ours >= 0) configurations[ours] = entry;
  else configurations.push(entry);
  config.configurations = configurations;

  const next = JSON.stringify(config, null, 2) + '\n';
  if (raw === next) return { outcome: 'unchanged', entry, file };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, next, 'utf8');
  return { outcome: raw === undefined ? 'created' : 'updated', entry, file };
}
