// İçerik takvimi rubrik slaytları — komut satırı (yerel deneme / şablon geliştirme; sunucuda servis `POST /rubrik/render` üzerinden çalışır).
//   node tools/rubrik.mjs --model model.json --out cikti
// `model.json` = `POST /rubrik/render` gövdesi: { templateKey, seriesName, slotDay, slides:[{ role, title, body, bullets, quote }] } (lib/social-rubrik.mjs şeması;
// doğrulanır). Çıktı: <out>/rubrik-<slotDay>-NN-<rol>.png (1080x1350). Müzik/ffmpeg GEREKMEZ.
// Ortam: PLAYWRIGHT_FROM=<.../package.json> (yerel; kök paketten playwright). Yazı tipleri Google Fonts'tan gelir → internet gerekir (yüklenmezse üretim DURUR).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderRubrik, rubrikGovdeDogrula } from "../lib/social-rubrik.mjs";
import { launchBrowser } from "../lib/social-video.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > -1 ? process.argv[i + 1] : def; };

const modelPath = arg("model");
const outDir = path.resolve(arg("out", path.join(os.tmpdir(), "rubrik-cikti")));
const spherePath = arg("sphere", path.join(HERE, "..", "assets", "doctorium-sphere-disk-1024-v3.webp"));
if (!modelPath) throw new Error("--model verilmedi");

const g = rubrikGovdeDogrula(JSON.parse(fs.readFileSync(modelPath, "utf8")));
if (!g.ok) throw new Error(`model geçersiz: ${g.hata}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser();
const T0 = Date.now();
try {
  const { slides } = await renderRubrik({ model: g.model, browser, spherePath });
  for (const s of slides) {
    const f = path.join(outDir, `rubrik-${g.model.slotDay}-${String(s.index + 1).padStart(2, "0")}-${s.role}.png`);
    fs.writeFileSync(f, s.png);
    console.log(`${path.basename(f)}  ${(s.png.length / 1024).toFixed(0)} KB${s.tasma ? "  ⚠ TAŞMA (asgari puntoda bile sığmadı)" : ""}`);
  }
} finally {
  await browser.close();
}
console.log(`TOPLAM: ${((Date.now() - T0) / 1000).toFixed(1)} sn`);
