// The campaign sheet's sidecar (openspec add-mcp-app-pickers, campaign-kit
// "Campaign Collection and Sheet"): exports/campaign-sheet.json lists the
// sheet's tiles in order, so the inline campaign view and the agent read the
// same facts as campaign-sheet.png. Each tile's image is written next to it.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Finding } from '../poster/preflight';

export const CAMPAIGN_SHEET_FILE = 'campaign-sheet.png';
export const CAMPAIGN_SHEET_SIDECAR_FILE = 'campaign-sheet.json';
const TILES_DIR = 'campaign-sheet-tiles';

export interface CampaignSheetTile {
  label: string;
  /** A shape of the master: its preset id (absent for the master's default size). */
  shape?: string;
  /** Another piece of the master's collection. */
  entryPath?: string;
  /** The exported file this tile shows, when the export wrote one (sheet-only shapes have none). */
  file?: string;
  /** The tile's image as drawn on the sheet, workspace-relative. */
  image?: string;
  errors: Array<{ check: string; message: string }>;
}

export interface CampaignSheetSidecar {
  version: 1;
  /** The master's entry path. */
  master: string;
  title?: string;
  /** Workspace-relative path of campaign-sheet.png. */
  sheet: string;
  createdAt: string;
  tiles: CampaignSheetTile[];
}

/** The master's exports folder, workspace-relative, posix. */
export function campaignExportsDir(masterEntryPath: string): string {
  return path.posix.join(path.posix.dirname(masterEntryPath.split(path.sep).join('/')), 'exports');
}

export function campaignSheetPaths(masterEntryPath: string): { sheet: string; sidecar: string } {
  const dir = campaignExportsDir(masterEntryPath);
  return { sheet: path.posix.join(dir, CAMPAIGN_SHEET_FILE), sidecar: path.posix.join(dir, CAMPAIGN_SHEET_SIDECAR_FILE) };
}

/** Error findings only, as the sheet's red dot counts them. */
export function tileErrors(findings: readonly Finding[]): CampaignSheetTile['errors'] {
  return findings.filter((f) => f.severity === 'error').map((f) => ({ check: f.check, message: f.message }));
}

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tile'
  );
}

/** Writes each tile's image and the sidecar; `images[i]` belongs to `tiles[i]`. Stale tile images from an earlier export are removed. */
export async function writeCampaignSheetSidecar(input: {
  workspaceRoot: string;
  master: string;
  title?: string;
  tiles: Omit<CampaignSheetTile, 'image'>[];
  images: Array<{ data: Buffer; mime?: string }>;
  createdAt?: string;
}): Promise<CampaignSheetSidecar> {
  const { sheet, sidecar } = campaignSheetPaths(input.master);
  const tilesDir = path.posix.join(campaignExportsDir(input.master), TILES_DIR);
  await fs.rm(path.join(input.workspaceRoot, tilesDir), { recursive: true, force: true });
  await fs.mkdir(path.join(input.workspaceRoot, tilesDir), { recursive: true });
  const tiles: CampaignSheetTile[] = [];
  for (const [i, tile] of input.tiles.entries()) {
    const img = input.images[i];
    const out: CampaignSheetTile = { ...tile };
    if (img) {
      const ext = img.mime === 'image/jpeg' ? 'jpg' : 'png';
      out.image = path.posix.join(tilesDir, `${String(i + 1).padStart(2, '0')}-${slug(tile.shape ?? tile.label)}.${ext}`);
      await fs.writeFile(path.join(input.workspaceRoot, out.image), img.data);
    }
    tiles.push(out);
  }
  const doc: CampaignSheetSidecar = { version: 1, master: input.master, title: input.title, sheet, createdAt: input.createdAt ?? new Date().toISOString(), tiles };
  await fs.writeFile(path.join(input.workspaceRoot, sidecar), JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

/** The sidecar next to a master's campaign sheet, or undefined when there is none (or it is unreadable). */
export async function readCampaignSheetSidecar(workspaceRoot: string, masterEntryPath: string): Promise<CampaignSheetSidecar | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(workspaceRoot, campaignSheetPaths(masterEntryPath).sidecar), 'utf8')) as Partial<CampaignSheetSidecar>;
    if (raw?.version !== 1 || !Array.isArray(raw.tiles)) return undefined;
    const tiles = raw.tiles
      .filter((t): t is CampaignSheetTile => !!t && typeof t.label === 'string')
      .map((t) => ({ ...t, errors: Array.isArray(t.errors) ? t.errors.filter((e) => e && typeof e.check === 'string' && typeof e.message === 'string') : [] }));
    return { ...(raw as CampaignSheetSidecar), tiles };
  } catch {
    return undefined;
  }
}
