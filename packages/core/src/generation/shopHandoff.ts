// "Put your designs in your shop" (openspec add-shop-handoff). Modelled on
// publishCanvaTemplateInstructions: this code never contacts a shop. For
// Shopify with its claude.ai connector connected, the agent makes the store
// changes itself, under the careful-change rules below. Otherwise, and for
// every other shop, writeShopHandoff writes an upload-ready folder: images
// named by product, copy.md, and for Shopify a products.csv to import.
//
// Shopify's connector is not verified yet (no development store was connected
// when this was written), so the instructions find its tools at run time and
// never assume it can attach images.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { exportArtifact, type ExportArtifactOptions } from '../export/exportArtifact';
import { loadDataTable, slugifyName, type DataTable } from '../poster/data';

export const SHOPS = ['shopify', 'bigcartel', 'etsy', 'other'] as const;
export type Shop = (typeof SHOPS)[number];

const SHOP_LABEL: Record<Shop, string> = { shopify: 'Shopify', bigcartel: 'Big Cartel', etsy: 'Etsy', other: 'your shop' };

/**
 * Shopify's product CSV header, as its help page lists it ("Common product CSV
 * import issues", help.shopify.com/en/manual/products/import-export/common-import-issues,
 * checked 2026-10-24). A test pins it.
 */
export const SHOPIFY_CSV_COLUMNS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
  'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Compare-at Price', 'Variant Requires Shipping',
  'Variant Taxable', 'Variant Barcode', 'Image Src', 'Image Alt Text',
] as const;

/** Columns that never go into the copy or the CSV, whatever the mapping says. */
const PRIVATE_COLUMN = /cost|margin|supplier|wholesale|vendor[_ ]?price|internal|note|stock|inventory|qty|quantity|sku/i;

const pick = (columns: string[], wanted: string[]): string | undefined => {
  for (const w of wanted) {
    const hit = columns.find((c) => c.trim().toLowerCase() === w);
    if (hit) return hit;
  }
  return undefined;
};

export interface ShopColumns {
  title?: string;
  description?: string;
  price?: string;
  handle?: string;
  type?: string;
  tags?: string;
}

/** The list's public columns for copy and CSV: explicit names win, else common header names. Private columns are never picked. */
export function shopColumns(table: DataTable, given: { nameField?: string; titleField?: string; descriptionField?: string; priceField?: string } = {}): ShopColumns {
  const cols = table.columns.filter((c) => !PRIVATE_COLUMN.test(c));
  const ok = (c: string | undefined) => (c && cols.includes(c) ? c : undefined);
  return {
    title: ok(given.titleField) ?? ok(given.nameField) ?? pick(cols, ['title', 'name', 'product', 'product name']),
    description: ok(given.descriptionField) ?? pick(cols, ['description', 'body', 'desc', 'details']),
    price: ok(given.priceField) ?? pick(cols, ['price', 'retail price']),
    handle: pick(cols, ['handle', 'url handle']),
    type: pick(cols, ['type', 'product type', 'category']),
    tags: pick(cols, ['tags']),
  };
}

const csvCell = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const escapeHtml = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Shopify's product CSV for the list: new products, unpublished, with images left out (Image Src needs public links). */
export function shopifyProductsCsv(table: DataTable, columns: ShopColumns, handles: string[]): string {
  const lines = [SHOPIFY_CSV_COLUMNS.join(',')];
  table.rows.forEach((row, i) => {
    const description = columns.description ? row[columns.description] ?? '' : '';
    const values: Record<string, string> = {
      Handle: handles[i],
      Title: columns.title ? row[columns.title] ?? '' : '',
      'Body (HTML)': description ? description.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('') : '',
      Type: columns.type ? row[columns.type] ?? '' : '',
      Tags: columns.tags ? row[columns.tags] ?? '' : '',
      Published: 'FALSE',
      'Option1 Name': 'Title',
      'Option1 Value': 'Default Title',
      'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price': columns.price ? (row[columns.price] ?? '').replace(/[^\d.,]/g, '') : '',
      'Variant Requires Shipping': 'TRUE',
      'Variant Taxable': 'TRUE',
    };
    lines.push(SHOPIFY_CSV_COLUMNS.map((c) => csvCell(values[c] ?? '')).join(','));
  });
  return `${lines.join('\n')}\n`;
}

/** copy.md: one section per product, the title, price and description as the list gives them. */
export function shopCopyMarkdown(table: DataTable, columns: ShopColumns, handles: string[], images: string[][]): string {
  const out = ['# Product copy', '', 'One section per product, from your list. Paste each into the product in your shop.'];
  table.rows.forEach((row, i) => {
    out.push('', `## ${(columns.title && row[columns.title]) || handles[i]}`, '');
    if (columns.price && row[columns.price]) out.push(`**Price:** ${row[columns.price]}`, '');
    if (columns.description && row[columns.description]) out.push(row[columns.description], '');
    if (images[i]?.length) out.push(`**Images:** ${images[i].map((f) => `\`${f}\``).join(', ')}`);
  });
  return `${out.join('\n').trimEnd()}\n`;
}

export interface ShopHandoffInput {
  workspaceRoot: string;
  /** The designs to put in the shop, each filled per product from `data` (e.g. the product image, a second angle). */
  entryPaths: string[];
  shop: Shop;
  /** The product list (CSV, XLSX or JSON), one row per product. */
  data: string;
  nameField?: string;
  titleField?: string;
  descriptionField?: string;
  priceField?: string;
  /** Passed to each export (browser, layout, output folder). */
  exportOptions?: Partial<Omit<ExportArtifactOptions, 'workspaceRoot' | 'entryPath' | 'data' | 'nameField'>>;
}

export type ShopHandoffResult = { ok: true; folder: string; files: string[]; products: number; text: string } | { ok: false; text: string };

/** Exports each design once per product and gathers the results into `<design folder>/for-<shop>/`. */
export async function writeShopHandoff(input: ShopHandoffInput): Promise<ShopHandoffResult> {
  const { workspaceRoot, entryPaths, shop } = input;
  if (entryPaths.length === 0) return { ok: false, text: 'entryPaths needs at least one design, such as the product image.' };
  if (!(SHOPS as readonly string[]).includes(shop)) return { ok: false, text: `shop must be one of ${SHOPS.join(', ')}.` };
  let table: DataTable;
  try {
    table = await loadDataTable(workspaceRoot, input.data);
  } catch (err) {
    return { ok: false, text: `Couldn't read the product list ${input.data}: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (table.rows.length === 0) return { ok: false, text: `${input.data} has no product rows.` };
  const columns = shopColumns(table, input);
  // Handles: the list's handle column, else the slugified title, made unique.
  const taken = new Set<string>();
  const handles = table.rows.map((row, i) => {
    const base = slugifyName((columns.handle && row[columns.handle]) || (columns.title && row[columns.title]) || '') || `product-${i + 1}`;
    let h = base;
    for (let n = 2; taken.has(h); n++) h = `${base}-${n}`;
    taken.add(h);
    return h;
  });

  const folderRel = path.posix.join(path.posix.dirname(entryPaths[0].split(path.sep).join('/')), `for-${shop}`);
  const folderAbs = path.join(workspaceRoot, folderRel);
  await fs.mkdir(folderAbs, { recursive: true });
  const images: string[][] = table.rows.map(() => []);
  const written: string[] = [];
  const warnings: string[] = [];

  for (const entryPath of entryPaths) {
    const result = await exportArtifact({ ...input.exportOptions, workspaceRoot, entryPath, data: input.data, nameField: input.nameField ?? columns.title });
    if (!result.ok) return { ok: false, text: `Couldn't export ${entryPath}: ${result.error}` };
    if (!('files' in result) || 'output' in result || 'inline' in result || 'motion' in result) return { ok: false, text: `${entryPath} didn't export as images; use a design made for the shop (shop-product, shop-banner).` };
    const errors = (result.findings ?? []).filter((f) => f.severity === 'error');
    if (errors.length > 0) warnings.push(`${entryPath}: ${errors.length} preflight error(s); run export_open_design_artifact with checkOnly to see them.`);
    // Files come out row by row, the same number for every row.
    const per = result.files.length / table.rows.length;
    if (!Number.isInteger(per) || per < 1) return { ok: false, text: `${entryPath} gave ${result.files.length} file(s) for ${table.rows.length} products; it needs [data-od-field] fields so it exports once per product.` };
    for (const [k, file] of result.files.entries()) {
      const row = Math.floor(k / per);
      const ext = path.extname(file.path);
      const name = `${handles[row]}-${images[row].length + 1}${ext}`;
      await fs.copyFile(path.join(workspaceRoot, file.path), path.join(folderAbs, name));
      images[row].push(name);
      written.push(path.posix.join(folderRel, name));
    }
  }

  await fs.writeFile(path.join(folderAbs, 'copy.md'), shopCopyMarkdown(table, columns, handles, images));
  written.push(path.posix.join(folderRel, 'copy.md'));
  if (shop === 'shopify') {
    await fs.writeFile(path.join(folderAbs, 'products.csv'), shopifyProductsCsv(table, columns, handles));
    written.push(path.posix.join(folderRel, 'products.csv'));
  }
  const used = [columns.title, columns.price, columns.description, columns.handle, columns.type, columns.tags].filter(Boolean);
  const left = table.columns.filter((c) => !used.includes(c));
  const text = [
    `Wrote ${folderRel}/ for ${SHOP_LABEL[shop]}: ${written.length} file(s) for ${table.rows.length} product(s).`,
    ...written.map((f) => `- ${f}`),
    `Columns used: ${used.join(', ') || 'none'}.${left.length > 0 ? ` Left out (never shown in the shop): ${left.join(', ')}.` : ''}`,
    ...warnings.map((w) => `Warning: ${w}`),
    '',
    uploadSteps(shop, folderRel),
  ].join('\n');
  return { ok: true, folder: folderRel, files: written, products: table.rows.length, text };
}

/** The shop's own steps for the hand-off folder, in plain words, to pass on to the user. */
export function uploadSteps(shop: Shop, folder: string): string {
  const intro = `## Tell the user how to upload it\n\nPass these steps on in plain words. Their files are in \`${folder}/\`: images named after each product (\`<product>-1.png\`, \`<product>-2.png\`…) and \`copy.md\` with each product's text.`;
  switch (shop) {
    case 'shopify':
      return `${intro}\n\n1. **New products:** in Shopify admin, go to **Products**, then **Import**, and choose \`products.csv\`. Leave **Overwrite products with matching handles** unticked, so existing products aren't changed. The products arrive unpublished, with the title, description and price from their list.\n2. **Images:** open each product and drag its images from the folder into **Media**. The file names match the product.\n3. **Existing products:** paste the text from \`copy.md\` into each one, and drag in the images.\n4. Check each product, then make it available on their sales channels when they're ready.`;
    case 'bigcartel':
      return `${intro}\n\n1. In Big Cartel admin, go to **Products**, then **Add product**.\n2. Paste the name, price and description from \`copy.md\`.\n3. Drag the product's images from the folder into **Images**; the first is the main one.\n4. Save, and repeat for each product.`;
    case 'etsy':
      return `${intro}\n\n1. In Shop Manager, go to **Listings**, then **Add a listing**.\n2. Drag the product's images from the folder into **Photos**; the first is the thumbnail.\n3. Paste the title, description and price from \`copy.md\`, and fill in Etsy's own fields (category, shipping).\n4. Publish, or save as a draft, and repeat for each product.`;
    default:
      return `${intro}\n\nIn their shop's admin, add or open each product, drag in its images, and paste its text from \`copy.md\`.`;
  }
}

export interface ComposeShopHandoffInstructionsInput {
  entryPaths: string[];
  shop: Shop;
  data?: string;
}

/** The connected route for Shopify: find the connector, then change the store carefully. Writes nothing. */
export function composeShopHandoffInstructions(input: ComposeShopHandoffInstructionsInput): string {
  const { entryPaths, shop, data } = input;
  const designs = entryPaths.map((e) => `\`${e}\``).join(', ');
  const again = `\`publish_open_design_artifact_to_shop\` again with the same \`entryPaths\`${data ? `, \`data: "${data}"\`` : ' and `data` (the product list)'}, \`shop: "${shop}"\` and \`folder: true\``;
  if (shop !== 'shopify') {
    return `# Put these designs in ${SHOP_LABEL[shop]}\n\nCall ${again}. It exports ${designs} once per product and writes a folder ready to upload, with ${SHOP_LABEL[shop]}'s steps for the user.`;
  }
  return [
    `# Put these designs in Shopify`,
    `You are putting ${designs} into the user's Shopify store, product by product${data ? `, from \`${data}\`` : ''}. Follow the steps in order, and stop where a step says to wait for the user.`,
    `## Step 1. Is Shopify connected?\n\nCall \`list_open_design_integrations\` with \`integration: "shopify"\`. Check your own tools, including deferred ones you can search for, for Shopify's connector: tools that read, update or create products.\n\n- **Connected:** go to step 2.\n- **Not connected:** offer to set it up once, with the steps that tool returned, and wait for their yes. If they decline, or it isn't available, call ${again} and pass on the steps it returns. Stop here.`,
    `## Step 2. Export the images\n\nExport each design with \`export_open_design_artifact\`${data ? `, \`data: "${data}"\`` : ' and the product list as `data`'}, and \`nameField\` set to the title column, so there is one image per product.`,
    `## Step 3. Match products, and show the matches first\n\nRead the store's products with the connector. Match each row of the list by its \`handle\` column if it has one, else by title. Show the user the matches in one short list (row, store product, what will change) **before writing anything**.\n\n- Two store products match one row: ask which one, and write nothing for that row until they answer.\n- No match: the product is new, and will be created **as a draft**.`,
    `## Step 4. Change the store carefully\n\n- Make the **first three** updates one at a time, telling the user after each and waiting for their go-ahead. Do the rest only after they say to continue.\n- Update the description and images. **Leave price, stock and visibility as they are** unless the user asks; when the list's price differs from the store's, say so and leave it.\n- Create new products only as **drafts**.\n- Attach images only if one of the connector's tools can do that. If none can, call ${again} for images named by product, and tell the user to drag them into each product's **Media**.\n- Never use a cost, margin, supplier, stock or internal-note column for anything.`,
    `## Step 5. Report\n\nWhen done, list what changed, product by product, and what still needs the user (images to drag in, drafts to check and publish, prices that differ).`,
  ].join('\n\n');
}

export interface PublishToShopInput {
  workspaceRoot: string;
  entryPaths: string[];
  shop: Shop;
  data?: string;
  nameField?: string;
  /** Write the hand-off folder now. Big Cartel, Etsy and other shops always get the folder. */
  folder?: boolean;
  exportOptions?: ShopHandoffInput['exportOptions'];
}

/** publish_open_design_artifact_to_shop, for every host: the connected route for Shopify, else the hand-off folder. */
export async function publishToShop(input: PublishToShopInput): Promise<string> {
  if (!Array.isArray(input.entryPaths) || input.entryPaths.length === 0) return 'entryPaths needs at least one design, such as the product image.';
  if (!(SHOPS as readonly string[]).includes(input.shop)) return `shop must be one of ${SHOPS.join(', ')}.`;
  if (input.shop === 'shopify' && !input.folder) return composeShopHandoffInstructions(input);
  if (!input.data) return `${input.shop === 'shopify' ? '' : `${composeShopHandoffInstructions(input)}\n\n`}The hand-off folder needs data: the product list (CSV, XLSX or JSON), one row per product. Nothing was written.`;
  const result = await writeShopHandoff({ ...input, data: input.data });
  return result.text;
}
