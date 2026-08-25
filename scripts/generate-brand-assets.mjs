#!/usr/bin/env node
/**
 * Renders the Teleprompt app icons.
 *
 * The mark is three lines of text on a dark tile: two dim, and one — the line
 * currently on the reading line — in Biios orange, running past the edge of the
 * tile because that line is also being sent to the other device. That is the
 * whole product in one glyph.
 *
 * Everything here is plain Node: a supersampled rasteriser and a minimal PNG
 * encoder over the built-in zlib. No image dependency, no binary checked in
 * that nobody can regenerate.
 *
 *   node scripts/generate-brand-assets.mjs
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "icons");

/* -------------------------------------------------------------------------- */
/* Palette — kept in sync with src/styles/globals.css                         */
/* -------------------------------------------------------------------------- */

const INK = [0x1a, 0x1a, 0x1b];
const PAPER = [0xff, 0xf9, 0xf4];
const BRAND = [0xff, 0x88, 0x00];

/* -------------------------------------------------------------------------- */
/* PNG encoder                                                                */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/** @param {Uint8Array} rgba row-major RGBA, length = width * height * 4 */
function encodePng(rgba, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Rasteriser                                                                 */
/* -------------------------------------------------------------------------- */

const SAMPLES = 4; // 4x4 supersampling per pixel

function insideRoundedRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const r = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * The mark, described once in a unit square so every output size is the same
 * drawing rather than a resample of one bitmap.
 *
 * @param {number} size          output edge in pixels
 * @param {number} tileRadius    corner radius as a fraction of the edge
 * @param {number} contentScale  how much of the tile the lines occupy
 */
function renderIcon(size, { tileRadius = 0.22, contentScale = 0.78 } = {}) {
  const pixels = new Uint8Array(size * size * 4);

  // Lines, expressed in the unit content box: [x0, x1, yCentre, thickness].
  // The middle line runs past x = 1: it is leaving the device.
  const lines = [
    { x0: 0.0, x1: 0.5, y: 0.2, h: 0.115, colour: PAPER, alpha: 0.4 },
    { x0: 0.0, x1: 1.06, y: 0.5, h: 0.145, colour: BRAND, alpha: 1 },
    { x0: 0.0, x1: 0.33, y: 0.8, h: 0.115, colour: PAPER, alpha: 0.4 },
  ];

  const inset = (1 - contentScale) / 2;
  const box = {
    x0: inset * size,
    y0: (inset + 0.06) * size,
    w: contentScale * size,
    h: (contentScale - 0.12) * size,
  };

  const tileR = tileRadius * size;
  const step = 1 / SAMPLES;
  const weight = 1 / (SAMPLES * SAMPLES);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;

          // Tile.
          const onTile = insideRoundedRect(x, y, 0, 0, size, size, tileR);
          if (!onTile) continue;

          let sr = INK[0];
          let sg = INK[1];
          let sb = INK[2];

          // Lines, painted over the tile.
          for (const line of lines) {
            const lx0 = box.x0 + line.x0 * box.w;
            const lx1 = box.x0 + line.x1 * box.w;
            const thickness = line.h * box.h;
            const ly0 = box.y0 + line.y * box.h - thickness / 2;
            const ly1 = ly0 + thickness;
            if (insideRoundedRect(x, y, lx0, ly0, lx1, ly1, thickness / 2)) {
              sr = sr + (line.colour[0] - sr) * line.alpha;
              sg = sg + (line.colour[1] - sg) * line.alpha;
              sb = sb + (line.colour[2] - sb) * line.alpha;
            }
          }

          r += sr * weight;
          g += sg * weight;
          b += sb * weight;
          a += 255 * weight;
        }
      }

      const offset = (py * size + px) * 4;
      // Un-premultiply so partially covered edge pixels keep their colour.
      const cover = a / 255;
      pixels[offset] = cover > 0 ? Math.round(r / cover) : 0;
      pixels[offset + 1] = cover > 0 ? Math.round(g / cover) : 0;
      pixels[offset + 2] = cover > 0 ? Math.round(b / cover) : 0;
      pixels[offset + 3] = Math.round(a);
    }
  }

  return encodePng(pixels, size, size);
}

/* -------------------------------------------------------------------------- */
/* Outputs                                                                    */
/* -------------------------------------------------------------------------- */

const TARGETS = [
  // Standard app icons — the tile carries its own corner radius.
  { file: "icon-96.png", size: 96, options: {} },
  { file: "icon-192.png", size: 192, options: {} },
  { file: "icon-256.png", size: 256, options: {} },
  { file: "icon-384.png", size: 384, options: {} },
  { file: "icon-512.png", size: 512, options: {} },

  // Maskable: full-bleed square, content pulled into the safe zone so Android
  // can crop it to a circle, a squircle or a teardrop without clipping a line.
  {
    file: "maskable-192.png",
    size: 192,
    options: { tileRadius: 0, contentScale: 0.58 },
  },
  {
    file: "maskable-512.png",
    size: 512,
    options: { tileRadius: 0, contentScale: 0.58 },
  },

  // iOS applies its own mask, so this one ships square.
  {
    file: "apple-touch-icon.png",
    size: 180,
    options: { tileRadius: 0, contentScale: 0.74 },
  },

  // Favicons — heavier strokes so the mark survives at 16px.
  {
    file: "favicon-32.png",
    size: 32,
    options: { tileRadius: 0.18, contentScale: 0.84 },
  },
  {
    file: "favicon-16.png",
    size: 16,
    options: { tileRadius: 0.14, contentScale: 0.88 },
  },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const png = renderIcon(target.size, target.options);
  writeFileSync(join(OUT_DIR, target.file), png);
  process.stdout.write(
    `  ${target.file.padEnd(24)} ${String(png.length).padStart(7)} bytes\n`,
  );
}

process.stdout.write(`\nWrote ${TARGETS.length} icons to public/icons\n`);
