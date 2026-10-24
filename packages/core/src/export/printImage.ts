// Print-resolution images (openspec add-print-house-images): cut a captured
// card face to a print house's exact pixel size by removing only bleed, and
// record the dpi in the file so printers and image apps read the right size.
import { PNG } from 'pngjs';
import type { Browser } from 'puppeteer-core';

/** Centre-crops a PNG to width×height. Throws when the PNG is smaller than that. */
export function cropPngCentre(png: Buffer, width: number, height: number): Buffer {
  const src = PNG.sync.read(png);
  if (src.width === width && src.height === height) return png;
  if (src.width < width || src.height < height) throw new Error(`the capture is ${src.width}×${src.height} px, smaller than ${width}×${height}`);
  const left = Math.floor((src.width - width) / 2);
  const top = Math.floor((src.height - height) / 2);
  const out = new PNG({ width, height });
  PNG.bitblt(src, out, left, top, width, height, 0, 0);
  return PNG.sync.write(out);
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Sets a PNG's pHYs chunk (pixels per metre) to `dpi`, replacing any existing one. */
export function setPngDpi(png: Buffer, dpi: number): Buffer {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data[8] = 1;
  const type = Buffer.from('pHYs', 'latin1');
  const chunk = Buffer.alloc(12 + 9);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 17);
  // Signature (8) + IHDR (25); drop any existing pHYs.
  const parts: Buffer[] = [png.subarray(0, 33), chunk];
  let i = 33;
  while (i < png.length) {
    const len = png.readUInt32BE(i);
    const name = png.toString('latin1', i + 4, i + 8);
    if (name !== 'pHYs') parts.push(png.subarray(i, i + 12 + len));
    i += 12 + len;
  }
  return Buffer.concat(parts);
}

/** Sets a JPEG's JFIF density to `dpi`; a JPEG with no JFIF header is returned unchanged. */
export function setJpegDpi(jpeg: Buffer, dpi: number): Buffer {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff || jpeg[3] !== 0xe0 || jpeg.toString('latin1', 6, 11) !== 'JFIF\0') return jpeg;
  const out = Buffer.from(jpeg);
  out[13] = 1; // dots per inch
  out.writeUInt16BE(dpi, 14);
  out.writeUInt16BE(dpi, 16);
  return out;
}

/** Re-encodes a PNG as JPEG in a blank page of the export browser (the kit ships no JPEG encoder). */
export async function pngToJpeg(browser: Browser, png: Buffer, quality: number): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    const url = `data:image/png;base64,${png.toString('base64')}`;
    // String form: this package compiles without DOM lib types.
    const dataUrl = (await page.evaluate(
      `new Promise((resolve, reject) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); resolve(c.toDataURL('image/jpeg', ${quality / 100})); }; img.onerror = () => reject(new Error('decode failed')); img.src = ${JSON.stringify(url)}; })`,
    )) as string;
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  } finally {
    await page.close();
  }
}
