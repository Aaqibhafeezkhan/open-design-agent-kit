// The design critic's last opinion on an artifact: `metadata.critique` in its
// manifest, the latest only (openspec add-design-critic). Written when the
// agent passes `critique` to register_open_design_artifact; read by the
// browser preview's Checks panel and by get_open_design_artifact's critique
// input, which gathers what the critic looks at.
import * as path from 'node:path';
import type { JsonRecord } from '../vendored/artifactManifest';
import { checkRunsDir, listCheckRuns } from '../export/checkHistory';
import { readCritique, validateCritique, type CritiqueRecord } from './critiqueTypes';

export * from './critiqueTypes';

/**
 * The record to store for a `critique` registration input, validated, with
 * `checkRunId` defaulting to the entry's latest saved check run.
 */
export async function prepareCritiqueRecord(workspaceRoot: string, outputDir: string, entryPath: string, input: unknown): Promise<{ ok: true; record: CritiqueRecord } | { ok: false; error: string }> {
  const [latest] = await listCheckRuns(workspaceRoot, outputDir, entryPath);
  return validateCritique(input, { checkRunId: latest?.id });
}

export interface CritiqueInput {
  entryPath: string;
  kind?: string;
  title?: string;
  /** `metadata.brief` when the manifest records one, else undefined (judge from the title and skill id). */
  brief?: unknown;
  sourceSkillId?: string;
  format?: string;
  designSystem?: { id: string; name?: string; designMd?: string };
  /** The latest saved check run, or undefined when there is none yet. */
  checkRun?: {
    id: string;
    dir: string;
    createdAt: string;
    errors: number;
    warnings: number;
    findings: Array<{ severity: string; check: string; message: string }>;
    images: Array<{ label: string; path: string }>;
  };
  lastCritique?: CritiqueRecord;
}

/**
 * What the critic looks at, gathered from the manifest and the latest check
 * run: never the builder's conversation. Image paths are workspace-relative.
 */
export async function buildCritiqueInput(options: {
  workspaceRoot: string;
  outputDir: string;
  entryPath: string;
  manifest: JsonRecord | null;
  designSystem?: { id: string; name?: string; designMd?: string };
}): Promise<CritiqueInput> {
  const { manifest } = options;
  const metadata = manifest?.metadata && typeof manifest.metadata === 'object' && !Array.isArray(manifest.metadata) ? (manifest.metadata as JsonRecord) : {};
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const [run] = await listCheckRuns(options.workspaceRoot, options.outputDir, options.entryPath);
  const dir = checkRunsDir(options.outputDir, options.entryPath);
  return {
    entryPath: options.entryPath,
    kind: str(manifest?.kind),
    title: str(manifest?.title),
    brief: metadata.brief,
    sourceSkillId: str(manifest?.sourceSkillId),
    format: str(metadata.format),
    designSystem: options.designSystem,
    checkRun: run
      ? {
          id: run.id,
          dir: path.posix.join(dir, run.id),
          createdAt: run.createdAt,
          errors: run.errors,
          warnings: run.warnings,
          findings: run.findings,
          images: run.images.map((img) => ({ label: img.label, path: path.posix.join(dir, run.id, img.file) })),
        }
      : undefined,
    lastCritique: readCritique(manifest),
  };
}

