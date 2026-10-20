import { readFileSync, statSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The workspace root this server starts with: the launching process's own
 * cwd by default (how Claude Code and Codex both start a local stdio MCP
 * server — with cwd already set to the active project), overridable for
 * testing or an unusual host via OPEN_DESIGN_WORKSPACE_ROOT. Without the
 * override, index.ts replaces it with the client's first MCP root once the
 * client reports one (see workspaceRootFromClientRoots).
 */
export function getWorkspaceRoot(): string {
  return getWorkspaceRootOverride() || process.cwd();
}

/** An explicit OPEN_DESIGN_WORKSPACE_ROOT, which beats the client's roots. */
export function getWorkspaceRootOverride(): string | undefined {
  return process.env.OPEN_DESIGN_WORKSPACE_ROOT?.trim() || undefined;
}

/**
 * The workspace a client reports through MCP roots: the first file:// root.
 * Hosts that install servers from a registry gallery (VS Code's @mcp view)
 * don't necessarily start them in the open folder, so the cwd alone isn't
 * reliable there. Undefined when the client reports no usable root.
 */
export function workspaceRootFromClientRoots(roots: readonly { uri: string }[]): string | undefined {
  for (const root of roots) {
    if (!root.uri.startsWith('file://')) continue;
    try {
      return fileURLToPath(root.uri);
    } catch {
      continue;
    }
  }
  return undefined;
}

const DEFAULT_OUTPUT_DIR = '.open-design';

/** Where generated artifacts land, relative to the workspace root. */
export function getOutputDirectory(): string {
  return process.env.OPEN_DESIGN_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
}

/**
 * A Figma personal access token (Figma → Settings → Personal access tokens):
 * OPEN_DESIGN_FIGMA_TOKEN from this server's own env, else the token file
 * (figmaTokenFilePath). Read on every call, so a token saved while the server
 * runs is picked up without a restart. Undefined means
 * pull_open_design_figma_frame degrades to a clear instructional error rather
 * than throwing.
 *
 * Not taken from a Claude plugin setting: Claude Desktop refuses to start a
 * plugin server whose .mcp.json refers to ${user_config.*}.
 */
export function getFigmaToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const fromEnv = env.OPEN_DESIGN_FIGMA_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(figmaTokenFilePath(env), 'utf8').trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Where the Figma token can be saved: $XDG_CONFIG_HOME/open-design/figma-token, defaulting to ~/.config. */
export function figmaTokenFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const configHome = env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), '.config');
  return path.join(configHome, 'open-design', 'figma-token');
}

/**
 * True when the server would otherwise work straight in the user's home
 * folder. That's how Claude Desktop starts plugin servers (no MCP roots, cwd
 * = home), and writing `.open-design/` there is never what the user meant, so
 * tools ask the agent to name the folder first.
 */
export function isHomeFolder(root: string, home: string = os.homedir()): boolean {
  return path.resolve(root) === path.resolve(home);
}

/**
 * Validates a workspace folder the agent names through
 * set_open_design_workspace: hosts like Claude Desktop start the server in the
 * user's home folder and report no MCP roots, so the agent has to say which
 * folder the user connected. Returns the resolved path; throws a message the
 * agent can act on.
 */
export function workspaceRootFromArg(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('path is required: the absolute path of the folder on the machine this server runs on');
  const root = value.trim();
  if (!path.isAbsolute(root)) throw new Error(`"${root}" is not an absolute path`);
  let isDir = false;
  try {
    isDir = statSync(root).isDirectory();
  } catch {
    // Reported below.
  }
  if (!isDir) {
    throw new Error(
      `"${root}" is not a folder this server can see. It runs on the user's machine, so pass that machine's path for the folder (in Claude Desktop, the one get_device_info lists under connectedFolders), not the path your own file tools use.`,
    );
  }
  return path.resolve(root);
}

/**
 * Absolute path to the vendored content this server reads from —
 * `@feimacode/open-design-agent-kit-content`'s bundled `assets/open-design`,
 * resolved via normal Node module resolution. Unlike the VS Code extension,
 * this package has no "must physically bundle its own copy" packaging
 * constraint, so it reads the content package directly rather than
 * mirroring it.
 */
export function getAssetsRoot(): string {
  const contentPackageJson = require.resolve('@feimacode/open-design-agent-kit-content/package.json');
  return path.join(path.dirname(contentPackageJson), 'assets', 'open-design');
}

/**
 * OPEN_DESIGN_SHARE_BADGE (1/true, 0/false) overrides the default for the
 * "Made with Open Design" footer badge on standalone/site exports and
 * publish bundles. Read by core's resolveBadge() from this same process env,
 * so this server passes nothing; listed here so every env var this server
 * honours is in one place.
 */
export const SHARE_BADGE_ENV = 'OPEN_DESIGN_SHARE_BADGE';
