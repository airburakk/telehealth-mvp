// Doctorium kaydırmalı post (carousel) slaytları (v6.323) — Instagram feed'inde çok görselli gönderi. `kart` servisinin `lib/sosyal-isleri.mjs`'i çağırır.
//
// Girdi : seçki JSON'u (`/api/social-digest`; `summaryLong` + `summaryLongFallback` alanlı) + paylaşım kartı PNG'si (1080x1350).
// Çıktı : carousel-<gün>-01-kart.png · -02-icerik-1.png … -0N-icerik-K.png · -NN-kapanis.png (hepsi 1080x1350, 4:5).
//   01        günlük kart — paylaşımla (X/LinkedIn/Facebook) AYNI PNG, dokunulmadan kopyalanır
//   02…N+1    her içerik için bir slayt: akış · başlık · kaynak · açıklama (`summaryLong`) — hikâye karesinin 4:5 kardeşi
//   N+2       kapanış: marka + "seçkinin tamamı biyografideki bağlantıda" (yeni iddia YOK)
// Tasarım: kartla AYNI çizim hattı (Playwright, DPR 1, aynı yazı tipleri/ölçüler) → slayt 1 ile 2…N+2 arasında yazı keskinliği/çerçeve farkı olmaz;
//   ffmpeg/Python GEREKMEZ. Punto sığdırma hikâye karesindeki döngüyle aynı (önce başlık, sonra açıklama; asgari 40/32).
// Şablon metinleri (başlık/kaynak/açıklama) HER ZAMAN `esc()`/`tipo()`'dan geçer — seçki dışarıdan gelir, HTML'e ham girmez.
// 🪤 Kaynakta \uXXXX YAZMA (araçlar kaçışı gerçek karaktere çevirebilir).
import fs from "node:fs";
import path from "node:path";
import { esc, fontlariDogrula, sayfada, spherePng, tipo, trTarih } from "./social-video.mjs";

const FONT_LINK = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">`;
const PAD_ANA = 40; // .main dikey iç boşluğu (aşağıdaki ölçüm döngüsüyle sözleşmeli)

// Kartın (server.mjs `bulten`) çerçevesi: 72/84/64 dolgu, 3px üst çizgi, 22px mono künye, alt marka çubuğu.
const TEMEL_CSS = `
* { margin:0; box-sizing:border-box; }
html,body { width:1080px; height:1350px; }
body { font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; background:#fbfbfa; color:#18181b;
       padding:72px 84px 64px; display:flex; flex-direction:column; }
.mono { font-family:"JetBrains Mono",monospace; }
.mast { border-top:3px solid #18181b; border-bottom:1px solid rgba(24,24,27,.25); padding:20px 0;
        display:flex; justify-content:center; gap:26px; font-size:22px; letter-spacing:.14em; text-transform:uppercase; color:#6b6b68; }
.mast b { color:#047857; font-weight:600; }
.main { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; padding:${PAD_ANA}px 0; }
.bottom { border-top:1px solid rgba(24,24,27,.25); padding-top:26px; display:flex; justify-content:center; align-items:center; gap:18px; }
.wm { font-size:38px; font-weight:600; letter-spacing:-0.02em; font-feature-settings:"cv11","ss01"; }
`;

const MAST = (digest) => `<div class="mast mono"><span>GÜNLÜK SEÇKİ</span><b>·</b><span>${trTarih(digest.day)}</span></div>`;
const WORDMARK = `Doctor<span style="color:#047857">ium</span>.tr`;

/** İçerik slaytı. Başlangıç puntoları hikâye karesiyle aynı tablo (ana alan yüksekliği ≈ aynı: ~1050 px). */
export function icerikSlaytHtml(digest, it, i, n, desc, sphere) {
  const len = desc.length;
  const h0 = len < 260 ? 62 : len < 360 ? 58 : 56;
  const d0 = len < 260 ? 46 : len < 360 ? 42 : 40;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
${FONT_LINK}
<style>
:root { --h2:${h0}px; --desc:${d0}px; }
${TEMEL_CSS}
.kick { display:flex; justify-content:space-between; align-items:baseline; }
.stream { font-size:22px; font-weight:600; letter-spacing:.18em; color:#047857; text-transform:uppercase; }
.brans { color:#6b6b68; letter-spacing:.1em; }
.idx { font-size:22px; font-weight:600; letter-spacing:.14em; color:#6b6b68; }
h2 { font-size:var(--h2); font-weight:700; letter-spacing:-0.015em; line-height:1.2; margin-top:20px; }
.src { font-size:28px; font-weight:600; color:#6b6b68; margin-top:16px; }
.rule { height:1px; background:rgba(24,24,27,.18); margin:34px 0 30px; }
.desc { font-size:var(--desc); font-weight:500; line-height:1.5; color:#2a2a2d; }
</style></head><body>
${MAST(digest)}
<div class="main"><div class="inner">
  <div class="kick mono"><span class="stream">${esc(it.streamLabel)}${it.branch ? ` <span class="brans">· ${esc(it.branch.label)}</span>` : ""}</span><span class="idx">${i + 1}/${n}</span></div>
  <h2>${esc(it.title)}</h2>
  <div class="src">${esc(it.sourceName)}</div>
  <div class="rule"></div>
  <p class="desc">${tipo(desc)}</p>
</div></div>
<div class="bottom"><img src="${sphere}" style="width:58px;height:58px"><span class="wm">${WORDMARK}</span></div>
</body></html>`;
}

/** Kapanış slaytı — yeni iddia YOK: yalnız marka + seçkinin nerede bulunacağı. */
export function kapanisSlaytHtml(digest, sphere) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
${FONT_LINK}
<style>
${TEMEL_CSS}
.main { align-items:center; text-align:center; }
.wm-big { font-size:92px; font-weight:600; letter-spacing:-0.02em; font-feature-settings:"cv11","ss01"; margin-top:40px; }
.rule2 { width:120px; height:3px; background:#047857; margin:52px 0 44px; }
.cta { font-size:48px; font-weight:700; letter-spacing:-0.015em; line-height:1.25; }
.url { font-size:32px; font-weight:600; letter-spacing:.04em; color:#047857; margin-top:30px; }
</style></head><body>
${MAST(digest)}
<div class="main">
  <img src="${sphere}" style="width:250px;height:250px">
  <div class="wm-big">${WORDMARK}</div>
  <div class="rule2"></div>
  <p class="cta">Seçkinin tamamı<br>biyografideki bağlantıda</p>
  <p class="url mono">doctorium.tr/secki</p>
</div>
</body></html>`;
}

/**
 * Slaytları üretir. Kart (paylaşımla AYNI PNG) slayt 1 olarak kopyalanır; içerik slaytları Playwright (DPR 1).
 * @returns {Promise<{files:string[], fit:{h2:number, desc:number, bosluk:number}[]}>} `fit[i].bosluk` < 0 → asgari puntoda bile sığmadı.
 */
export async function renderCarousel({ digest, cardPng, outDir, spherePath, browser }) {
  const items = digest.items;
  const n = items.length;
  if (n === 0) return { files: [], fit: [] };
  fs.mkdirSync(outDir, { recursive: true });
  const sphere = spherePng(spherePath);
  const files = [];
  const fit = [];
  const ad = (k, etiket) => path.join(outDir, `carousel-${digest.day}-${String(k).padStart(2, "0")}-${etiket}.png`);

  // 1) kart AYNEN
  const f1 = ad(1, "kart");
  fs.copyFileSync(cardPng, f1);
  files.push(f1);

  // 2) içerik slaytları
  for (let i = 0; i < n; i++) {
    const out = ad(i + 2, `icerik-${i + 1}`);
    const m = await sayfada(browser, { viewport: { width: 1080, height: 1350 } }, async (page) => {
      await page.setContent(icerikSlaytHtml(digest, items[i], i, n, items[i].summaryLong, sphere), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await fontlariDogrula(page);
      const olcum = await page.evaluate((pad) => {
        const main = document.querySelector(".main"), inner = document.querySelector(".inner");
        // flex center'da taşma iki uca dağılır, scrollHeight SAYMAZ → ölçüm sarmalayıcının getBoundingClientRect yüksekliğiyle
        const bos = () => main.clientHeight - 2 * pad - inner.getBoundingClientRect().height;
        const set = (h, d) => { document.documentElement.style.setProperty("--h2", h + "px"); document.documentElement.style.setProperty("--desc", d + "px"); };
        let h = parseFloat(getComputedStyle(document.querySelector("h2")).fontSize);
        let d = parseFloat(getComputedStyle(document.querySelector(".desc")).fontSize);
        while (bos() < 0 && (h > 40 || d > 32)) { if (h > 40) h -= 1; if (d > 32) d -= 0.5; set(h, d); }
        return { h2: h, desc: d, bosluk: Math.round(bos()) };
      }, PAD_ANA);
      await page.screenshot({ path: out, type: "png" });
      return olcum;
    });
    fit.push(m);
    files.push(out);
  }

  // 3) kapanış
  const fk = ad(n + 2, "kapanis");
  await sayfada(browser, { viewport: { width: 1080, height: 1350 } }, async (page) => {
    await page.setContent(kapanisSlaytHtml(digest, sphere), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await fontlariDogrula(page);
    await page.screenshot({ path: fk, type: "png" });
  });
  files.push(fk);
  return { files, fit };
}
