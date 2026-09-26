// Generates the PWA icons as PNG files using only Node's zlib. Run: npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** pixel(x, y) returns [r, g, b, a]. */
function png(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * stride + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const NAVY = [0x1a, 0x24, 0x31, 255];
const RING_OUTER = [0xb8, 0x96, 0x4e, 255];
const RING_INNER = [0xd6, 0xba, 0x79, 255];
const PUPIL = [0xee, 0xf2, 0xf5, 255];
const CLEAR = [0, 0, 0, 0];

function eye(size, maskable) {
  const c = (size - 1) / 2;
  const half = size / 2;
  const corner = size * 0.22;
  return (x, y) => {
    if (!maskable) {
      const dx = Math.max(Math.abs(x - c) - (half - corner), 0);
      const dy = Math.max(Math.abs(y - c) - (half - corner), 0);
      if (Math.hypot(dx, dy) > corner) return CLEAR;
    }
    const d = Math.hypot(x - c, y - c) / size;
    if (d < 0.11) return PUPIL;
    if (d > 0.2 && d < 0.27) return RING_INNER;
    if (d > 0.33 && d < 0.36) return RING_OUTER;
    return NAVY;
  };
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'icon-192.png'), png(192, eye(192, false)));
writeFileSync(join(OUT, 'icon-512.png'), png(512, eye(512, false)));
writeFileSync(join(OUT, 'icon-512-maskable.png'), png(512, eye(512, true)));
console.log('icons written to', OUT);
