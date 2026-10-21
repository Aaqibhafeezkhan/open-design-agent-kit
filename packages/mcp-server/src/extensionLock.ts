// One set of Open Design tools when both the Claude plugin and the Claude
// Desktop extension are installed (openspec add-desktop-extension-bundle).
// The extension's server holds a lock file while it runs; a server started by
// the plugin's launcher for a client other than Claude Code lists no tools
// while a live extension holds it. Claude Code never loads Desktop
// extensions, so it always keeps the plugin's tools.
import { mkdirSync, readFileSync, unlinkSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import * as path from 'node:path';
import { configDirectory } from './env';

export const EXTENSION_LOCK_FILE = 'desktop-extension.lock';

export interface ExtensionLock {
  pid: number;
  version: string;
  startedAt: string;
}

export function extensionLockPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(configDirectory(env), EXTENSION_LOCK_FILE);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to someone else.
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The lock, when it exists and its process is still running. A lock left by a crashed extension counts as absent. */
export function readLiveExtensionLock(lockPath: string, isAlive: (pid: number) => boolean = processIsAlive): ExtensionLock | undefined {
  let lock: Partial<ExtensionLock>;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return undefined;
  }
  if (typeof lock.pid !== 'number' || !Number.isInteger(lock.pid) || lock.pid <= 0) return undefined;
  return isAlive(lock.pid) ? (lock as ExtensionLock) : undefined;
}

/**
 * Writes the lock for this process and removes it on exit (and on SIGINT or
 * SIGTERM). Returns the function that removes it; it leaves alone a lock that
 * another extension process has taken over since.
 */
export function holdExtensionLock(lockPath: string, version: string): () => void {
  const lock: ExtensionLock = { pid: process.pid, version, startedAt: new Date().toISOString() };
  try {
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, `${JSON.stringify(lock)}\n`);
  } catch (err) {
    console.error(`open-design: could not write ${lockPath} (${err instanceof Error ? err.message : String(err)}); the plugin's server may list its tools too.`);
    return () => undefined;
  }
  const release = (): void => {
    try {
      const current = JSON.parse(readFileSync(lockPath, 'utf8')) as Partial<ExtensionLock>;
      if (current.pid === process.pid) unlinkSync(lockPath);
    } catch {
      // Already gone.
    }
  };
  process.on('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      release();
      process.exit(0);
    });
  }
  return release;
}

/** Whether a plugin-launched server should hand its tools to a running extension. */
export function shouldDeferToExtension(input: { pluginLaunched: boolean; clientName: string | undefined; lockIsLive: boolean }): boolean {
  return input.pluginLaunched && input.clientName !== 'claude-code' && input.lockIsLive;
}

export const DEFERRED_TO_EXTENSION_MESSAGE =
  'The Open Design desktop extension is running and provides these tools in this chat. Use its Open Design tools (same names, without this plugin server\'s prefix) instead.';

/**
 * Calls onChange(live) whenever the lock's liveness changes. Watches the lock's
 * folder (creating it if needed), since the file itself comes and goes.
 */
export function watchExtensionLock(lockPath: string, onChange: (live: boolean) => void): FSWatcher | undefined {
  let live = readLiveExtensionLock(lockPath) !== undefined;
  const dir = path.dirname(lockPath);
  try {
    mkdirSync(dir, { recursive: true });
    const watcher = watch(dir, { persistent: false }, (_event, file) => {
      if (file && file.toString() !== path.basename(lockPath)) return;
      const now = readLiveExtensionLock(lockPath) !== undefined;
      if (now === live) return;
      live = now;
      onChange(now);
    });
    watcher.on('error', () => undefined);
    return watcher;
  } catch {
    // No watch: tools/list still checks the lock each time.
    return undefined;
  }
}
