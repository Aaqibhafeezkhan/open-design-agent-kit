// The browser preview's loopback server (openspec add-browser-preview, D2/D6):
// two origins on 127.0.0.1, each behind its own 128-bit path token.
//  - The shell origin serves the preview shell, its JSON API (comments, crops,
//    check runs) and a server-sent-event stream that tells the shell when the
//    design, its comments or its check runs change.
//  - The design origin serves the workspace with the preview bridge injected
//    into every HTML document as served (never on disk).
// Keeping the design on its own origin means the design's scripts (generated
// or remixed code) can't call the write API.
import { randomBytes } from 'node:crypto';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as path from 'node:path';
import { injectPreviewBridge, injectPreviewErrorReporter } from '../../content/exampleHtml';
import { findBrowser } from '../../export/browserDiscovery';
import { listCheckRuns, onCheckRunSaved, readCheckRunImage } from '../../export/checkHistory';
import { readCritique } from '../../workspace/critique';
import { extractHtmlReferences, resolveReferencedPath } from '../../export/htmlReferences';
import { startStaticServer, urlForPath, type StaticServer } from '../../export/staticServer';
import { scanArtifactManifests } from '../../workspace/collectionScan';
import {
  commentCropRelPath,
  mergeArtifactComments,
  readArtifactComments,
  readCommentCrop,
  updateArtifactComments,
  writeCommentCrop,
  type ArtifactComment,
} from '../../workspace/artifactComments';
import { captureRerenderedCrop, captureWindowCrop, type Box } from './captureCrop';
import type { PreviewWindow } from './openPreviewWindow';
import { renderShellPage } from './shellPage';

const MAX_COMMENTS_BODY = 256 * 1024;
const MAX_SMALL_BODY = 64 * 1024;
const DEBOUNCE_MS = 150;
const ENTRY_EXT = /\.(html?|svg)$/i;

export interface PreviewServerOptions {
  workspaceRoot: string;
  /** The workspace's Open Design output directory. Default ".open-design". */
  outputDir?: string;
  /** The bundled browser code: the shell script and the in-page bridge. */
  assets: { shellJs: string; bridgeJs: string };
  /** Explicit browser executable for headless crops; falls back to discovery. */
  browserPath?: string;
  /** Shell port; 0 or unset picks a free one. */
  port?: number;
  /**
   * Also answer a GET of `/` with a redirect to the tokened shell, for hosts
   * that can only open the bare port (Claude Desktop's `.claude/launch.json`).
   * Another site can trigger the redirect but can't read where it leads.
   */
  rootRedirect?: boolean;
  /**
   * Like rootRedirect, but `/` leads to the most recently registered design
   * (the artifact list when there is none), so Claude Desktop's Browser pane
   * opens on the design just made (openspec code-tab-browser-pane).
   */
  rootLatest?: boolean;
  log?: (message: string) => void;
}

export interface PreviewServer {
  /** e.g. http://127.0.0.1:43123/<token>/ */
  shellBaseUrl: string;
  designBaseUrl: string;
  /** The shell URL for an entry, or the artifact picker without one. */
  urlFor(entryPath?: string): string;
  /** The window this process drives, for exact crops; undefined when it was opened another way. */
  setWindow(window: PreviewWindow | undefined): void;
  getWindow(): PreviewWindow | undefined;
  close(): Promise<void>;
}

type CropSupport = 'window' | 'rerender' | 'none';

/** The registered previewable design whose manifest changed last. */
async function newestEntry(workspaceRoot: string, outputDir: string): Promise<string | undefined> {
  let best: { entryPath: string; at: number } | undefined;
  for (const a of await scanArtifactManifests(workspaceRoot, outputDir)) {
    if (!ENTRY_EXT.test(a.entryPath)) continue;
    const at = await fs
      .stat(path.join(workspaceRoot, `${a.entryPath}.artifact.json`))
      .then((s) => s.mtimeMs)
      .catch(() => 0);
    if (!best || at > best.at) best = { entryPath: a.entryPath, at };
  }
  return best?.entryPath;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function token(): string {
  return randomBytes(16).toString('hex');
}

async function readBody(req: http.IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, 'Request body too large.');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
  res.end(data);
}

function isBox(v: unknown): v is Box {
  const b = v as Box;
  return !!b && [b.x, b.y, b.width, b.height].every((n) => typeof n === 'number' && Number.isFinite(n));
}

const MAX_WATCHED_DIRS = 64;
const SKIP_DIR = /^(node_modules|\.git|\.checks)$|\.comments$/;

/**
 * Watches `absDir` and its subfolders, reporting paths relative to it. On
 * macOS and Windows the platform's recursive watch is used. On Linux, Node's
 * recursive watch is emulated and loses files that are replaced by a rename
 * (as atomic writes do), so each folder gets its own plain watch instead.
 */
async function watchTree(absDir: string, onChange: (relPath: string | null) => void): Promise<FSWatcher[]> {
  if (process.platform !== 'linux') {
    try {
      return [watch(absDir, { recursive: true }, (_e, f) => onChange(f ? String(f) : null))];
    } catch {
      // Fall through to per-folder watches.
    }
  }
  const watchers: FSWatcher[] = [];
  const queue: string[] = [''];
  while (queue.length && watchers.length < MAX_WATCHED_DIRS) {
    const rel = queue.shift()!;
    const abs = path.join(absDir, rel);
    try {
      watchers.push(watch(abs, (_e, f) => onChange(f ? path.join(rel, String(f)) : rel || null)));
    } catch {
      continue;
    }
    const children = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
    for (const child of children) if (child.isDirectory() && !SKIP_DIR.test(child.name)) queue.push(path.join(rel, child.name));
  }
  return watchers;
}

/** One watched entry: its folder (and the folders of files it references outside it), shared by every event stream on it. */
interface EntryWatch {
  clients: Set<http.ServerResponse>;
  watchers: FSWatcher[];
  timers: Map<string, NodeJS.Timeout>;
}

export async function startPreviewServer(options: PreviewServerOptions): Promise<PreviewServer> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const outputDir = options.outputDir ?? '.open-design';
  const log = options.log ?? (() => undefined);
  const shellToken = token();
  const designToken = token();
  let window: PreviewWindow | undefined;

  const design: StaticServer = await startStaticServer(workspaceRoot, {
    pathToken: designToken,
    transformHtml: (html) => injectPreviewErrorReporter(injectPreviewBridge(html, options.assets.bridgeJs)),
  });

  /** A registered artifact entry inside the workspace, workspace-relative with forward slashes. */
  const resolveEntry = async (raw: string | null): Promise<string> => {
    if (!raw) throw new HttpError(400, 'Missing entry.');
    const abs = path.resolve(workspaceRoot, raw);
    const rel = path.relative(workspaceRoot, abs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new HttpError(403, 'Outside the workspace.');
    if (!ENTRY_EXT.test(rel)) throw new HttpError(400, 'Not an HTML or SVG entry.');
    const exists = await fs.stat(`${abs}.artifact.json`).then((s) => s.isFile()).catch(() => false);
    if (!exists) throw new HttpError(404, `${rel.split(path.sep).join('/')} isn't a registered Open Design artifact.`);
    return rel.split(path.sep).join('/');
  };

  const cropSupport = async (): Promise<CropSupport> => {
    if (window?.isOpen()) return 'window';
    return (await findBrowser({ explicitPath: options.browserPath })).ok ? 'rerender' : 'none';
  };

  // ── Event streams and file watching ──────────────────────────────────────
  const watches = new Map<string, EntryWatch>();

  const broadcast = (entryPath: string, event: string, data: unknown): void => {
    const w = watches.get(entryPath);
    if (!w) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of w.clients) res.write(frame);
  };

  const debounced = (entryPath: string, kind: string, fn: () => void): void => {
    const w = watches.get(entryPath);
    if (!w) return;
    clearTimeout(w.timers.get(kind));
    w.timers.set(
      kind,
      setTimeout(() => {
        w.timers.delete(kind);
        fn();
      }, DEBOUNCE_MS),
    );
  };

  const sendComments = async (entryPath: string): Promise<void> => broadcast(entryPath, 'comments-updated', { comments: await readArtifactComments(workspaceRoot, entryPath) });

  const watchEntry = async (entryPath: string): Promise<EntryWatch> => {
    const existing = watches.get(entryPath);
    if (existing) return existing;
    const w: EntryWatch = { clients: new Set(), watchers: [], timers: new Map() };
    watches.set(entryPath, w);
    const entryDir = path.posix.dirname(entryPath);
    const entryBase = path.posix.basename(entryPath);
    const absDir = path.join(workspaceRoot, entryDir);

    const onChange = (relToDir: string | null): void => {
      const rel = (relToDir ?? '').split(path.sep).join('/');
      if (rel === `${entryBase}.comments.json`) {
        debounced(entryPath, 'comments', () => void sendComments(entryPath));
        return;
      }
      if (rel === `${entryBase}.artifact.json`) {
        debounced(entryPath, 'manifest', () => broadcast(entryPath, 'manifest-updated', { at: Date.now() }));
        return;
      }
      if (/\.tmp$|\.artifact\.json$|\.comments\.json$|(^|\/)[^/]+\.comments\/|(^|\/)\.checks\//.test(rel)) return;
      debounced(entryPath, 'source', () => broadcast(entryPath, 'source-updated', { at: Date.now() }));
    };
    for (const watcher of await watchTree(absDir, onChange)) w.watchers.push(watcher);
    if (w.watchers.length === 0) log(`Preview: can't watch ${entryDir}; reload by hand.`);
    // Files the entry references outside its own folder (`../shared.css`).
    try {
      const html = await fs.readFile(path.join(workspaceRoot, entryPath), 'utf8');
      const outside = new Map<string, Set<string>>();
      for (const ref of extractHtmlReferences(html)) {
        const resolved = resolveReferencedPath(ref, entryDir);
        if (!resolved || resolved.startsWith('..') || resolved.startsWith(`${entryDir}/`)) continue;
        const dir = path.posix.dirname(resolved);
        if (!outside.has(dir)) outside.set(dir, new Set());
        outside.get(dir)!.add(path.posix.basename(resolved));
      }
      for (const [dir, names] of outside) {
        try {
          w.watchers.push(
            watch(path.join(workspaceRoot, dir), (_e, f) => {
              if (!f || names.has(String(f))) debounced(entryPath, 'source', () => broadcast(entryPath, 'source-updated', { at: Date.now() }));
            }),
          );
        } catch {
          // A referenced folder that doesn't exist yet.
        }
      }
    } catch {
      // The entry can't be read; its folder is still watched.
    }
    return w;
  };

  const unwatchIfIdle = (entryPath: string): void => {
    const w = watches.get(entryPath);
    if (!w || w.clients.size > 0) return;
    for (const watcher of w.watchers) watcher.close();
    for (const timer of w.timers.values()) clearTimeout(timer);
    watches.delete(entryPath);
  };

  const offChecks = onCheckRunSaved((saved) => {
    if (path.resolve(saved.workspaceRoot) !== workspaceRoot) return;
    broadcast(saved.run.entryPath.replace(/\\/g, '/'), 'checks-updated', { runId: saved.run.id });
  });

  // ── Shell origin ─────────────────────────────────────────────────────────
  let shellOrigin = '';
  const shellPrefix = `/${shellToken}/`;

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    // DNS rebinding: only our own loopback host names.
    const host = req.headers.host ?? '';
    const port = shellOrigin.split(':').pop();
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) throw new HttpError(403, 'Unexpected host.');
    if ((options.rootRedirect || options.rootLatest) && url.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      const latest = options.rootLatest ? await newestEntry(workspaceRoot, outputDir) : undefined;
      res.writeHead(302, { Location: latest ? `${shellPrefix}?entry=${encodeURIComponent(latest)}` : shellPrefix, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    if (!url.pathname.startsWith(shellPrefix) && url.pathname !== shellPrefix.slice(0, -1)) throw new HttpError(404, 'Not found.');
    const route = url.pathname.slice(shellPrefix.length - 1) || '/';
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      // Writes only from the shell's own pages.
      if (req.headers.origin !== shellOrigin) throw new HttpError(403, 'Writes are accepted only from the preview shell.');
    }
    const entryParam = url.searchParams.get('entry');

    if (method === 'GET' && route === '/') {
      const body = Buffer.from(renderShellPage({ entryPath: entryParam ?? undefined, designOrigin: new URL(design.baseUrl).origin }), 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src ${new URL(design.baseUrl).origin}; base-uri 'none'; form-action 'none'`,
      });
      res.end(body);
      return;
    }
    if (method === 'GET' && route === '/shell.js') {
      const body = Buffer.from(options.assets.shellJs, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
      res.end(body);
      return;
    }
    if (method === 'GET' && route === '/api/artifacts') {
      const found = await scanArtifactManifests(workspaceRoot, outputDir);
      const list = found
        .filter((a) => ENTRY_EXT.test(a.entryPath))
        .map((a) => ({ entryPath: a.entryPath, title: typeof a.manifest.title === 'string' ? a.manifest.title : a.entryPath, kind: typeof a.manifest.kind === 'string' ? a.manifest.kind : undefined }))
        .sort((a, b) => a.entryPath.localeCompare(b.entryPath));
      sendJson(res, 200, { artifacts: list });
      return;
    }
    if (method === 'GET' && route === '/api/state') {
      const entryPath = await resolveEntry(entryParam);
      const manifest = JSON.parse(await fs.readFile(path.join(workspaceRoot, `${entryPath}.artifact.json`), 'utf8').catch(() => '{}')) as { title?: unknown };
      sendJson(res, 200, {
        entryPath,
        title: typeof manifest.title === 'string' ? manifest.title : entryPath,
        designUrl: urlForPath(design.baseUrl, entryPath),
        comments: await readArtifactComments(workspaceRoot, entryPath),
        cropSupport: await cropSupport(),
      });
      return;
    }
    if (method === 'POST' && route === '/api/comments') {
      const entryPath = await resolveEntry(entryParam);
      const body = (await readBody(req, MAX_COMMENTS_BODY)) as { changed?: unknown; deletedIds?: unknown } | null;
      const changed = Array.isArray(body?.changed) ? (body!.changed as ArtifactComment[]).filter((c) => c && typeof c.id === 'string' && /^[\w-]{1,64}$/.test(c.id)) : [];
      const deletedIds = Array.isArray(body?.deletedIds) ? (body!.deletedIds as unknown[]).filter((id): id is string => typeof id === 'string') : [];
      const comments = await mergeArtifactComments(workspaceRoot, entryPath, changed, deletedIds);
      sendJson(res, 200, { comments });
      return;
    }
    if (method === 'POST' && route === '/api/crop') {
      const entryPath = await resolveEntry(entryParam);
      const body = (await readBody(req, MAX_SMALL_BODY)) as { commentId?: unknown; element?: unknown; stage?: unknown; docRect?: unknown; viewport?: unknown } | null;
      const commentId = typeof body?.commentId === 'string' && /^[\w-]{1,64}$/.test(body.commentId) ? body.commentId : undefined;
      if (!commentId) throw new HttpError(400, 'Missing commentId.');
      if (!(await readArtifactComments(workspaceRoot, entryPath)).some((c) => c.id === commentId)) throw new HttpError(404, 'No such comment.');
      let png: Buffer | undefined;
      let rerendered = false;
      if (window?.isOpen() && isBox(body?.element) && isBox(body?.stage)) {
        png = await captureWindowCrop(window.page, body!.element as Box, body!.stage as Box).catch((err) => {
          log(`Preview: window crop failed (${err instanceof Error ? err.message : String(err)}); re-rendering.`);
          return undefined;
        });
      }
      const vp = body?.viewport as { width?: unknown; height?: unknown } | undefined;
      if (!png && isBox(body?.docRect) && typeof vp?.width === 'number' && typeof vp?.height === 'number') {
        png = await captureRerenderedCrop({ workspaceRoot, entryPath, docRect: body!.docRect as Box, viewport: { width: vp.width, height: vp.height }, browserPath: options.browserPath }).catch((err) => {
          log(`Preview: headless crop failed (${err instanceof Error ? err.message : String(err)}).`);
          return undefined;
        });
        rerendered = !!png;
      }
      if (!png) {
        sendJson(res, 200, { comment: undefined, reason: 'No Chrome, Edge or Chromium is available for the screenshot; the comment was saved without one.' });
        return;
      }
      await writeCommentCrop(workspaceRoot, entryPath, commentId, png);
      const screenshot = commentCropRelPath(entryPath, commentId);
      const now = new Date().toISOString();
      let updated: ArtifactComment | undefined;
      await updateArtifactComments(workspaceRoot, entryPath, (current) =>
        current.map((c) => (c.id === commentId ? (updated = { ...c, screenshot, ...(rerendered ? { screenshotRerendered: true } : {}), updatedAt: now }) : c)),
      );
      sendJson(res, 200, { comment: updated });
      return;
    }
    if (method === 'GET' && route === '/api/crop-image') {
      const entryPath = await resolveEntry(entryParam);
      const png = await readCommentCrop(workspaceRoot, entryPath, url.searchParams.get('id') ?? '');
      if (!png) throw new HttpError(404, 'No screenshot.');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length, 'Cache-Control': 'no-store' });
      res.end(png);
      return;
    }
    if (method === 'GET' && route === '/api/checks') {
      const entryPath = await resolveEntry(entryParam);
      const manifest = JSON.parse(await fs.readFile(path.join(workspaceRoot, `${entryPath}.artifact.json`), 'utf8').catch(() => '{}')) as unknown;
      sendJson(res, 200, { runs: await listCheckRuns(workspaceRoot, outputDir, entryPath), critique: readCritique(manifest) });
      return;
    }
    if (method === 'GET' && route === '/api/check-image') {
      const entryPath = await resolveEntry(entryParam);
      const jpg = await readCheckRunImage(workspaceRoot, outputDir, entryPath, url.searchParams.get('run') ?? '', url.searchParams.get('file') ?? '');
      if (!jpg) throw new HttpError(404, 'No such image.');
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': jpg.length, 'Cache-Control': 'no-store' });
      res.end(jpg);
      return;
    }
    if (method === 'GET' && route === '/events') {
      const entryPath = await resolveEntry(entryParam);
      const w = await watchEntry(entryPath);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      w.clients.add(res);
      const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => {
        clearInterval(keepAlive);
        w.clients.delete(res);
        unwatchIfIdle(entryPath);
      });
      return;
    }
    throw new HttpError(404, 'Not found.');
  };

  const shell = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) log(`Preview: ${req.method} ${req.url?.replace(shellToken, '<token>')} failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) sendJson(res, status, { error: err instanceof Error ? err.message : String(err) });
      else res.end();
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      shell.once('error', reject);
      shell.listen(options.port ?? 0, '127.0.0.1', () => resolve());
    });
  } catch (err) {
    await design.close();
    throw err;
  }
  const { port } = shell.address() as AddressInfo;
  shellOrigin = `http://127.0.0.1:${port}`;
  const shellBaseUrl = `${shellOrigin}${shellPrefix}`;

  return {
    shellBaseUrl,
    designBaseUrl: design.baseUrl,
    urlFor: (entryPath) => (entryPath ? `${shellBaseUrl}?entry=${encodeURIComponent(entryPath.replace(/\\/g, '/'))}` : shellBaseUrl),
    setWindow: (w) => {
      window = w;
    },
    getWindow: () => (window?.isOpen() ? window : undefined),
    close: async () => {
      offChecks();
      for (const [entryPath, w] of watches) {
        for (const res of w.clients) res.end();
        w.clients.clear();
        unwatchIfIdle(entryPath);
      }
      await new Promise<void>((resolve) => {
        shell.closeAllConnections?.();
        shell.close(() => resolve());
      });
      await design.close();
      await window?.close().catch(() => undefined);
    },
  };
}
