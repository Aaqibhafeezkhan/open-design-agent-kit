// One browser preview per process (openspec add-browser-preview, D7): the
// MCP server keeps one for its session and the CLI's `preview` command runs
// one in the foreground. Starts the server on first use, opens or reuses the
// window, and closes everything on close().
import { loadPreviewAssets } from './assets';
import { openPreviewWindow, type OpenPreviewOptions } from './openPreviewWindow';
import { startPreviewServer, type PreviewServer } from './previewServer';

/** `manual` (default): opened when asked; `auto`: also on the first registration; `off`: never. */
export const PREVIEW_MODE_ENV = 'OPEN_DESIGN_PREVIEW';
export type PreviewMode = 'manual' | 'auto' | 'off';

export function previewModeFromEnv(env: NodeJS.ProcessEnv = process.env): PreviewMode {
  const v = env[PREVIEW_MODE_ENV]?.trim().toLowerCase();
  return v === 'auto' || v === 'off' ? v : 'manual';
}

export interface PreviewOutcome {
  url: string;
  how: 'app-window' | 'default-browser' | 'not-opened';
  /** True when an already-open window was navigated instead of opening a new one. */
  reused?: boolean;
  /** Why it wasn't opened, or a note about how it was. */
  note?: string;
}

export interface PreviewSessionOptions {
  workspaceRoot: string;
  outputDir?: string;
  browserPath?: string;
  port?: number;
  /** Redirect `/` to the shell (see PreviewServerOptions.rootRedirect). */
  rootRedirect?: boolean;
  /** Redirect `/` to the newest design (see PreviewServerOptions.rootLatest). */
  rootLatest?: boolean;
  /** Where the host's build put shell.js and bridge.js (default: next to the running bundle). */
  assetsDir?: string;
  log?: (message: string) => void;
  /** Injected for tests. */
  openWindow?: (url: string, options: OpenPreviewOptions) => ReturnType<typeof openPreviewWindow>;
}

export class PreviewSession {
  private server: Promise<PreviewServer> | undefined;

  constructor(private readonly options: PreviewSessionOptions) {}

  isRunning(): boolean {
    return this.server !== undefined;
  }

  ensureServer(): Promise<PreviewServer> {
    this.server ??= (async () => {
      const assets = await loadPreviewAssets(this.options.assetsDir);
      return startPreviewServer({
        workspaceRoot: this.options.workspaceRoot,
        outputDir: this.options.outputDir,
        assets,
        browserPath: this.options.browserPath,
        port: this.options.port,
        rootRedirect: this.options.rootRedirect,
        rootLatest: this.options.rootLatest,
        log: this.options.log,
      });
    })();
    this.server.catch(() => {
      this.server = undefined;
    });
    return this.server;
  }

  /** Shows `entryPath` (or the artifact picker): navigates the open window, or opens one when `open` is true. */
  async open(entryPath?: string, open = true): Promise<PreviewOutcome> {
    const server = await this.ensureServer();
    const url = server.urlFor(entryPath);
    const existing = server.getWindow();
    if (existing) {
      await existing.navigate(url);
      await existing.focus().catch(() => undefined);
      return { url, how: 'app-window', reused: true };
    }
    if (!open) return { url, how: 'not-opened' };
    const result = await (this.options.openWindow ?? openPreviewWindow)(url, { browserPath: this.options.browserPath, log: this.options.log });
    if (result.how === 'app-window') {
      server.setWindow(result.window);
      return { url, how: 'app-window' };
    }
    if (result.how === 'default-browser') return { url, how: 'default-browser', note: result.note };
    return { url, how: 'not-opened', note: result.reason };
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (server) await (await server.catch(() => undefined))?.close();
  }
}

/** The text a tool or command shows for an outcome. */
export function formatPreviewOutcome(outcome: PreviewOutcome, entryPath?: string): string {
  const what = entryPath ? `The preview of ${entryPath}` : 'The preview';
  const lines =
    outcome.how === 'app-window'
      ? [`${what} is ${outcome.reused ? 'showing in the open preview window' : 'open in a browser window'}: ${outcome.url}`]
      : outcome.how === 'default-browser'
        ? [`${what} opened in the default browser: ${outcome.url}`]
        : [`${what} wasn't opened. Open this URL in a browser on this machine: ${outcome.url}`];
  if (outcome.note && outcome.how !== 'app-window') lines.push(outcome.note);
  lines.push('It reloads when the design changes. In Comment mode the user clicks an element to leave a comment; "Send to agent" copies an instruction to paste here. Read comments with get_open_design_artifact.');
  return lines.join('\n');
}
