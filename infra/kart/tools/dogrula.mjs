// Üretilen MP4'leri ve carousel PNG'lerini Instagram API şartlarına karşı doğrular. Salt-okur.
//   node tools/dogrula.mjs <klasör>          (yerelde FFMPEG=<yol>; sunucuda: docker compose exec kart node tools/dogrula.mjs /tmp/sosyal/<gün>)
// Şartlar: MP4/MOV · H.264 + AAC · 9:16 (1080x1920) · 23–60 fps · moov başta (faststart) ·
//   hikâye ≤60 sn ve ≤100 MB · Reels 3 sn–15 dk (API'de 90 sn) ve ≤300 MB · kaynak hedefi: hikâye −18 LUFS, Reel −16 LUFS, tepe ≤ −1 dBFS.
//   carousel PNG (`carousel-*.png`): PNG imzası · 1080x1350 (4:5; Instagram 4:5–1,91:1 kabul eder, tüm slaytlar AYNI oranda) · ≤ 8 MB. ffmpeg GEREKMEZ (IHDR doğrudan okunur).
// Çıkış kodu: tümü uygunsa 0, en az bir dosyada sorun varsa 1.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FF = process.env.FFMPEG || "ffmpeg";
const dir = process.argv[2];
if (!dir) throw new Error("klasör verilmedi");

function ffErr(args) {
  return new Promise((resolve) => {
    const p = spawn(FF, ["-hide_banner", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString("utf8"); });
    p.on("close", () => resolve(err));
  });
}

/** MP4 üst düzey kutu sırası (ilk 12): `moov` `mdat`'tan ÖNCE değilse Instagram akışlı yüklemede sorun çıkarır. */
function kutular(file) {
  const fd = fs.openSync(file, "r");
  const total = fs.fstatSync(fd).size;
  const out = [];
  let pos = 0;
  while (pos < total && out.length < 12) {
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, pos);
    let size = b.readUInt32BE(0);
    const typ = b.toString("latin1", 4, 8);
    if (size === 1) size = Number(b.readBigUInt64BE(8));
    if (size === 0) size = total - pos;
    out.push(typ);
    pos += size;
  }
  fs.closeSync(fd);
  return out;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mp4")).sort();
let hata = 0;
if (files.length) console.log("dosya".padEnd(44), "sn".padStart(6), "MB".padStart(6), " video".padEnd(30), " ses".padEnd(26), "LUFS".padStart(6), "tepe".padStart(6), " moov", " sonuç");
for (const f of files) {
  const p = path.join(dir, f);
  const info = await ffErr(["-i", p]);
  const sure = (() => { const m = info.match(/Duration: (\d+):(\d+):(\d+\.\d+)/); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN; })();
  const v = (info.match(/Video: (\w+)[^\n]*?(\d{3,4}x\d{3,4})[^\n]*?(\d+(?:\.\d+)?) fps/) || []);
  const a = (info.match(/Audio: (\w+)[^\n]*?(\d+) Hz/) || []);
  const eb = await ffErr(["-i", p, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const lufs = Number((eb.match(/I:\s+(-?\d+\.\d) LUFS/g) || []).pop()?.match(/-?\d+\.\d/)?.[0]);
  const tepe = Number((eb.match(/Peak:\s+(-?\d+\.\d) dBFS/g) || []).pop()?.match(/-?\d+\.\d/)?.[0]);
  const kt = kutular(p);
  const moovBasta = kt.indexOf("moov") > -1 && kt.indexOf("moov") < kt.indexOf("mdat");
  const mb = fs.statSync(p).size / 1e6;
  const hikaye = f.startsWith("hikaye");
  const sorunlar = [];
  if (v[1] !== "h264") sorunlar.push("video≠h264");
  if (a[1] !== "aac") sorunlar.push("ses≠aac");
  if (v[2] !== "1080x1920") sorunlar.push("çözünürlük≠1080x1920");
  if (!(Number(v[3]) >= 23 && Number(v[3]) <= 60)) sorunlar.push("fps");
  if (!moovBasta) sorunlar.push("moov başta DEĞİL");
  if (hikaye ? (sure > 60 || mb > 100) : (sure < 3 || sure > 90 || mb > 300)) sorunlar.push("süre/boyut sınırı");
  if (tepe > -1.0) sorunlar.push("tepe aşımı");
  if (sorunlar.length) hata++;
  console.log(f.padEnd(44), sure.toFixed(2).padStart(6), mb.toFixed(2).padStart(6), (" " + [v[1], v[2], v[3] + "fps"].join(" ")).padEnd(30), (" " + [a[1], a[2] + "Hz"].join(" ")).padEnd(26), String(lufs).padStart(6), String(tepe).padStart(6), moovBasta ? "  ✓  " : "  ✗  ", sorunlar.length ? " ✗ " + sorunlar.join(", ") : " ✓");
}

/** PNG imzası + IHDR boyutu (ffmpeg gerekmez). */
function pngBilgi(file) {
  const fd = fs.openSync(file, "r");
  const b = Buffer.alloc(24);
  fs.readSync(fd, b, 0, 24, 0);
  fs.closeSync(fd);
  const imza = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && b.toString("latin1", 12, 16) === "IHDR";
  return { imza, w: imza ? b.readUInt32BE(16) : 0, h: imza ? b.readUInt32BE(20) : 0 };
}

const pngler = fs.readdirSync(dir).filter((f) => /^carousel-.*\.png$/.test(f)).sort();
if (pngler.length) console.log("\n" + "carousel slaytı".padEnd(44), "MB".padStart(6), " boyut".padEnd(14), " sonuç");
for (const f of pngler) {
  const p = path.join(dir, f);
  const { imza, w, h } = pngBilgi(p);
  const mb = fs.statSync(p).size / 1e6;
  const sorunlar = [];
  if (!imza) sorunlar.push("PNG imzası/IHDR yok");
  if (imza && !(w === 1080 && h === 1350)) sorunlar.push("çözünürlük≠1080x1350");
  if (mb > 8) sorunlar.push("boyut > 8 MB");
  if (sorunlar.length) hata++;
  console.log(f.padEnd(44), mb.toFixed(2).padStart(6), (" " + w + "x" + h).padEnd(14), sorunlar.length ? " ✗ " + sorunlar.join(", ") : " ✓");
}

const toplam = files.length + pngler.length;
console.log(hata ? `\n${hata} dosyada SORUN` : `\n${toplam} dosyanın hepsi şartlara uygun`);
process.exitCode = hata ? 1 : 0;
