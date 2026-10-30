// The preview MCP App's picker views (openspec add-mcp-app-pickers): the
// remixable-example gallery, the design-system tiles and the campaign sheet.
// The show tools return only a target; the page reads everything here through
// the app-only get_open_design_preview_state, one page or one preview a call.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ContentIndex, DesignSystemDetail, SkillSummary } from '../../content/contentIndex';
import { galleryHubUrl } from '../../content/gallerySite';
import { readCampaignSheetSidecar, campaignSheetPaths } from '../../export/campaignSheet';
import { normalizeWorkspacePath, workspaceAssetReader } from '../../export/workspaceAssets';
import { isSafeCssValue, resolveTokenValue } from '../../generation/designSystemTokens';
import { renderDesignSystemPreviewTab, resolveDesignSystemDetailTokens, designSystemDisplaySummary } from '../../generation/designSystemPreview';
import { extractColors } from '../../vendored/designSystemShowcase';
import { bundleStandaloneHtml } from '../../vendored/standaloneHtml';
import {
  PREVIEW_APP_EXAMPLES_PAGE_SIZE,
  PREVIEW_APP_MAX_HTML_BYTES,
  PREVIEW_APP_MAX_TILE_IMAGE_BYTES,
  type DesignSystemFilters,
  type ExampleFilters,
  type PreviewAppCampaignState,
  type PreviewAppDesignSystemPreview,
  type PreviewAppDesignSystemsState,
  type PreviewAppDesignSystemTile,
  type PreviewAppExamplePreview,
  type PreviewAppExamplesState,
} from '../mcpApp/protocol';

const MiB = 1024 * 1024;

// ── Examples ──────────────────────────────────────────────────────────────

/** Remixable, non-stub examples matching the filters: a surface's entries, else the catalog filtered by query and mode. */
export async function matchingExamples(index: ContentIndex, filters: ExampleFilters): Promise<{ ok: true; examples: SkillSummary[] } | { ok: false; message: string }> {
  let pool: SkillSummary[];
  const surface = filters.surface?.trim();
  if (surface) {
    const entries = await index.surfaceEntries(surface);
    if (!entries) {
      const valid = (await index.listSurfaces()).map((s) => s.id);
      return { ok: false, message: `Unknown surface "${surface}". Valid surfaces: ${valid.join(', ')}.` };
    }
    const query = filters.query?.trim().toLowerCase();
    pool = entries.filter((s) => !query || [s.id, s.name, s.description, ...s.triggers].some((v) => v.toLowerCase().includes(query)));
  } else {
    pool = await index.listSkills(filters.query, undefined, undefined, true);
  }
  return { ok: true, examples: pool.filter((s) => !!s.exampleArtifactPath && !s.stub) };
}

function oneLine(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** One page of the gallery, at most PREVIEW_APP_EXAMPLES_PAGE_SIZE cards. `cursor` is the offset a previous page returned. */
export async function buildExamplesState(index: ContentIndex, input: ExampleFilters & { title?: string; cursor?: string }): Promise<{ ok: true; state: PreviewAppExamplesState } | { ok: false; message: string }> {
  const matched = await matchingExamples(index, input);
  if (!matched.ok) return matched;
  const mode = input.mode?.trim().toLowerCase();
  const modes = [...new Set(matched.examples.map((s) => s.mode))].sort();
  const filtered = mode ? matched.examples.filter((s) => s.mode === mode) : matched.examples;
  const offset = Math.max(0, Number.parseInt(input.cursor ?? '0', 10) || 0);
  const page = filtered.slice(offset, offset + PREVIEW_APP_EXAMPLES_PAGE_SIZE);
  const filters: ExampleFilters = {};
  if (input.query) filters.query = input.query;
  if (mode) filters.mode = mode;
  if (input.surface) filters.surface = input.surface;
  const gallery = await index.getLiveGallery();
  return {
    ok: true,
    state: {
      view: 'examples',
      title: input.title ?? 'Examples to remix',
      filters,
      modes,
      examples: page.map((s) => ({ id: s.id, name: s.name, mode: s.mode, summary: oneLine(s.description) })),
      total: filtered.length,
      nextCursor: offset + page.length < filtered.length ? String(offset + page.length) : undefined,
      ...(gallery ? { galleryUrl: galleryHubUrl(gallery, 'examples', filters.query) } : {}),
    },
  };
}

export type ExamplePreviewResult = { ok: true; preview: PreviewAppExamplePreview; externalDependencies: string[] } | { ok: false; message: string };

/** One example card's preview: the bundled example.html with its assets inlined, view only; text in place of one over the size cap. */
export async function buildExamplePreview(index: ContentIndex, assetsRoot: string, exampleId: string): Promise<ExamplePreviewResult> {
  const skill = await index.getSkill(exampleId);
  if (!skill?.exampleArtifactPath) return { ok: false, message: `No remixable example "${exampleId}".` };
  const entryPath = normalizeWorkspacePath(skill.exampleArtifactPath);
  if (!entryPath) return { ok: false, message: `The example "${exampleId}" has an invalid path.` };
  try {
    const html = await fs.readFile(path.join(assetsRoot, entryPath), 'utf8');
    const bundled = await bundleStandaloneHtml({ entryPath, html, readAsset: workspaceAssetReader(assetsRoot) });
    const bytes = Buffer.byteLength(bundled.html, 'utf8');
    if (bytes > PREVIEW_APP_MAX_HTML_BYTES) {
      return { ok: true, preview: { exampleId, fallback: `${skill.name} is ${(bytes / MiB).toFixed(1)} MiB with its files inlined, too large to preview here.` }, externalDependencies: [] };
    }
    return { ok: true, preview: { exampleId, html: bundled.html }, externalDependencies: bundled.externalDependencies };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The bundler refuses an entry or asset over its own limits before the 5 MiB check is reached.
    const fallback = /limit exceeded/i.test(message) ? `${skill.name} is too large to preview here.` : `No preview (${message}).`;
    return { ok: true, preview: { exampleId, fallback }, externalDependencies: [] };
  }
}

const LOADED_URL_PATTERNS = [
  /<(?:script|img|link|source|video|audio|iframe|image)\b[^>]*?\s(?:src|href|poster)\s*=\s*["']((?:https?:)?\/\/[^"']+)/gi,
  /url\(\s*["']?((?:https?:)?\/\/[^)"'\s]+)/gi,
  /@import\s+["']((?:https?:)?\/\/[^"']+)/gi,
];

/** Absolute URLs an example page loads (scripts, styles, images, fonts), read from its HTML without bundling it. */
export function loadedUrls(html: string): string[] {
  const out: string[] = [];
  for (const pattern of LOADED_URL_PATTERNS) for (const m of html.matchAll(pattern)) out.push(m[1]);
  return out;
}

/** Every URL the remixable examples load, for the resource's CSP: the gallery shows them before any one is bundled. */
export async function exampleRemoteUrls(index: ContentIndex, assetsRoot: string): Promise<string[]> {
  const urls = new Set<string>();
  for (const s of await index.listSkills(undefined, undefined, undefined, true)) {
    const rel = s.exampleArtifactPath ? normalizeWorkspacePath(s.exampleArtifactPath) : undefined;
    if (!rel) continue;
    try {
      loadedUrls(await fs.readFile(path.join(assetsRoot, rel), 'utf8')).forEach((u) => urls.add(u));
    } catch {
      // A missing example is reported when its card asks for it.
    }
  }
  return [...urls];
}

/** The text a host without MCP Apps gets from show_open_design_examples. */
export function examplesFallbackText(examples: SkillSummary[], limit = 12): string {
  if (examples.length === 0) return 'No remixable examples match. Call list_open_design_skills with remixableOnly: true to browse them all.';
  const lines = examples.slice(0, limit).map((s) => `- ${s.id}: ${s.name}`);
  const more = examples.length > limit ? `\n…and ${examples.length - limit} more.` : '';
  return `This host doesn't show MCP Apps inline. ${examples.length} remixable examples match:\n${lines.join('\n')}${more}\n\nCall list_open_design_skills with remixableOnly: true (and the same query or surface) for details, then remix_open_design_example with the chosen skillId.`;
}

// ── Design systems ────────────────────────────────────────────────────────

const SWATCH_TOKENS = ['--bg', '--fg', '--accent', '--surface', '--muted'];

function firstFamily(stack: string | undefined): string | undefined {
  const first = stack?.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
  return first && !first.includes('var(') ? first : undefined;
}

/** A tile from the system's tokens; a system without tokens.css adds its DESIGN.md colors where the tokens were guessed. */
export function designSystemTile(detail: DesignSystemDetail, activeId: string | undefined): PreviewAppDesignSystemTile {
  const resolved = resolveDesignSystemDetailTokens(detail);
  const swatches: string[] = [];
  const add = (value: string | undefined): void => {
    if (value && !value.includes('var(') && isSafeCssValue(value) && !swatches.includes(value) && swatches.length < 5) swatches.push(value);
  };
  if (detail.tokensCss) SWATCH_TOKENS.forEach((name) => add(resolveTokenValue(resolved.tokens, name)));
  else {
    extractColors(detail.body).forEach((c) => add(c.value));
    SWATCH_TOKENS.forEach((name) => add(resolveTokenValue(resolved.tokens, name)));
  }
  return {
    id: detail.id,
    name: detail.name,
    category: detail.category,
    summary: oneLine(designSystemDisplaySummary(detail)),
    active: detail.id === activeId,
    swatches,
    displayFont: firstFamily(resolveTokenValue(resolved.tokens, '--font-display')),
    bodyFont: firstFamily(resolveTokenValue(resolved.tokens, '--font-body')),
  };
}

/** The tiles: a shortlist by `ids` in that order, else every system matching query and category. */
export async function buildDesignSystemsState(index: ContentIndex, activeId: string | undefined, input: DesignSystemFilters & { title?: string }): Promise<PreviewAppDesignSystemsState> {
  const details: DesignSystemDetail[] = [];
  const unknownIds: string[] = [];
  if (input.ids?.length) {
    for (const id of input.ids) {
      const detail = await index.getDesignSystem(id);
      if (detail) details.push(detail);
      else unknownIds.push(id);
    }
  } else {
    for (const s of await index.listDesignSystems(input.query, input.category)) {
      const detail = await index.getDesignSystem(s.id);
      if (detail) details.push(detail);
    }
  }
  const filters: DesignSystemFilters = {};
  if (input.ids?.length) filters.ids = input.ids;
  else {
    if (input.query) filters.query = input.query;
    if (input.category) filters.category = input.category;
  }
  const state: PreviewAppDesignSystemsState = { view: 'design-systems', title: input.title ?? 'Design systems', filters, systems: details.map((d) => designSystemTile(d, activeId)) };
  if (unknownIds.length) state.unknownIds = unknownIds;
  const gallery = await index.getLiveGallery();
  if (gallery) state.galleryUrl = galleryHubUrl(gallery, 'design-systems', filters.query);
  return state;
}

/** A system's Visualize page, the script-free page VS Code shows. */
export async function buildDesignSystemPreview(index: ContentIndex, designSystemId: string): Promise<{ ok: true; preview: PreviewAppDesignSystemPreview } | { ok: false; message: string }> {
  const detail = await index.getDesignSystem(designSystemId);
  if (!detail) return { ok: false, message: `No design system "${designSystemId}".` };
  return { ok: true, preview: { designSystemId, html: renderDesignSystemPreviewTab(detail, 'visualize') } };
}

/** The text a host without MCP Apps gets from show_open_design_design_systems. */
export function designSystemsFallbackText(state: PreviewAppDesignSystemsState, limit = 20): string {
  const missing = state.unknownIds?.length ? `\nUnknown ids: ${state.unknownIds.join(', ')}.` : '';
  if (state.systems.length === 0) return `No design systems match.${missing} Call list_open_design_design_systems to browse them.`;
  const lines = state.systems.slice(0, limit).map((s) => `- ${s.id}: ${s.name}${s.category ? ` (${s.category})` : ''}${s.active ? ' [active]' : ''}`);
  const more = state.systems.length > limit ? `\n…and ${state.systems.length - limit} more.` : '';
  return `This host doesn't show MCP Apps inline. ${state.systems.length} design systems match:\n${lines.join('\n')}${more}${missing}\n\nCall list_open_design_design_systems for summaries, then set_active_design_system with the chosen id.`;
}

// ── Campaign ──────────────────────────────────────────────────────────────

const IMAGE_MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function imageDataUrl(workspaceRoot: string, relPath: string | undefined, cap: number): Promise<string | undefined> {
  const rel = relPath ? normalizeWorkspacePath(relPath) : undefined;
  const mime = rel ? IMAGE_MIME[path.extname(rel).toLowerCase()] : undefined;
  if (!rel || !mime) return undefined;
  try {
    const abs = path.join(workspaceRoot, rel);
    if ((await fs.stat(abs)).size > cap) return undefined;
    return `data:${mime};base64,${(await fs.readFile(abs)).toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** The campaign view: the sidecar's tiles with their images, else campaign-sheet.png, else a request for an export. */
export async function buildCampaignState(input: { workspaceRoot: string; entryPath: string; title: string }): Promise<PreviewAppCampaignState> {
  const base = { view: 'campaign' as const, entryPath: input.entryPath, title: input.title };
  const sidecar = await readCampaignSheetSidecar(input.workspaceRoot, input.entryPath);
  if (sidecar) {
    const tiles = await Promise.all(
      sidecar.tiles.map(async (t) => {
        const image = (await imageDataUrl(input.workspaceRoot, t.image, PREVIEW_APP_MAX_TILE_IMAGE_BYTES)) ?? (await imageDataUrl(input.workspaceRoot, t.file, PREVIEW_APP_MAX_TILE_IMAGE_BYTES));
        return { label: t.label, shape: t.shape, entryPath: t.entryPath, file: t.file, image, errors: t.errors };
      }),
    );
    return { ...base, tiles };
  }
  const sheetImage = await imageDataUrl(input.workspaceRoot, campaignSheetPaths(input.entryPath).sheet, PREVIEW_APP_MAX_HTML_BYTES);
  if (sheetImage) return { ...base, tiles: [], sheetImage, message: 'This sheet was exported before the export listed its tiles. Export again with campaignSheet: true to get clickable tiles.' };
  return { ...base, tiles: [], message: 'No campaign sheet yet. Ask Claude to export the master with campaignSheet: true.' };
}

/** show_open_design_artifact's text for `campaign: true`: the tiles and their errors, so a text-only host has the same facts. */
export async function campaignShowText(workspaceRoot: string, entryPath: string, title: string): Promise<string> {
  const sidecar = await readCampaignSheetSidecar(workspaceRoot, entryPath);
  if (!sidecar) {
    const { sheet } = campaignSheetPaths(entryPath);
    const hasSheet = await fs.stat(path.join(workspaceRoot, sheet)).then(
      () => true,
      () => false,
    );
    return hasSheet
      ? `Showing the campaign sheet of "${title}" (${sheet}). It has no tile list yet; export again with campaignSheet: true for one.`
      : `"${title}" has no campaign sheet yet. Call export_open_design_artifact with campaignSheet: true first.`;
  }
  const lines = [`Showing the campaign sheet of "${title}" (${sidecar.sheet}), ${sidecar.tiles.length} tiles:`];
  for (const t of sidecar.tiles) {
    const what = t.entryPath ? t.entryPath : `shape ${t.shape ?? 'default'}`;
    lines.push(`- ${t.label} (${what}): ${t.errors.length ? t.errors.map((e) => `${e.check}: ${e.message}`).join('; ') : 'no errors'}`);
  }
  return lines.join('\n');
}
