import * as assert from 'node:assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findBrowser } from '../../export/browserDiscovery';
import { composeShopHandoffInstructions, parseCsv, SHOPIFY_CSV_COLUMNS, shopColumns, shopCopyMarkdown, shopifyProductsCsv, uploadSteps, writeShopHandoff } from '../../index';
import { writeArtifactManifest } from '../../vendored/artifactCreate';

const LIST = {
  columns: ['title', 'price', 'cost', 'description', 'supplier', 'photo'],
  rows: [
    { title: 'Luna Ring', price: '$48', cost: '12', description: 'Hand-cut silver.\n\nMade to order.', supplier: 'Acme', photo: 'a.jpg' },
    { title: 'Sol "Hoop"', price: '$62', cost: '18', description: 'Hammered, 2 cm.', supplier: 'Acme', photo: 'b.jpg' },
  ],
};

describe('shop hand-off: copy and CSV', () => {
  it('pins Shopify\'s CSV header', () => {
    assert.strictEqual(
      SHOPIFY_CSV_COLUMNS.join(','),
      'Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare-at Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Alt Text',
    );
  });

  it('never picks private columns, even when asked to', () => {
    const cols = shopColumns(LIST, { descriptionField: 'cost' });
    assert.deepStrictEqual([cols.title, cols.price, cols.description], ['title', 'price', 'description']);
  });

  it('writes unpublished products with the price and description, no images and no cost', () => {
    const csv = shopifyProductsCsv(LIST, shopColumns(LIST), ['luna-ring', 'sol-hoop']);
    const [header, ...rows] = parseCsv(csv);
    assert.strictEqual(rows.length, 2);
    const at = (r: string[], c: string) => r[header.indexOf(c)];
    assert.deepStrictEqual([at(rows[0], 'Handle'), at(rows[0], 'Title'), at(rows[0], 'Published'), at(rows[0], 'Variant Price'), at(rows[0], 'Image Src')], ['luna-ring', 'Luna Ring', 'FALSE', '48', '']);
    assert.strictEqual(at(rows[0], 'Body (HTML)'), '<p>Hand-cut silver.</p><p>Made to order.</p>');
    assert.strictEqual(at(rows[1], 'Title'), 'Sol "Hoop"');
    assert.doesNotMatch(csv, /Acme|,12,/);
    const md = shopCopyMarkdown(LIST, shopColumns(LIST), ['luna-ring', 'sol-hoop'], [['luna-ring-1.png'], []]);
    assert.match(md, /## Luna Ring\n\n\*\*Price:\*\* \$48/);
    assert.doesNotMatch(md, /Acme/);
  });
});

describe('shop hand-off: instructions', () => {
  it('sends Shopify through the connector carefully, with the folder as fallback', () => {
    const text = composeShopHandoffInstructions({ entryPaths: ['.open-design/p/p.html'], shop: 'shopify', data: 'products.csv' });
    assert.match(text, /integration: "shopify"/);
    assert.match(text, /before writing anything/);
    assert.match(text, /first three/);
    assert.match(text, /drafts/);
    assert.match(text, /Leave price, stock and visibility as they are/);
    assert.match(text, /write nothing for that row/);
    assert.match(text, /folder: true/);
  });

  it('gives Big Cartel and Etsy the folder route and their own steps, with no connector', () => {
    for (const shop of ['bigcartel', 'etsy'] as const) {
      const text = composeShopHandoffInstructions({ entryPaths: ['x.html'], shop });
      assert.match(text, /folder: true/);
      assert.doesNotMatch(text, /connector|list_open_design_integrations/);
    }
    assert.match(uploadSteps('bigcartel', 'f'), /Add product/);
    assert.match(uploadSteps('etsy', 'f'), /Add a listing/);
    assert.match(uploadSteps('shopify', 'f'), /products\.csv[\s\S]*Overwrite products with matching handles/);
  });
});

describe('shop hand-off: folder (real browser; skipped when none is installed)', function () {
  this.timeout(90000);
  let browserPath: string | undefined;
  before(async function () {
    const found = await findBrowser();
    if (!found.ok) this.skip();
    else browserPath = found.executablePath;
  });

  it('writes images named by product, copy.md and products.csv', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'od-shop-'));
    const entry = '.open-design/product/product.html';
    await fs.mkdir(path.join(root, '.open-design', 'product'), { recursive: true });
    await fs.writeFile(
      path.join(root, entry),
      '<!doctype html><body style="margin:0"><div data-od-card style="width:2048px;height:2048px;background:#eee;position:relative;font:80px sans-serif"><h1 data-od-field="title" style="position:absolute;left:200px;top:200px;margin:0">T</h1></div></body>',
    );
    await writeArtifactManifest({ workspaceRoot: root, entryPath: entry, artifactManifest: { kind: 'html', renderer: 'html', exports: ['html'], title: 'Product', metadata: { format: 'shop-product' } } });
    await fs.writeFile(path.join(root, 'products.csv'), 'title,price,cost\nLuna Ring,$48,12\nSol Hoop,$62,18\n');
    const result = await writeShopHandoff({ workspaceRoot: root, entryPaths: [entry], shop: 'shopify', data: 'products.csv', exportOptions: { browserPath, settleMs: 0 } });
    assert.ok(result.ok, result.text);
    assert.deepStrictEqual((await fs.readdir(path.join(root, '.open-design/product/for-shopify'))).sort(), ['copy.md', 'luna-ring-1.png', 'products.csv', 'sol-hoop-1.png']);
    assert.match(result.text, /Left out \(never shown in the shop\): cost/);
    assert.match(result.text, /Products\*\*, then \*\*Import/);
  });
});
