// Route B of "get an artifact into Canva" (openspec canva-upload-from-server):
// the server, which runs where the export is and has the network, POSTs the
// export's raw bytes to the single-use URL Canva's create-upload-url returned.
// The agent no longer needs its own shell, which Claude Desktop Chat may not
// have ready (or able to see the file). This is the only place our code talks
// to Canva, and only to a canva.com URL the agent got from Canva itself.
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isExportOfEntry } from '../export/exportArtifact';

export interface CanvaUploadOptions {
  workspaceRoot: string;
  /** The artifact's entry file, workspace-relative; the file must be in its exports/ folder. */
  entryPath: string;
  /** The exported file, workspace-relative, as export_open_design_artifact returned it. */
  filePath: string;
  /** The single-use upload URL from Canva's create-upload-url. */
  uploadUrl: string;
  /** For tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface CanvaUploadResult {
  ok: boolean;
  text: string;
  fileId?: string;
}

/** True for an https URL on canva.com or one of its subdomains. */
export function isCanvaUploadUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:' && !url.username && !url.password && (host === 'canva.com' || host.endsWith('.canva.com'));
}

const RETRY = "Call Canva's `create-upload-url` again for a fresh URL and pass that; never retry the same URL.";

export async function uploadToCanva(options: CanvaUploadOptions): Promise<CanvaUploadResult> {
  if (!isCanvaUploadUrl(options.uploadUrl)) {
    return { ok: false, text: "uploadUrl must be the https canva.com URL that Canva's `create-upload-url` returned. Nothing was uploaded." };
  }
  const exportsDir = path.posix.join(path.posix.dirname(options.entryPath.replace(/\\/g, '/')), 'exports');
  const rel = path.posix.normalize(options.filePath.replace(/\\/g, '/'));
  if (!isExportOfEntry(options.entryPath, rel)) {
    return { ok: false, text: `filePath ${options.filePath} is not in this artifact's exports folder (${exportsDir}/). Export the file first with export_open_design_artifact, then pass the path it returned. Nothing was uploaded.` };
  }
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(path.join(options.workspaceRoot, rel));
  } catch {
    return { ok: false, text: `${rel} doesn't exist. Export it first with export_open_design_artifact. Nothing was uploaded.` };
  }

  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(options.uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, text: `Couldn't reach Canva from this machine (${message}). ${RETRY} If it fails the same way, tell the user and offer route C (manual import).` };
  }
  const body = await response.text().catch(() => '');
  if (!response.ok) {
    return { ok: false, text: `Canva refused the upload (HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}). The URL may be used or expired. ${RETRY}` };
  }
  let fileId: string | undefined;
  try {
    const parsed = JSON.parse(body) as { fileId?: unknown };
    if (typeof parsed.fileId === 'string') fileId = parsed.fileId;
  } catch {
    // Canva answered 2xx without JSON: the bytes arrived, but there's no id to report.
  }
  return {
    ok: true,
    fileId,
    text: `Uploaded ${rel} (${bytes.length} bytes) to the user's Canva Uploads${fileId ? ` (fileId ${fileId})` : ''}. Tell the user it's in their Canva **Uploads** and that opening it there turns it into an editable design. Don't claim a design was created.`,
  };
}
