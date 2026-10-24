// Card and sticker printers' file requirements (openspec add-print-house-images):
// the assets root's print-houses.json, read by ContentIndex and used by export
// to write each card face at the exact pixel size a printer asks for.
// packages/content/scripts/printHouses.mjs checks the same file's shape at
// build time; this module adds the checks that need the format catalog.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { bleedBox, getFormat, MM_PER_INCH, type CanvasFormat } from './formats';

export type PrintHouseFileType = 'png' | 'jpeg' | 'pdf';
export type PrintHouseBacks = 'per-card' | 'shared' | 'none';

export interface PrintHouseFormat {
  /** A catalog format id, e.g. "trading-card". */
  format: string;
  /** Exact upload size in px, bleed included (images only). */
  width?: number;
  height?: number;
  type: PrintHouseFileType;
  dpi?: number;
}

export interface PrintHouse {
  id: string;
  label: string;
  url: string;
  /** The printer's own requirements page. */
  source: string;
  checkedAt: string;
  formats: PrintHouseFormat[];
  backs: PrintHouseBacks;
  notes?: string;
}

const TYPES = new Set<string>(['png', 'jpeg', 'pdf']);
const BACKS = new Set<string>(['per-card', 'shared', 'none']);

/** The format's bleed box in px at `dpi`. */
export function bleedBoxPx(format: CanvasFormat, dpi: number, bleed = format.bleed ?? 0): { width: number; height: number } {
  const box = bleedBox(format, bleed);
  return { width: Math.round((box.width / MM_PER_INCH) * dpi), height: Math.round((box.height / MM_PER_INCH) * dpi) };
}

/**
 * Why a printer's size can't be cut from the format's bleed box at its dpi, or undefined when it can: the
 * difference on each side must be at most the bleed (export removes only bleed, never trim).
 */
export function printHouseSizeProblem(format: CanvasFormat, entry: PrintHouseFormat): string | undefined {
  if (entry.type === 'pdf') return undefined;
  if (format.medium !== 'print') return `${format.id} is a screen format; print-house sizes are for print formats`;
  const dpi = entry.dpi ?? 300;
  const box = bleedBoxPx(format, dpi);
  const bleedPx = ((format.bleed ?? 0) / MM_PER_INCH) * dpi;
  const trimW = box.width - 2 * bleedPx;
  const trimH = box.height - 2 * bleedPx;
  const w = entry.width ?? 0;
  const h = entry.height ?? 0;
  if (w < trimW - 1 || h < trimH - 1 || w > box.width + 2 * bleedPx || h > box.height + 2 * bleedPx) {
    return `${w}×${h} px doesn't fit ${format.id} at ${dpi} dpi: the trim is ${Math.round(trimW)}×${Math.round(trimH)} px and the bleed box ${box.width}×${box.height} px`;
  }
  return undefined;
}

/** Parses and checks the catalog: invalid profiles are dropped and reported, so one bad entry never hides the rest. */
export function parsePrintHouses(raw: unknown): { printHouses: PrintHouse[]; problems: string[] } {
  const problems: string[] = [];
  const out: PrintHouse[] = [];
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { printHouses?: unknown }).printHouses) ? (raw as { printHouses: unknown[] }).printHouses : [];
  const ids = new Set<string>();
  for (const item of list) {
    const p = item as Partial<PrintHouse> | null;
    if (!p || typeof p.id !== 'string' || !p.id) {
      problems.push('a print house has no id');
      continue;
    }
    const mine: string[] = [];
    if (ids.has(p.id)) mine.push('id used twice');
    if (typeof p.label !== 'string' || typeof p.url !== 'string' || typeof p.source !== 'string' || typeof p.checkedAt !== 'string') mine.push('needs a label, url, source and checkedAt');
    if (!BACKS.has(String(p.backs))) mine.push('backs must be per-card, shared or none');
    const formats = Array.isArray(p.formats) ? p.formats : [];
    if (formats.length === 0) mine.push('needs at least one format');
    for (const f of formats) {
      const format = getFormat(f?.format);
      if (!format) mine.push(`format "${f?.format}" isn't in the format catalog`);
      else if (!TYPES.has(String(f.type))) mine.push(`${f.format}: type must be png, jpeg or pdf`);
      else {
        const sizeProblem = printHouseSizeProblem(format, f);
        if (sizeProblem) mine.push(sizeProblem);
      }
    }
    ids.add(p.id);
    if (mine.length > 0) problems.push(...mine.map((m) => `${p.id}: ${m}`));
    else out.push({ id: p.id, label: p.label!, url: p.url!, source: p.source!, checkedAt: p.checkedAt!, formats: formats as PrintHouseFormat[], backs: p.backs as PrintHouseBacks, ...(typeof p.notes === 'string' ? { notes: p.notes } : {}) });
  }
  return { printHouses: out, problems };
}

/** Reads `<assetsRoot>/print-houses.json`; an absent file is an empty catalog. */
export async function loadPrintHouses(assetsRoot: string): Promise<{ printHouses: PrintHouse[]; problems: string[] }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(path.join(assetsRoot, 'print-houses.json'), 'utf8'));
  } catch {
    return { printHouses: [], problems: [] };
  }
  return parsePrintHouses(raw);
}

/** The smallest whole dpi whose bleed box covers the printer's size on both sides. */
export function captureDpiFor(format: CanvasFormat, entry: PrintHouseFormat): number {
  const box = bleedBox(format);
  const w = entry.width ?? 0;
  const h = entry.height ?? 0;
  return Math.ceil(Math.max((w * MM_PER_INCH) / box.width, (h * MM_PER_INCH) / box.height) - 1e-9);
}

const BACKS_TEXT: Record<PrintHouseBacks, string> = {
  'per-card': 'one back image per card',
  shared: 'one back for every card',
  none: 'no backs',
};

/** list_open_design_print_houses: every profile, with its formats and where its sizes came from. */
export function formatPrintHouses(printHouses: PrintHouse[]): string {
  if (printHouses.length === 0) return 'No print-house profiles are installed. Export print images at 300 dpi and ask the user to check the size against their printer.';
  const lines = ['Print-house profiles (pass the id as printHouse to export_open_design_artifact):'];
  for (const h of printHouses) {
    const formats = h.formats.map((f) => `${f.format} (${f.width && f.height ? `${f.width}×${f.height} px ` : ''}${f.type.toUpperCase()}${f.dpi ? `, ${f.dpi} dpi` : ''})`).join('; ');
    lines.push(`- ${h.id}: ${h.label}. ${formats}. Backs: ${BACKS_TEXT[h.backs]}. From ${h.source}, checked ${h.checkedAt}.${h.notes ? ` ${h.notes}` : ''}`);
  }
  lines.push(
    "If the user's printer isn't listed, export at 300 dpi (the default for print images, bleed included) and tell them to check the size against the printer's upload page. Sizes change: before an order, ask them to compare with the printer's current page.",
  );
  return lines.join('\n');
}

/** Resolves a printHouse id for a host, or says which ids exist. */
export async function resolvePrintHouse(
  index: { getPrintHouse(id: string): Promise<PrintHouse | undefined>; listPrintHouses(): Promise<PrintHouse[]> },
  id: string,
): Promise<{ ok: true; printHouse: PrintHouse } | { ok: false; error: string }> {
  const printHouse = await index.getPrintHouse(id);
  if (printHouse) return { ok: true, printHouse };
  const known = (await index.listPrintHouses()).map((h) => h.id);
  return { ok: false, error: `Export failed (invalid-args): no print house "${id}". ${known.length > 0 ? `Known: ${known.join(', ')}` : 'None are installed'}; list_open_design_print_houses shows their sizes. For another printer, export at 300 dpi without printHouse.` };
}
