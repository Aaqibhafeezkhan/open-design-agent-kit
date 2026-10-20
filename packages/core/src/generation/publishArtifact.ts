// The publish_open_design_artifact tool, shared by the VS Code and MCP
// hosts. Two modes:
//  - prepare (no `published`): builds the `site` bundle, then composes the
//    staged publish instructions for the chosen (or to-be-chosen) provider;
//    for `claude-artifact`, builds the `standalone` file instead, runs the
//    artifact preflight, and composes publish-by-path instructions for the
//    model's own Artifact tool (openspec add-claude-artifact-provider);
//  - record (`published` given): validates what the model reports after a
//    deploy and stores it in the manifest's `metadata.shares`.
// Never runs a provider command, never makes a network request.
// openspec: add-artifact-sharing.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { artifactPreflight } from '../export/artifactPreflight';
import { declaredRemoteAssets, type BinaryFetch } from '../export/embedAssets';
import { exportArtifact, formatExportResult } from '../export/exportArtifact';
import { readArtifact, writeArtifactManifest } from '../vendored/artifactCreate';
import {
  CLAUDE_ARTIFACT_PROVIDER,
  isExpired,
  isHostingProvider,
  isPublishProvider,
  latestShareFor,
  PUBLISH_PROVIDERS,
  readShareRecords,
  upsertShareRecord,
  validatePublished,
  type PublishedInput,
  type ShareRecord,
} from '../workspace/shareRecords';
import { composeArtifactPublishInstructions, composePublishInstructions, siteNameForShare, slugForShare } from './publishInstructions';
import { PUBLISH_RECIPES, publishProviderLabel } from './publishProviders';

export interface PublishArtifactOptions {
  workspaceRoot: string;
  entryPath: string;
  provider?: string;
  badge?: boolean;
  /** Host setting (VS Code `openDesign.share.badge`). */
  badgeSetting?: boolean;
  /**
   * Workspace paths of files in the artifact's own exports/ folder (e.g. an
   * exported PDF) to host alongside the page, at files/<name> in the bundle
   * (openspec connect-canva-publish).
   */
  includeFiles?: string[];
  published?: PublishedInput;
  now?: Date;
  /** Tests: the downloader for claude-artifact's embedded assets. */
  assetFetch?: BinaryFetch;
}

export type PublishArtifactResult = { ok: boolean; text: string };

export async function publishArtifact(options: PublishArtifactOptions): Promise<PublishArtifactResult> {
  const now = options.now ?? new Date();
  if (options.provider !== undefined && !isPublishProvider(options.provider)) {
    return { ok: false, text: `Unknown provider "${options.provider}". Use one of: ${PUBLISH_PROVIDERS.join(', ')}.` };
  }

  let artifact;
  try {
    artifact = await readArtifact({ workspaceRoot: options.workspaceRoot, entryPath: options.entryPath });
  } catch (err) {
    return { ok: false, text: err instanceof Error ? err.message : String(err) };
  }
  if (!artifact) return { ok: false, text: `No artifact entry file found at ${options.entryPath}.` };
  if (!artifact.manifest) {
    return { ok: false, text: `${options.entryPath} exists but isn't registered (no .artifact.json sidecar). Call register_open_design_artifact first.` };
  }
  const manifest = artifact.manifest;
  const title = typeof manifest.title === 'string' ? manifest.title : undefined;

  if (options.published) {
    const validated = validatePublished(options.published, now);
    if (!validated.ok) return { ok: false, text: `Not recorded (invalid-args): ${validated.error}` };
    const { record } = validated;
    try {
      await writeArtifactManifest({
        workspaceRoot: options.workspaceRoot,
        entryPath: options.entryPath,
        artifactManifest: { ...manifest, metadata: upsertShareRecord(manifest.metadata, record) },
      });
    } catch (err) {
      return { ok: false, text: `Couldn't record the share in the manifest: ${err instanceof Error ? err.message : String(err)}` };
    }
    const lines = [`Recorded: ${options.entryPath} is published on ${publishProviderLabel(record.provider)} at ${record.url}.`];
    if (record.expiresAt) lines.push(`It expires at ${record.expiresAt} unless claimed.`);
    if (record.claimUrl) lines.push('The claim URL is stored for the user; keep it out of anything posted publicly.');
    return { ok: true, text: lines.join('\n') };
  }

  const records = readShareRecords(manifest);
  if (options.provider === CLAUDE_ARTIFACT_PROVIDER) {
    if (options.includeFiles?.length) {
      return { ok: false, text: 'includeFiles needs a hosted site: a Claude artifact is one page. Give the user the exported files\' paths instead, or pick a hosting provider.\n\nNothing was published.' };
    }
    return prepareArtifact(options, title, records, declaredRemoteAssets(artifact.entryContent).length > 0);
  }

  const included = await resolveIncludedFiles(options.workspaceRoot, options.entryPath, options.includeFiles ?? []);
  if (!included.ok) return { ok: false, text: `${included.error}\n\nNothing was published.` };

  const provider = isHostingProvider(options.provider) ? options.provider : undefined;
  // og:image needs the address the site will be served from: the provider's newest live link.
  const previous = provider ? latestShareFor(records, provider) : undefined;
  const baseUrl = previous && provider && !isExpired(previous, now) && !PUBLISH_RECIPES[provider].temporary ? previous.url : undefined;

  const bundle = await exportArtifact({
    workspaceRoot: options.workspaceRoot,
    entryPath: options.entryPath,
    format: 'site',
    badge: options.badge,
    badgeSetting: options.badgeSetting,
    baseUrl,
  });
  if (!bundle.ok) return { ok: false, text: `${formatExportResult(bundle)}\n\nNothing was published.` };
  if (bundle.mode !== 'site') return { ok: false, text: 'The site export returned an unexpected result. Nothing was published.' };

  for (const f of included.files) {
    const dest = path.join(options.workspaceRoot, bundle.output, f.bundlePath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(options.workspaceRoot, f.sourcePath), dest);
  }
  const site = included.files.length
    ? {
        ...bundle,
        files: [...bundle.files, ...included.files.map((f) => ({ path: f.bundlePath, bytes: f.bytes }))],
        totalBytes: bundle.totalBytes + included.files.reduce((n, f) => n + f.bytes, 0),
      }
    : bundle;

  const slug = slugForShare(title, options.entryPath);
  const text = composePublishInstructions({
    entryPath: options.entryPath,
    title,
    bundle: site,
    bundleDir: path.join(options.workspaceRoot, bundle.output),
    includedFiles: included.files.map((f) => f.bundlePath),
    provider,
    records,
    siteName: siteNameForShare(slug),
    slug,
    today: now.toISOString().slice(0, 10),
  });
  return { ok: true, text };
}

/** claude-artifact: the standalone file, the artifact preflight, then publish-by-path instructions. */
async function prepareArtifact(options: PublishArtifactOptions, title: string | undefined, records: ShareRecord[], declaresAssets: boolean): Promise<PublishArtifactResult> {
  // A page that declares remote assets (a 3D scene's HDRI, textures, models) gets them embedded:
  // the artifact viewer blocks the CDN (openspec embed-3d-assets-for-artifacts).
  const file = await exportArtifact({
    workspaceRoot: options.workspaceRoot,
    entryPath: options.entryPath,
    format: 'standalone',
    badge: options.badge,
    badgeSetting: options.badgeSetting,
    ...(declaresAssets ? { embedAssets: true, assetFetch: options.assetFetch } : {}),
  });
  if (!file.ok) return { ok: false, text: `${formatExportResult(file)}\n\nNothing was published.` };
  if (file.mode !== 'standalone') return { ok: false, text: 'The standalone export returned an unexpected result. Nothing was published.' };
  const filePath = path.join(options.workspaceRoot, file.output);
  const html = await fs.readFile(filePath, 'utf8');
  const preflight = artifactPreflight({
    html,
    bytes: file.totalBytes,
    externalDependencies: file.externalDependencies,
    embeddedUrls: file.embeddedAssets?.map((a) => a.url),
  });
  if (preflight.blocking) {
    const tooLarge = preflight.findings.find((f) => f.code === 'artifact-too-large');
    return { ok: false, text: `Can't publish as a Claude artifact (artifact-too-large): ${tooLarge?.message ?? ''}\n\nNothing was published. The file is at ${file.output}.` };
  }
  const text = composeArtifactPublishInstructions({
    entryPath: options.entryPath,
    title,
    filePath,
    bytes: file.totalBytes,
    badge: file.badge,
    records,
    findings: preflight.findings,
    embedded: file.embeddedAssets,
    // The preflight covers remote references and size, so the export's own notes on them are left out.
    warnings: file.warnings.filter((w) => !w.startsWith('Still loads from another site') && !w.includes('for hosting, the "site" format') && !w.includes('close to the 16.0 MB artifact limit')),
  });
  return { ok: true, text };
}

interface IncludedFile {
  sourcePath: string;
  bundlePath: string;
  bytes: number;
}

/** Checks includeFiles: each must be an existing file in the artifact's exports/ folder (not the site bundle), with a unique name. */
async function resolveIncludedFiles(
  workspaceRoot: string,
  entryPath: string,
  requested: string[],
): Promise<{ ok: true; files: IncludedFile[] } | { ok: false; error: string }> {
  const exportsDir = path.posix.join(path.posix.dirname(entryPath.replace(/\\/g, '/')), 'exports');
  const files: IncludedFile[] = [];
  const names = new Set<string>();
  for (const raw of requested) {
    const rel = path.posix.normalize(raw.replace(/\\/g, '/'));
    if (!rel.startsWith(`${exportsDir}/`) || rel.startsWith(`${exportsDir}/site/`) || rel.includes('/../')) {
      return { ok: false, error: `includeFiles: ${raw} is not in this artifact's exports folder (${exportsDir}/). Export the file first, then pass its path.` };
    }
    const name = path.posix.basename(rel);
    if (names.has(name)) return { ok: false, error: `includeFiles: two files are named ${name}; include only one.` };
    names.add(name);
    let bytes: number;
    try {
      const stat = await fs.stat(path.join(workspaceRoot, rel));
      if (!stat.isFile()) throw new Error('not a file');
      bytes = stat.size;
    } catch {
      return { ok: false, error: `includeFiles: ${raw} doesn't exist. Export it first with export_open_design_artifact.` };
    }
    files.push({ sourcePath: rel, bundlePath: `files/${name}`, bytes });
  }
  return { ok: true, files };
}
