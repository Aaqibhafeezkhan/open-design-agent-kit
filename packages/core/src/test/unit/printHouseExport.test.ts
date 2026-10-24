import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import { findBrowser } from '../../export/browserDiscovery';
import { exportArtifact, formatExportResult } from '../../export/exportArtifact';
import { cropPngCentre, setJpegDpi, setPngDpi } from '../../export/printImage';
import { getFormat } from '../../poster/formats';
import { bleedBoxPx, captureDpiFor, formatPrintHouses, loadPrintHouses, parsePrintHouses, printHouseSizeProblem, resolvePrintHouse, type PrintHouse } from '../../poster/printHouses';
import { writeArtifactManifest } from '../../vendored/artifactCreate';

const ENTRY = '.open-design/cards/cards.html';
const SHIPPED_ASSETS = path.resolve(__dirname, '..', '..', '..', '..', 'content', 'assets', 'open-design');

async function workspace(html: string, metadata?: Record<string, unknown>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-cards-'));
  await fs.mkdir(path.join(root, '.open-design', 'cards'), { recursive: true });
  await fs.writeFile(path.join(root, ENTRY), html);
  await writeArtifactManifest({
    workspaceRoot: root,
    entryPath: ENTRY,
    artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Cards', metadata },
  });
  return root;
}

/** The pHYs density of a PNG, in dots per inch, or undefined without one. */
function pngDpi(png: Buffer): number | undefined {
  const at = png.indexOf('pHYs');
  if (at < 0) return undefined;
  return Math.round(png.readUInt32BE(at + 4) * 0.0254);
}

const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

/** A trading card at its bleed box, front and optionally a back, with a field for data rows. */
const cardPage = (back = '', field = 'Card') => `<!doctype html><html><head><style>
  body{margin:0}
  [data-od-card]{width:69.85mm;height:95.25mm;position:relative;overflow:hidden;box-sizing:border-box;background:#203040;color:#fff;font:10pt sans-serif;margin:4mm}
  h1{position:absolute;left:12mm;top:12mm;margin:0;font-size:14pt}
</style></head><body><div data-od-card><h1 data-od-field="name">${field}</h1></div>${back}</body></html>`;
const staticBack = '<div data-od-card data-od-side="back" style="background:#702020"><h1>Back</h1></div>';

const HOUSE: PrintHouse = {
  id: 'test-printer',
  label: 'Test Printer',
  url: 'https://example.com/',
  source: 'https://example.com/spec',
  checkedAt: '2026-10-24',
  formats: [{ format: 'trading-card', width: 822, height: 1122, type: 'png', dpi: 300 }],
  backs: 'per-card',
};

describe('print houses: catalog', () => {
  it('ships a catalog whose every size fits its format', async () => {
    const { printHouses, problems } = await loadPrintHouses(SHIPPED_ASSETS);
    assert.deepStrictEqual(problems, []);
    assert.ok(printHouses.some((h) => h.id === 'boardgamesmaker'));
    for (const h of printHouses) {
      for (const f of h.formats) {
        const format = getFormat(f.format);
        assert.ok(format, `${h.id}: ${f.format}`);
        assert.strictEqual(printHouseSizeProblem(format, f), undefined, `${h.id}: ${f.format}`);
      }
    }
  });

  it('drops invalid profiles and says why, keeping the valid ones', () => {
    const { printHouses, problems } = parsePrintHouses({
      printHouses: [
        HOUSE,
        { ...HOUSE, id: 'bad-size', formats: [{ format: 'trading-card', width: 500, height: 700, type: 'png', dpi: 300 }] },
        { ...HOUSE, id: 'bad-format', formats: [{ format: 'no-such-card', width: 822, height: 1122, type: 'png' }] },
        { ...HOUSE, id: 'bad-backs', backs: 'sometimes' },
      ],
    });
    assert.deepStrictEqual(printHouses.map((h) => h.id), ['test-printer']);
    assert.strictEqual(problems.length, 3, problems.join('\n'));
    assert.ok(problems.some((p) => /bad-size/.test(p) && /doesn't fit trading-card/.test(p)));
  });

  it('works out the bleed box in pixels and the capture dpi that covers a printer size', () => {
    const card = getFormat('trading-card')!;
    assert.deepStrictEqual(bleedBoxPx(card, 300), { width: 825, height: 1125 });
    assert.strictEqual(captureDpiFor(card, HOUSE.formats[0]), 300);
  });

  it('crops a PNG from the centre and records its density', () => {
    const png = new PNG({ width: 10, height: 8 });
    for (let i = 0; i < png.data.length; i += 4) png.data[i + 3] = 255;
    const cut = setPngDpi(cropPngCentre(PNG.sync.write(png), 6, 4), 300);
    assert.deepStrictEqual(pngSize(cut), { width: 6, height: 4 });
    assert.strictEqual(pngDpi(cut), 300);
    // JFIF APP0 with no density: units 0, 1×1.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
    const dense = setJpegDpi(jpeg, 300);
    assert.deepStrictEqual([dense[13], dense.readUInt16BE(14), dense.readUInt16BE(16)], [1, 300, 300]);
  });
});

describe('print houses: export (real browser; skipped when none is installed)', function () {
  this.timeout(120000);
  let browserPath: string | undefined;
  before(async function () {
    const found = await findBrowser();
    if (!found.ok) this.skip();
    else browserPath = found.executablePath;
  });

  it('writes print images at 300 dpi by default, bleed included, with the dpi in the file', async () => {
    const root = await workspace(cardPage());
    const result = await exportArtifact({ workspaceRoot: root, entryPath: ENTRY, browserPath, settleMs: 0, preset: 'trading-card', format: 'png' });
    assert.ok(result.ok && !('output' in result), JSON.stringify(result));
    const png = await fs.readFile(path.join(root, result.files[0].path));
    assert.deepStrictEqual(pngSize(png), { width: 825, height: 1125 });
    assert.strictEqual(pngDpi(png), 300);
    assert.strictEqual(result.dpi, 300);
    assert.match(formatExportResult(result), /300 dpi/);
  });

  it("writes a printer's exact size, says where the size came from, and refuses a format it doesn't take", async () => {
    const root = await workspace(cardPage(staticBack), { format: 'trading-card' });
    const result = await exportArtifact({ workspaceRoot: root, entryPath: ENTRY, browserPath, settleMs: 0, printHouse: HOUSE });
    assert.ok(result.ok && !('output' in result), JSON.stringify(result));
    assert.deepStrictEqual(result.files.map((f) => path.posix.basename(f.path)), ['cards-front.png', 'cards-back.png']);
    for (const f of result.files) {
      const png = await fs.readFile(path.join(root, f.path));
      assert.deepStrictEqual(pngSize(png), { width: 822, height: 1122 }, f.path);
      assert.strictEqual(pngDpi(png), 300);
    }
    const text = formatExportResult(result);
    assert.match(text, /Test Printer/);
    assert.match(text, /https:\/\/example\.com\/spec/);

    const tarot = await workspace(cardPage(), { format: 'tarot-card' });
    const refused = await exportArtifact({ workspaceRoot: tarot, entryPath: ENTRY, browserPath, settleMs: 0, printHouse: HOUSE });
    assert.ok(!refused.ok && refused.code === 'invalid-args' && /Test Printer takes .*trading-card.*tarot-card/.test(refused.error), JSON.stringify(refused));
  });

  it('refuses a dpi that would make an image too large, naming the largest that fits', async () => {
    const root = await workspace(cardPage());
    const result = await exportArtifact({ workspaceRoot: root, entryPath: ENTRY, browserPath, settleMs: 0, preset: 'a0', format: 'png', dpi: 300 });
    assert.ok(!result.ok && result.code === 'invalid-args' && /largest dpi that fits is \d+/.test(result.error), JSON.stringify(result));
  });

  it('writes a static back once for data rows, or one numbered back per card for a per-card printer', async () => {
    const root = await workspace(cardPage(staticBack), { format: 'trading-card' });
    await fs.writeFile(path.join(root, 'cards.csv'), 'name\nGoblin\nDragon\n');
    const plain = await exportArtifact({ workspaceRoot: root, entryPath: ENTRY, browserPath, settleMs: 0, format: 'png', data: 'cards.csv', nameField: 'name' });
    assert.ok(plain.ok && !('output' in plain), JSON.stringify(plain));
    assert.deepStrictEqual(plain.files.map((f) => path.posix.basename(f.path)).sort(), ['cards-back.png', 'cards-dragon-front.png', 'cards-goblin-front.png']);

    const perCard = await exportArtifact({ workspaceRoot: root, entryPath: ENTRY, browserPath, settleMs: 0, data: 'cards.csv', nameField: 'name', printHouse: HOUSE });
    assert.ok(perCard.ok && !('output' in perCard), JSON.stringify(perCard));
    assert.deepStrictEqual(perCard.files.map((f) => path.posix.basename(f.path)).sort(), ['cards-dragon-back.png', 'cards-dragon-front.png', 'cards-goblin-back.png', 'cards-goblin-front.png']);
  });

  it('prints a card with a back as a two-page PDF, front then back', async () => {
    const root = await workspace(cardPage(staticBack));
    const result = await exportArtifact({ workspaceRoot: root, entryPath: ENTRY, browserPath, settleMs: 0, preset: 'trading-card' });
    assert.ok(result.ok && !('output' in result), JSON.stringify(result));
    assert.strictEqual(result.mode, 'print-pdf');
    const doc = await PDFDocument.load(await fs.readFile(path.join(root, result.files[0].path)));
    assert.strictEqual(doc.getPageCount(), 2);
  });
});

describe('print houses: listing', () => {
  it('lists profiles with sizes and sources, and resolves ids or names the known ones', async () => {
    const text = formatPrintHouses([HOUSE]);
    assert.match(text, /test-printer: Test Printer\. trading-card \(822×1122 px PNG, 300 dpi\)/);
    assert.match(text, /isn't listed, export at 300 dpi/);
    const index = { getPrintHouse: async (id: string) => (id === HOUSE.id ? HOUSE : undefined), listPrintHouses: async () => [HOUSE] };
    const found = await resolvePrintHouse(index, 'test-printer');
    assert.ok(found.ok && found.printHouse === HOUSE);
    const missing = await resolvePrintHouse(index, 'makeplayingcards');
    assert.ok(!missing.ok && /Known: test-printer/.test(missing.error));
  });
});
