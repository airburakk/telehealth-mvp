// Sosyal video üretimi — komut satırı (yerel deneme / şablon geliştirme; sunucuda servis `lib/sosyal-isleri.mjs` üzerinden çalışır).
//   node tools/uret.mjs --digest digest.json --card kart-1080x1350.png --music muzik.mp3 --out cikti [--workers 4] [--only stories|reel] [--keep]
// Ortam: FFMPEG=<ffmpeg yolu> (varsayılan "ffmpeg") · PLAYWRIGHT_FROM=<.../package.json> (yerel; kök paketten playwright) · X264_PRESET=slow|medium|fast ·
//        SOSYAL_MUZIK=<mp3> (--music yerine). Müzik repoda YOK (lisans/boyut); `digest.json` = `/api/social-digest` yanıtı (jetonlu uç → elle kaydedilir).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digestDogrula } from "../lib/sosyal-isleri.mjs";
import { renderStories, renderReelA, launchBrowser } from "../lib/social-video.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, "..", "assets");
const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > -1 ? process.argv[i + 1] : def; };
const has = (name) => process.argv.includes("--" + name);

const digestPath = arg("digest");
const cardPng = arg("card");
const outDir = path.resolve(arg("out", path.join(os.tmpdir(), "sosyal-cikti")));
const workers = Number(arg("workers", 4));
const only = arg("only", "all");
const music = arg("music", process.env.SOSYAL_MUZIK);
const spherePath = arg("sphere", path.join(ASSETS, "doctorium-sphere-disk-1024-v3.webp"));
const grid = JSON.parse(fs.readFileSync(arg("grid", path.join(ASSETS, "beatgrid.json")), "utf8"));
if (!digestPath) throw new Error("--digest verilmedi");
if (!music) throw new Error("--music (ya da SOSYAL_MUZIK) verilmedi — müzik repoda yok");
if (only !== "reel" && !cardPng) throw new Error("--card verilmedi (hikâye kartı)");
const digest = JSON.parse(fs.readFileSync(digestPath, "utf8"));
digestDogrula(digest);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sosyal-video-"));
console.log(`gün ${digest.day} · öğe ${digest.items.length} · işçi ${workers} · iş dizini ${workDir}`);
digest.items.forEach((it, i) => console.log(`  ${i + 1}. [${it.streamLabel}] yedek=${it.summaryLongFallback} · ${it.title.slice(0, 70)}`));

const browser = await launchBrowser();
const sonuc = {};
const T0 = Date.now();
try {
  if (only !== "reel") {
    sonuc.hikaye = await renderStories({ digest, cardPng: path.resolve(cardPng), outDir, workDir, music, spherePath, browser });
    console.log("HİKÂYE:", JSON.stringify(sonuc.hikaye.timings), "| puntolar:", JSON.stringify(sonuc.hikaye.fit.map((f) => `${f.h2}/${f.desc}`)));
  }
  if (only !== "stories") {
    sonuc.reel = await renderReelA({
      digest, outPath: path.join(outDir, `reels-a-${digest.day}.mp4`), workDir, music, grid, spherePath, browser, workers, keepFrames: has("keep"),
    });
    console.log("REEL A:", JSON.stringify(sonuc.reel.timings), "| kare", sonuc.reel.frames, "| süre", sonuc.reel.seconds.toFixed(2), "sn");
  }
} finally {
  await browser.close();
}
console.log(`TOPLAM: ${((Date.now() - T0) / 1000).toFixed(1)} sn`);
(sonuc.hikaye?.files ?? []).concat(sonuc.reel?.file ? [sonuc.reel.file] : []).forEach((f) => console.log(`  ${path.basename(f)}  ${(fs.statSync(f).size / 1e6).toFixed(2)} MB`));
if (!has("keep")) fs.rmSync(workDir, { recursive: true, force: true }); else console.log("iş dizini KORUNDU:", workDir);
