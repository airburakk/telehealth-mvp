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

// PortaMed portal halkası (logo spec: ellipse -18°, round cap) — zümrüt zemin + parlak teal halka
const BG = [10, 63, 57]; // #0A3F39 emerald
const FG = [95, 208, 199]; // #5FD0C7 teal-bright

function renderIcon(size) {
  const s = size / 512;
  // Halka: 512 uzayında merkez (256,256), rx=118 ry=196, -18°, kalınlık ~56
  const rx = 118 * s, ry = 196 * s, cx = size / 2, cy = size / 2;
  const rot = (-18 * Math.PI) / 180;
  const stroke = 56 * s;
  // Elipsi parametrik örnekle → nokta bulutuna uzaklıkla kalın halka çiz
  const pts = [];
  for (let i = 0; i < 1440; i++) {
    const a = (i / 1440) * Math.PI * 2;
    const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
    pts.push([cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)]);
  }
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d = Infinity;
      const px = x + 0.5, py = y + 0.5;
      for (const [ex, ey] of pts) {
        const dd = (px - ex) * (px - ex) + (py - ey) * (py - ey);
        if (dd < d) d = dd;
      }
      d = Math.sqrt(d);
      const t = Math.max(0, Math.min(1, stroke / 2 + 0.5 - d));
      const o = (y * size + x) * 4;
      rgba[o] = Math.round(BG[0] + (FG[0] - BG[0]) * t);
      rgba[o + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * t);
      rgba[o + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * t);
      rgba[o + 3] = 255; // tam dolu (maskable uyumlu)
    }
  }
  return encodePNG(size, size, rgba);
}

for (const [size, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-touch-icon.png"]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), renderIcon(size));
  console.log(`✓ public/${name} (${size}x${size})`);
}
