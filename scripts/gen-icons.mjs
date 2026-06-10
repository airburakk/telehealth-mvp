// PWA ikon üretici — bağımlılıksız (Node yerleşik zlib ile ham PNG yazar).
// Tasarım: marka lacivert (#0f2a4a) zemin + beyaz nabız (pulse) çizgisi — Header'daki Activity ikonuyla uyumlu.
// Çalıştırma: node scripts/gen-icons.mjs  → public/icon-192.png, icon-512.png, apple-touch-icon.png
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// ── PNG kodlayıcı ──
const CRC_TABLE = (() => {
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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Çizim: nokta–doğru parçası uzaklığı ile kalın polyline rasterizasyonu ──
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Nabız çizgisi kontrol noktaları (512 uzayında)
const PULSE = [
  [88, 256], [186, 256], [224, 170], [268, 342], [306, 210], [330, 256], [424, 256],
];
const BG = [15, 42, 74]; // #0f2a4a
const FG = [255, 255, 255];

function renderIcon(size) {
  const s = size / 512;
  const stroke = 30 * s; // çizgi kalınlığı
  const pts = PULSE.map(([x, y]) => [x * s, y * s]);
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        d = Math.min(d, segDist(x + 0.5, y + 0.5, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
      }
      // 1px yumuşatma (antialias) ile beyaz çizgi ↔ lacivert zemin karışımı
      const t = Math.max(0, Math.min(1, stroke / 2 + 0.5 - d));
      const o = (y * size + x) * 4;
      rgba[o] = Math.round(BG[0] + (FG[0] - BG[0]) * t);
      rgba[o + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * t);
      rgba[o + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * t);
      rgba[o + 3] = 255; // tam dolu (maskable uyumlu — OS köşeleri kendisi maskeler)
    }
  }
  return encodePNG(size, size, rgba);
}

for (const [size, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), renderIcon(size));
  console.log(`✓ public/${name} (${size}x${size})`);
}
