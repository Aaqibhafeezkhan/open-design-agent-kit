// `preview [entryPath]` (openspec add-browser-preview): runs the browser
// preview in the foreground until interrupted, for hosts without the MCP
// server or for people who prefer it in its own terminal.
import * as path from 'node:path';
import { PreviewSession, type PreviewOutcome } from '@feimacode/open-design-agent-kit-core';
import { ExportArgsError, resolveWorkspaceRoot } from './exportCommand';

export interface PreviewCliOptions {
  /** false with --no-open: print the URL only. */
  open?: boolean;
  port?: string;
  browser?: string;
  workspace?: string;
}

export function parsePreviewPort(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ExportArgsError(`--port must be a port number between 1 and 65535 (got "${raw}").`);
  return port;
}

/** What the command prints once the preview is up. */
export function describeOutcome(outcome: PreviewOutcome): string {
  const how =
    outcome.how === 'app-window'
      ? 'Opened in a browser window.'
      : outcome.how === 'default-browser'
        ? `Opened in the default browser.${outcome.note ? ` ${outcome.note}` : ''}`
        : outcome.note
          ? `Not opened: ${outcome.note}`
          : 'Open the URL above in a browser.';
  return `${how}\nIt reloads when the design changes. Press Ctrl-C to stop.`;
}

export interface PreviewDeps {
  createSession?: (options: ConstructorParameters<typeof PreviewSession>[0]) => Pick<PreviewSession, 'open' | 'close'>;
  /** Resolves when the command should stop (default: SIGINT or SIGTERM). */
  untilStopped?: () => Promise<void>;
  out?: (line: string) => void;
  err?: (line: string) => void;
}

function untilSignal(): Promise<void> {
  return new Promise((resolve) => {
    const stop = (): void => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      resolve();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });
}

export async function runPreview(entryArg: string | undefined, flags: PreviewCliOptions, cwd = process.cwd(), deps: PreviewDeps = {}): Promise<number> {
  const port = parsePreviewPort(flags.port);
  // Without an entry, the workspace is found from the current directory (any name inside it works).
  const workspaceRoot = await resolveWorkspaceRoot(entryArg ?? '.open-design', flags.workspace, cwd);
  const entryPath = entryArg ? path.relative(workspaceRoot, path.resolve(cwd, entryArg)).split(path.sep).join('/') : undefined;
  if (entryPath && (entryPath.startsWith('..') || path.isAbsolute(entryPath))) throw new ExportArgsError(`${entryArg} is outside the workspace ${workspaceRoot}.`);
  const out = deps.out ?? ((line: string) => console.log(line));
  const err = deps.err ?? ((line: string) => console.error(line));

  const session = (deps.createSession ?? ((o) => new PreviewSession(o)))({ workspaceRoot, browserPath: flags.browser, port, log: err });
  try {
    const outcome = await session.open(entryPath, flags.open !== false);
    // stdout: the URL alone, for scripts; details to stderr.
    out(outcome.url);
    err(describeOutcome(outcome));
    await (deps.untilStopped ?? untilSignal)();
    return 0;
  } finally {
    await session.close();
  }
}
