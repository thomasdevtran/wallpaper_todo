'use strict';

// Generates assets/icon.png — a rounded accent square with a white checkmark.
// No image libraries: builds a valid PNG by hand (RGBA -> zlib -> PNG chunks).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 256;
const ACCENT = [110, 168, 254];
const WHITE = [255, 255, 255];

// --- CRC32 ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// --- geometry helpers ---
function roundedRectAlpha(x, y, w, h, r) {
  // returns coverage 0..1 for a rounded rect (simple inside test, soft edge)
  const rx = Math.max(x - r, Math.min(x, w - 1 - r));
  // corners
  const inX = x >= r && x <= w - 1 - r;
  const inY = y >= r && y <= h - 1 - r;
  if (inX || inY) return x >= 0 && y >= 0 && x < w && y < h ? 1 : 0;
  const cx = x < r ? r : w - 1 - r;
  const cy = y < r ? r : h - 1 - r;
  const d = Math.hypot(x - cx, y - cy);
  if (d <= r - 1) return 1;
  if (d >= r + 1) return 0;
  return (r + 1 - d) / 2;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// check polyline points (in 256 space)
const P = [
  [66, 138],
  [108, 182],
  [196, 78],
];
const STROKE = 30;

function buildPixels() {
  const px = Buffer.alloc(SIZE * SIZE * 4);
  const margin = 14;
  const r = 56;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const bgA = roundedRectAlpha(x - margin, y - margin, SIZE - margin * 2, SIZE - margin * 2, r);
      let rC = ACCENT[0], gC = ACCENT[1], bC = ACCENT[2], a = Math.round(bgA * 255);

      // checkmark
      const d = Math.min(
        distToSeg(x, y, P[0][0], P[0][1], P[1][0], P[1][1]),
        distToSeg(x, y, P[1][0], P[1][1], P[2][0], P[2][1])
      );
      const cov = d <= STROKE / 2 - 1 ? 1 : d >= STROKE / 2 + 1 ? 0 : (STROKE / 2 + 1 - d) / 2;
      if (cov > 0 && a > 0) {
        rC = Math.round(rC * (1 - cov) + WHITE[0] * cov);
        gC = Math.round(gC * (1 - cov) + WHITE[1] * cov);
        bC = Math.round(bC * (1 - cov) + WHITE[2] * cov);
      }
      px[i] = rC; px[i + 1] = gC; px[i + 2] = bC; px[i + 3] = a;
    }
  }
  return px;
}

function encodePNG(pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // add filter byte (0) per scanline
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(__dirname, 'icon.png');
fs.writeFileSync(out, encodePNG(buildPixels()));
console.log('Wrote', out);
