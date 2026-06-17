// PWA ikon üretici — bağımlılıksız (Node yerleşik zlib ile ham PNG yazar).
// Tasarım: AURA marka — siyah (#101010) zemin + cyan (#14C3D0) üçgen "A" sembolü.
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

// AURA "deconstructed" üçgen sembol — 3 yuvarlak blade (ince sol/kalın sağ/yatay alt) + merkez solid üçgen; siyah zemin + cyan
const BG = [16, 16, 16];   // #101010 siyah
const FG = [20, 195, 208]; // #14C3D0 cyan

// Nokta üçgenin içinde mi (apex bloğunu doldurmak için)
function inTri(px, py, a, b, c) {
  const s = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
  const t = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
  const d = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]);
  return d === 0 || (d < 0) === (s + t <= 0);
}

function renderIcon(size) {
  // PortamedLogo AuraMark ile aynı 100-uzay geometrisi → maskable güvenli alana ölçekli/merkezli
  const f = (size / 100) * 0.80;
  const c = size / 2;
  const X = (u) => c + (u - 50) * f;
  const Y = (v) => c + (v - 50) * f;
  // AuraMark ile aynı geometri: 3 blade (her biri kendi kalınlığı) + merkez solid üçgen
  const blades = [
    [47, 27, 26, 71, 5.5],  // sol ince
    [54, 20, 76, 69, 8.25], // sağ/apex kalın (tepede baskın)
    [31, 79, 70, 79, 6.5],  // alt yatay
  ].map(([ax, ay, bx, by, hw]) => [X(ax), Y(ay), X(bx), Y(by), hw * f]);
  const tri = [[51, 44], [41, 63], [61, 63]].map(([u, v]) => [X(u), Y(v)]); // merkez üçgen
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      let t = 0;
      for (const [ax, ay, bx, by, hw] of blades) {
        const tt = Math.max(0, Math.min(1, hw + 0.5 - segDist(px, py, ax, ay, bx, by)));
        if (tt > t) t = tt;
      }
      if (t < 1 && inTri(px, py, tri[0], tri[1], tri[2])) t = 1; // merkez üçgen dolu
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
