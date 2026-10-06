// Doctorium sosyal VİDEO üreticisi (v6.320) — hikâye klipleri (N+1) + Reel A, tek modül. `kart` servisinin `lib/sosyal-isleri.mjs`'i çağırır.
//
// Girdi : seçki JSON'u (`/api/social-digest`; v6.317 `summaryLong` + `summaryLongFallback` alanlı) + paylaşım kartı PNG'si (1080x1350).
// Çıktı : hikaye-<gün>-01-kart.mp4 … -0N-icerik-K.mp4 (hareketsiz kare + kesintisiz müzik dilimi) · reels-a-<gün>.mp4 (vuruşa oturan tipografik Reel).
// v6.327 (2026-10-06): + linkedin-a-<gün>.mp4 — Reel A'nın LinkedIn kesiti (aynı karelerden, LINKEDIN_BASLANGIC_SN'den; ilk kare dolu — LinkedIn küçük resmi = ilk kare,
//   Buffer özel küçük resim veremez) · kapanış satırı iki platformda ORTAK (REEL_CTA; "bio" sözcüğü LinkedIn'de anlamsız).
// v6.331 (2026-10-06, 👤 "LinkedIn'in tam video boyutu"): LinkedIn videosu artık 16:9 YATAY tam render — reelHtml(…, "yatay") 1920x1080, aynı DOM ve zaman
//   çizelgesi (yalnız CSS geometrisi + punto tabanı), LINKEDIN_BASLANGIC_SN'den başlar; Instagram Reel'i 9:16 kalır. Kare basma `kareleriBas` yardımcısında (dikey + yatay).
// Tasarım: 02.10 prototiplerinin (hikaye_render.mjs / hikaye_video.py / reels_a_render.mjs / reels_a_video.py) birebir Node portu.
//   · Python/Pillow/numpy GEREKMEZ (vuruş ızgarası önceden hesaplı assets/beatgrid.json; kart tuvali ffmpeg pad ile).
//   · Yerel yol YOK: her şey seçeneklerle/env'le (FFMPEG, PLAYWRIGHT_FROM, X264_PRESET, FFMPEG_ZAMAN_ASIMI_SN) → aynı kod sunucuda (Docker + apt ffmpeg) çalışır.
//   · Reel DETERMİNİSTİK: tek HTML + window.seek(t); CSS animasyonu yok; W paralel Playwright sayfası.
// 🪤 Kaynakta \uXXXX YAZMA (araçlar kaçışı gerçek karaktere çevirebilir): NBSP vb. String.fromCharCode ile.
// Şablon metinleri (başlık/kaynak/açıklama) HER ZAMAN `esc()`/`tipo()`'dan geçer — seçki verisi dışarıdan gelir, HTML'e ham girmez.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// ── ortak yardımcılar ───────────────────────────────────────────────────────────────────────────────
const NBSP = String.fromCharCode(0xa0);
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const AY_DESEN = AYLAR.join("|");
export const trTarih = (s) => { const [y, m, d] = s.split("-").map(Number); return `${d} ${AYLAR[m - 1]} ${y}`; };
export const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Açıklama tipografisi: tarih ("18 Ağustos 2026"), sayı aralığı ("1,53–3,28") ve "r ≈ 0,55" satır sonunda BÖLÜNMEZ. */
export function tipo(t) {
  let s = esc(t);
  s = s.replace(new RegExp(`(\\d{1,2}) (${AY_DESEN})( \\d{4})?`, "g"), (m) => m.replace(/ /g, NBSP));
  s = s.replace(/\d[\d.,]*-\d[\d.,]*/g, (m) => `<span style="white-space:nowrap">${m.replace("-", "–")}</span>`);
  s = s.replace(/r ≈ ([\d,]+)/g, `r${NBSP}≈${NBSP}$1`);
  return s;
}

const FF = () => process.env.FFMPEG || "ffmpeg";
/**
 * ffmpeg çalıştırır; hata → son 1500 karakter. `capture` → stderr metni döner (loudnorm ölçümü için).
 * Zaman aşımı (FFMPEG_ZAMAN_ASIMI_SN, vars. 600): asılı kalan ffmpeg SIGKILL ile öldürülür → iş `hata` olur, tek-iş kilidi sonsuza dek tutulmaz.
 */
export function ff(args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(FF(), ["-y", "-hide_banner", ...args.map(String)], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    let zamanAsimi = false;
    const limitSn = Number(process.env.FFMPEG_ZAMAN_ASIMI_SN) || 600;
    const sayac = setTimeout(() => { zamanAsimi = true; p.kill("SIGKILL"); }, limitSn * 1000);
    p.stderr.on("data", (d) => { err += d.toString("utf8"); if (err.length > 400000) err = err.slice(-200000); });
    p.on("error", (e) => { clearTimeout(sayac); reject(e); });
    p.on("close", (code) => {
      clearTimeout(sayac);
      if (zamanAsimi) return reject(new Error(`ffmpeg ${limitSn} sn içinde bitmedi — öldürüldü`));
      return code === 0 ? resolve(capture ? err : "") : reject(new Error(`ffmpeg hata (${code}):\n${err.slice(-1500)}`));
    });
  });
}

async function loadChromium() {
  const from = process.env.PLAYWRIGHT_FROM; // yerel prova: .../telehealth-mvp/package.json; sunucuda (Playwright imajı) gerekmez
  if (from) return createRequire(from)("playwright").chromium;
  return (await import("playwright")).chromium;
}

export const spherePng = (spherePath) => "data:image/webp;base64," + fs.readFileSync(spherePath).toString("base64");

/**
 * Yazı tipleri GERÇEKTEN yüklendi mi? (Google Fonts ağdan gelir.) 🪤 `document.fonts.check()` CSS hiç yüklenmediyse de true döner
 * (eşleşen FontFace yok) → burada yüklenmiş FontFace'ler sayılır. Yüklenmediyse üretim DURUR: yedek yazı tipiyle yayın YOK.
 */
export async function fontlariDogrula(page) {
  const r = await page.evaluate(() => {
    const yuklu = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, ""));
    return { inter: yuklu.includes("Inter"), mono: yuklu.includes("JetBrains Mono") };
  });
  if (!r.inter || !r.mono) throw new Error(`yazı tipi yüklenemedi (Inter=${r.inter}, JetBrains Mono=${r.mono}) — üretim DURDURULDU (yedek yazı tipiyle yayın yok)`);
}

/**
 * Sayfayı açar, `fn(page)`'i çalıştırır ve HATA YOLUNDA da kapatır. Sunucuda tarayıcı ömürlüdür (kart + video işleri paylaşır):
 * kapanmayan sayfa (yazı tipi kapısı düştü, ağ koptu…) her başarısız işte birikir (1080x1920 bağlam ≈ yüzlerce MB).
 */
export async function sayfada(browser, opts, fn) {
  const page = await browser.newPage(opts);
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {}); // tarayıcı zaten çöktüyse kapatma da fırlatabilir
  }
}

/** İki geçişli loudnorm (ölçüm → doğrusal normalizasyon) + son filtreler → WAV. 🪤 Yerel AAC kodlayıcı tepe aşımı yapabilir → TP −2,5 / ≥120 ms fade. */
async function normalizeAudio({ music, ss, measureSec, outSec, target, tp, post, outWav }) {
  const err = await ff(["-ss", ss, "-t", measureSec, "-i", music, "-af", `loudnorm=I=${target}:TP=${tp}:LRA=7:print_format=json`, "-f", "null", "-"], { capture: true });
  const blok = (err.match(/\{[^{}]*"input_i"[^{}]*\}/gs) || []).pop();
  if (!blok) throw new Error("loudnorm ölçümü okunamadı");
  const m = JSON.parse(blok);
  const ln = `loudnorm=I=${target}:TP=${tp}:LRA=7:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await ff(["-ss", ss, "-t", outSec, "-i", music, "-af", `${ln},${post}`, "-ar", 48000, "-ac", 2, outWav]);
  return m;
}

/** Dosyanın GERÇEK tepesi (dBTP): ebur128 peak=true; kodlanmış AAC çözülerek ölçülür. */
export async function gercekTepe(file) {
  const err = await ff(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { capture: true });
  const son = [...err.matchAll(/Peak:\s+(-?\d+(?:\.\d+)?|-inf) dBFS/g)].pop();
  if (!son) throw new Error("gerçek tepe ölçülemedi: " + file);
  return son[1] === "-inf" ? -Infinity : Number(son[1]);
}

/**
 * WAV → AAC (m4a); kodlama SONRASI gerçek tepe ölçülür, > maxTp ise aşım + 0,7 dB kadar kazanç düşürülüp yeniden kodlanır (en çok 3 deneme).
 * 🪤 ffmpeg yerel AAC kodlayıcısı parçanın bazı dilimlerinde tepe AŞIYOR, kaynak WAV güvenli olsa bile (02.10: +0,9 dBFS; 03.10 6 öğeli
 * Reel: +0,3 dBTP) → kaynağı değil KODLANMIŞ dosyayı ölç. `post`: kazançtan önce uygulanan filtreler (ör. mikro fade).
 */
export async function aacGuvenli(wavIn, outM4a, { maxTp = -1.0, ssSec = null, tSec = null, post = "" } = {}) {
  let kazanc = 0, tepe = NaN, deneme = 0;
  while (deneme < 3) {
    deneme++;
    const filtre = [post, kazanc ? `volume=${kazanc.toFixed(2)}dB` : ""].filter(Boolean).join(",");
    await ff([
      ...(ssSec != null ? ["-ss", ssSec] : []), ...(tSec != null ? ["-t", tSec] : []), "-i", wavIn,
      ...(filtre ? ["-af", filtre] : []), "-c:a", "aac", "-b:a", "192k", "-ar", 48000, "-ac", 2, outM4a,
    ]);
    tepe = await gercekTepe(outM4a);
    if (tepe <= maxTp) return { tepe, kazanc, deneme };
    kazanc -= (tepe - maxTp) + 0.7;
  }
  throw new Error(`ses tepesi ${deneme} denemede ${maxTp} dBTP altına indirilemedi (son ${tepe} dBTP)`);
}

// ── HİKÂYE ──────────────────────────────────────────────────────────────────────────────────────────
export function hikayeKareHtml(digest, it, i, n, desc, sphere) {
  const len = desc.length;
  const h0 = len < 260 ? 62 : len < 360 ? 58 : 56;
  const d0 = len < 260 ? 46 : len < 360 ? 42 : 40;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">
<style>
:root { --h2:${h0}px; --desc:${d0}px; }
* { margin:0; box-sizing:border-box; }
html,body { width:1080px; height:1920px; }
body { font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; background:#fbfbfa; color:#18181b;
       padding:270px 84px 380px; display:flex; flex-direction:column; }
.mono { font-family:"JetBrains Mono",monospace; }
.mast { border-top:3px solid #18181b; border-bottom:1px solid rgba(24,24,27,.25); padding:22px 0;
        display:flex; justify-content:center; gap:26px; font-size:24px; letter-spacing:.14em; text-transform:uppercase; color:#6b6b68; }
.mast b { color:#047857; font-weight:600; }
.main { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; padding:44px 0; }
.kick { display:flex; justify-content:space-between; align-items:baseline; }
.stream { font-size:24px; font-weight:600; letter-spacing:.18em; color:#047857; text-transform:uppercase; }
.brans { color:#6b6b68; letter-spacing:.1em; }
.idx { font-size:22px; font-weight:600; letter-spacing:.14em; color:#6b6b68; }
h2 { font-size:var(--h2); font-weight:700; letter-spacing:-0.015em; line-height:1.2; margin-top:20px; }
.src { font-size:28px; font-weight:600; color:#6b6b68; margin-top:16px; }
.rule { height:1px; background:rgba(24,24,27,.18); margin:36px 0 32px; }
.desc { font-size:var(--desc); font-weight:500; line-height:1.5; color:#2a2a2d; }
.bottom { border-top:1px solid rgba(24,24,27,.25); padding-top:26px; display:flex; justify-content:center; align-items:center; gap:18px; }
.wm { font-size:38px; font-weight:600; letter-spacing:-0.02em; font-feature-settings:"cv11","ss01"; }
</style></head><body>
<div class="mast mono"><span>GÜNLÜK SEÇKİ</span><b>·</b><span>${trTarih(digest.day)}</span></div>
<div class="main"><div class="inner">
  <div class="kick mono"><span class="stream">${esc(it.streamLabel)}${it.branch ? ` <span class="brans">· ${esc(it.branch.label)}</span>` : ""}</span><span class="idx">${i + 1}/${n}</span></div>
  <h2>${esc(it.title)}</h2>
  <div class="src">${esc(it.sourceName)}</div>
  <div class="rule"></div>
  <p class="desc">${tipo(desc)}</p>
</div></div>
<div class="bottom"><img src="${sphere}" style="width:58px;height:58px"><span class="wm">Doctor<span style="color:#047857">ium</span>.tr</span></div>
</body></html>`;
}

/**
 * Hikâye klipleri. Kart (paylaşımla AYNI PNG) 9:16 tuvale güvenli alanda ortalanır; içerik kareleri Playwright (DPR 2).
 * Süreler: kart 9 sn + içerik başına 12 sn. Müzik KESİNTİSİZ akar (her klip ardışık dilim). Açıklama = `summaryLong` (yedek cümle dahil).
 * @returns {Promise<{files:string[], timings:object, fit:object[]}>}
 */
export async function renderStories({ digest, cardPng, outDir, workDir, music, spherePath, browser }) {
  const t0 = Date.now(); const tm = {};
  const items = digest.items;
  const n = items.length;
  if (n === 0) return { files: [], timings: {}, fit: [] };
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(workDir, { recursive: true });
  const sphere = spherePng(spherePath);

  // 1) kare 1 — paylaşımla aynı kart: 1080x1350 → yükseklik 1270 (üst 270 / alt 380 boş), %94 ölçek, zemin #fbfbfa
  const kart1 = path.join(workDir, "kare-01.png");
  await ff(["-i", cardPng, "-vf", "scale=-2:1270:flags=lanczos,pad=1080:1920:(ow-iw)/2:270:color=0xfbfbfa", "-frames:v", 1, kart1]);

  // 2) içerik kareleri (DPR 2; ffmpeg video adımında Lanczos ile 1080x1920'ye iner)
  const fit = [];
  const pngs = [kart1];
  for (let i = 0; i < n; i++) {
    const p2x = path.join(workDir, `kare-${String(i + 2).padStart(2, "0")}-2x.png`);
    const m = await sayfada(browser, { viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 }, async (page) => {
      await page.setContent(hikayeKareHtml(digest, items[i], i, n, items[i].summaryLong, sphere), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await fontlariDogrula(page);
      const olcum = await page.evaluate(() => {
        const main = document.querySelector(".main"), inner = document.querySelector(".inner");
        // flex center'da taşma iki uca dağılır, scrollHeight SAYMAZ → ölçüm sarmalayıcının getBoundingClientRect yüksekliğiyle
        const bos = () => main.clientHeight - 2 * 44 - inner.getBoundingClientRect().height;
        const set = (h, d) => { document.documentElement.style.setProperty("--h2", h + "px"); document.documentElement.style.setProperty("--desc", d + "px"); };
        let h = parseFloat(getComputedStyle(document.querySelector("h2")).fontSize);
        let d = parseFloat(getComputedStyle(document.querySelector(".desc")).fontSize);
        while (bos() < 0 && (h > 40 || d > 32)) { if (h > 40) h -= 1; if (d > 32) d -= 0.5; set(h, d); }
        return { h2: h, desc: d, bosluk: Math.round(bos()) };
      });
      await page.screenshot({ path: p2x, type: "png" });
      return olcum;
    });
    fit.push(m);
    // 2x → 1080x1920 BİR KEZ (Lanczos): klip kodlamasında hareketsiz kare her kare için yeniden ölçeklenmesin (2 çekirdekte 52 sn → birkaç sn)
    const p1 = path.join(workDir, `kare-${String(i + 2).padStart(2, "0")}.png`);
    await ff(["-i", p2x, "-vf", "scale=1080:1920:flags=lanczos", "-frames:v", 1, p1]);
    pngs.push(p1);
  }
  tm.kareler_sn = (Date.now() - t0) / 1000;

  // 3) müzik: iki geçişli loudnorm (−18 LUFS, sakin editoryal ton) + 1 sn giriş / 2,5 sn çıkış
  const SURELER = [9, ...items.map(() => 12)];
  const TOPLAM = SURELER.reduce((a, b) => a + b, 0);
  const t1 = Date.now();
  const wav = path.join(workDir, "muzik-hikaye.wav");
  const olcum = await normalizeAudio({
    music, ss: 0, measureSec: TOPLAM + 3, outSec: TOPLAM + 3, target: -18, tp: -1.5,
    post: `afade=t=in:st=0:d=1.0,afade=t=out:st=${TOPLAM - 2.5}:d=2.5`, outWav: wav,
  });
  tm.muzik_sn = (Date.now() - t1) / 1000;

  // 4) klipler: hareketsiz kare + müzik dilimi. 🪤 ≥120 ms mikro fade (sert kesilen dilimde AAC tepe aşımı)
  const t2 = Date.now();
  const files = [];
  const sesBilgi = [];
  let basla = 0;
  for (let k = 0; k < SURELER.length; k++) {
    const sure = SURELER[k];
    const ad = k === 0 ? "01-kart" : `${String(k + 1).padStart(2, "0")}-icerik-${k}`;
    const out = path.join(outDir, `hikaye-${digest.day}-${ad}.mp4`);
    // video BİR kez (hareketsiz kare), ses ayrı AAC + kodlama sonrası tepe koruması, sonra `copy` ile birleştirme
    const vOnly = path.join(workDir, `video-${ad}.mp4`);
    await ff([
      "-loop", 1, "-framerate", 30, "-i", pngs[k],
      "-vf", "scale=1080:1920:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
      "-c:v", "libx264", "-preset", process.env.X264_PRESET || "slow", "-crf", 17, "-tune", "stillimage", "-profile:v", "high", "-level", "4.1",
      "-r", 30, "-g", 60, "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an", "-t", sure, vOnly,
    ]);
    // 🪤 ≥120 ms mikro fade (sert kesilen dilimde AAC tepe aşımı); tepe koruması yine de kodlanmış dosyayı ölçer
    const m4a = path.join(workDir, `ses-${ad}.m4a`);
    const ses = await aacGuvenli(wav, m4a, { ssSec: basla, tSec: sure, post: `afade=t=in:st=0:d=0.12,afade=t=out:st=${sure - 0.12}:d=0.12` });
    sesBilgi.push({ klip: ad, tepe_dbtp: ses.tepe, kazanc_db: Number(ses.kazanc.toFixed(2)), deneme: ses.deneme });
    await ff(["-i", vOnly, "-i", m4a, "-c", "copy", "-t", sure, "-movflags", "+faststart", out]);
    files.push(out);
    basla += sure;
  }
  tm.ses = sesBilgi;
  tm.klipler_sn = (Date.now() - t2) / 1000;
  tm.toplam_sn = (Date.now() - t0) / 1000;
  tm.loudnorm_girdi_lufs = olcum.input_i;
  return { files, timings: tm, fit };
}

// ── REEL A ──────────────────────────────────────────────────────────────────────────────────────────
const FPS = 30;
const LEAD = 0.15; // 1. vuruşun videodaki zamanı (müzik grid.a − LEAD'den başlar)
/** Reel kapanış satırı — iki platformda ORTAK (👤 2026-10-06): Instagram'da bio bağlantısı, LinkedIn'de gönderi metni aynı adrese gider; "bio" yazılmaz. */
export const REEL_CTA = "Seçkinin tamamı · doctorium.tr/secki";
/** LinkedIn kesitinin başlangıcı (sn) = Instagram Reel kapağı (`thumb_offset` 1700 ms) ile AYNI kare: masthead + "Bugünün N başlığı" + akışlar görünür; kare 0 boş zemindir. 30 fps'te tam kare (51). */
export const LINKEDIN_BASLANGIC_SN = 1.7;
/** LinkedIn videosu düzeni (v6.331): 16:9 yatay — masaüstü oynatıcıyı doldurur; Buffer 1280x720'ye yeniden kodlar. */
export const LINKEDIN_DUZEN = { w: 1920, h: 1080 };
const DIKEY_DUZEN = { w: 1080, h: 1920 };
/** Başlık punto tabanları (kısa ≤50 / orta ≤90 / uzun) — düzen başına; `init()` sığmazsa 2'şer px düşürür (alt sınır 48). */
const REEL_FS = { dikey: [104, 86, 72], yatay: [120, 100, 84] };

export function reelPlan(digest, grid) {
  const items = digest.items, n = items.length;
  // Vuruş planı: başlık uzunluğuna göre okuma süresi (6 / 8 / 10 / 12 vuruş ≈ 3,4 / 4,5 / 5,6 / 6,7 sn)
  const dur = items.map((it) => (it.title.length <= 50 ? 6 : it.title.length <= 90 ? 8 : it.title.length <= 115 ? 10 : 12));
  const INTRO_BEATS = 4, OUTRO_BEATS = 6;
  let cur = INTRO_BEATS;
  const plan = dur.map((d) => { const s = cur; cur += d; return { s, e: cur }; });
  const OUTRO_START = cur;
  const TOTAL_BEATS = OUTRO_START + OUTRO_BEATS;
  const TOTAL_T = LEAD + TOTAL_BEATS * grid.P + 0.6; // son vuruştan sonra 0,6 sn tutuş
  return { n, plan, OUTRO_START, TOTAL_BEATS, TOTAL_T, CFG: { P: grid.P, LEAD, plan, OUTRO_START, TOTAL_BEATS, n } };
}

/** Reel A stil blokları — düzen başına; DOM ve zaman çizelgesi ortaktır (yatay, dikeyden kırpılmaz/ölçeklenmez: ayrı yerleşim). */
const REEL_CSS = {
  dikey: `<style>
* { margin:0; box-sizing:border-box; }
html,body { width:1080px; height:1920px; overflow:hidden; background:#fbfbfa; }
body { font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; color:#18181b; position:relative; }
.mono { font-family:"JetBrains Mono",monospace; }
.mast { position:absolute; left:84px; top:270px; width:912px; }
.rule { height:3px; background:#18181b; transform-origin:left center; transform:scaleX(0); }
.mtext { border-bottom:1px solid rgba(24,24,27,.25); padding:22px 0; display:flex; justify-content:center; gap:26px;
         font-size:26px; letter-spacing:.14em; text-transform:uppercase; color:#6b6b68; opacity:0; }
.mtext b { color:#047857; font-weight:600; display:inline-block; }
.intro { position:absolute; left:84px; top:600px; width:840px; opacity:0; }
.ln { overflow:hidden; padding-bottom:10px; }
.ln span { display:block; font-size:152px; font-weight:700; letter-spacing:-0.035em; line-height:1.0; transform:translateY(105%); }
.cats { margin-top:54px; font-size:26px; font-weight:600; letter-spacing:.12em; color:#047857; text-transform:uppercase; white-space:nowrap; opacity:0; }
.beat { position:absolute; left:84px; top:520px; width:840px; height:800px; display:flex; flex-direction:column; justify-content:center; opacity:0; }
.kick { display:flex; justify-content:space-between; align-items:baseline; font-size:30px; }
.stream { font-weight:600; letter-spacing:.18em; color:#047857; text-transform:uppercase; }
.brans { color:#6b6b68; letter-spacing:.1em; }
.idx { font-weight:600; letter-spacing:.14em; color:#6b6b68; font-size:28px; }
.acc { height:4px; width:96px; background:#047857; margin-top:22px; transform-origin:left center; transform:scaleX(0); }
h2 { font-weight:700; letter-spacing:-0.02em; line-height:1.14; margin-top:30px; }
.w { display:inline-block; opacity:0; }
.src { font-size:38px; font-weight:600; color:#6b6b68; margin-top:34px; opacity:0; }
.prog { position:absolute; left:84px; top:1340px; width:840px; display:flex; gap:14px; opacity:0; }
.prog i { flex:1; height:6px; border-radius:3px; background:rgba(24,24,27,.12); overflow:hidden; display:block; }
.prog u { display:block; height:100%; width:0; background:#047857; text-decoration:none; }
.outro { position:absolute; left:84px; top:600px; width:840px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.outro img { width:230px; height:230px; opacity:0; }
.wm { margin-top:46px; font-size:112px; font-weight:600; letter-spacing:-0.03em; font-feature-settings:"cv11","ss01"; opacity:0; }
.cta { margin-top:44px; font-size:42px; font-weight:500; color:#6b6b68; opacity:0; }
</style>`,
  yatay: `<style>
* { margin:0; box-sizing:border-box; }
html,body { width:1920px; height:1080px; overflow:hidden; background:#fbfbfa; }
body { font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; color:#18181b; position:relative; }
.mono { font-family:"JetBrains Mono",monospace; }
.mast { position:absolute; left:120px; top:84px; width:1680px; }
.rule { height:3px; background:#18181b; transform-origin:left center; transform:scaleX(0); }
.mtext { border-bottom:1px solid rgba(24,24,27,.25); padding:18px 0; display:flex; justify-content:center; gap:26px;
         font-size:24px; letter-spacing:.14em; text-transform:uppercase; color:#6b6b68; opacity:0; }
.mtext b { color:#047857; font-weight:600; display:inline-block; }
.intro { position:absolute; left:120px; top:330px; width:1600px; opacity:0; }
.ln { overflow:hidden; padding-bottom:10px; }
.ln span { display:block; font-size:150px; font-weight:700; letter-spacing:-0.035em; line-height:1.0; transform:translateY(105%); }
.cats { margin-top:44px; font-size:26px; font-weight:600; letter-spacing:.12em; color:#047857; text-transform:uppercase; white-space:nowrap; opacity:0; }
.beat { position:absolute; left:120px; top:250px; width:1600px; height:620px; display:flex; flex-direction:column; justify-content:center; opacity:0; }
.kick { display:flex; justify-content:space-between; align-items:baseline; font-size:28px; }
.stream { font-weight:600; letter-spacing:.18em; color:#047857; text-transform:uppercase; }
.brans { color:#6b6b68; letter-spacing:.1em; }
.idx { font-weight:600; letter-spacing:.14em; color:#6b6b68; font-size:26px; }
.acc { height:4px; width:96px; background:#047857; margin-top:20px; transform-origin:left center; transform:scaleX(0); }
h2 { font-weight:700; letter-spacing:-0.02em; line-height:1.12; margin-top:26px; }
.w { display:inline-block; opacity:0; }
.src { font-size:36px; font-weight:600; color:#6b6b68; margin-top:30px; opacity:0; }
.prog { position:absolute; left:120px; top:940px; width:1680px; display:flex; gap:14px; opacity:0; }
.prog i { flex:1; height:6px; border-radius:3px; background:rgba(24,24,27,.12); overflow:hidden; display:block; }
.prog u { display:block; height:100%; width:0; background:#047857; text-decoration:none; }
.outro { position:absolute; left:0; top:250px; width:1920px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.outro img { width:220px; height:220px; opacity:0; }
.wm { margin-top:36px; font-size:120px; font-weight:600; letter-spacing:-0.03em; font-feature-settings:"cv11","ss01"; opacity:0; }
.cta { margin-top:30px; font-size:42px; font-weight:500; color:#6b6b68; opacity:0; }
</style>`,
};

export function reelHtml(digest, grid, sphere, duzen = "dikey") {
  if (!REEL_CSS[duzen]) throw new Error(`bilinmeyen Reel düzeni: ${duzen} (dikey | yatay)`);
  const punto = REEL_FS[duzen];
  const items = digest.items;
  const { n, CFG } = reelPlan(digest, grid);
  const cats = [...new Set(items.map((it) => it.streamLabel))];
  const beatHtml = items.map((it, i) => {
    const words = esc(it.title).split(" ").map((w) => `<span class="w">${w}</span>`).join(" ");
    const L = it.title.length;
    const fs0 = L <= 50 ? punto[0] : L <= 90 ? punto[1] : punto[2];
    return `<div class="beat" id="b${i}" data-fs="${fs0}">
    <div class="kick mono"><span class="stream">${esc(it.streamLabel)}${it.branch ? ` <span class="brans">· ${esc(it.branch.label)}</span>` : ""}</span><span class="idx">${i + 1}/${n}</span></div>
    <div class="acc"></div>
    <h2>${words}</h2>
    <div class="src">${esc(it.sourceName)}</div>
  </div>`;
  }).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">
${REEL_CSS[duzen]}</head><body>
<div class="mast"><div class="rule" id="rule"></div>
  <div class="mtext mono" id="mtext"><span>GÜNLÜK SEÇKİ</span><b id="dot">·</b><span>${trTarih(digest.day)}</span></div></div>
<div class="intro" id="intro">
  <div class="ln"><span id="h1">Bugünün</span></div>
  <div class="ln"><span id="h2s">${n} başlığı</span></div>
  <div class="cats mono" id="cats">${cats.map(esc).join(" · ")}</div>
</div>
${beatHtml}
<div class="prog" id="prog">${items.map(() => "<i><u></u></i>").join("")}</div>
<div class="outro" id="outro">
  <img id="sph" src="${sphere}"><div class="wm" id="wm">Doctor<span style="color:#047857">ium</span>.tr</div><div class="cta" id="cta">${esc(REEL_CTA)}</div>
</div>
<script>
const CFG = ${JSON.stringify(CFG)};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const E=(x)=>{x=clamp(x);return 1-Math.pow(1-x,3)};
const EI=(x)=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
const bt=(k)=>CFG.LEAD+k*CFG.P;
const V=0.03;                    // görsel vuruştan 30 ms ÖNCE başlar (algısal senkron)
const $=(id)=>document.getElementById(id);
function block(el,t,tin,din,tout,dout,dyIn=46,dyOut=-38){
  const a=E((t-tin)/din), b=tout==null?0:EI((t-tout)/dout);
  el.style.opacity=(a*(1-b)).toFixed(4);
  el.style.transform='translate3d(0,'+((1-a)*dyIn+b*dyOut).toFixed(2)+'px,0)';
}
window.init=function(){
  // her başlığı alana sığdır (alt sınır 48 px)
  document.querySelectorAll('.beat').forEach(b=>{
    let f=parseFloat(b.dataset.fs); const h=b.querySelector('h2'); h.style.fontSize=f+'px';
    b.style.opacity=1;
    while(b.scrollHeight>b.clientHeight && f>48){ f-=2; h.style.fontSize=f+'px'; }
    b.style.opacity=0; b.dataset.fit=f;
  });
  return [...document.querySelectorAll('.beat')].map(b=>b.dataset.fit);
};
window.seek=function(t){
  // — masthead
  $('rule').style.transform='scaleX('+E((t-0.0)/0.75).toFixed(4)+')';
  $('mtext').style.opacity=clamp((t-0.3)/0.4).toFixed(3);
  const ph=((t-CFG.LEAD)/CFG.P); const pf=ph>=0?(ph%1):1;           // vuruşta noktanın nabzı
  $('dot').style.transform='scale('+(1+0.9*Math.exp(-pf*7)).toFixed(3)+')';
  // — giriş: iki satır maskeli kayma + kategori çizgisi, 4. vuruşta çıkış
  const introOut=bt(CFG.plan[0].s)-0.30;
  const ib=EI((t-introOut)/0.30);
  $('intro').style.opacity=(t<introOut+0.31?1:0);
  $('h1').style.transform='translateY('+((1-E((t-(bt(0)-V))/0.6))*105)+'%)';
  $('h2s').style.transform='translateY('+((1-E((t-(bt(1)-V))/0.6))*105)+'%)';
  $('intro').style.transform='translate3d(0,'+(ib*-38).toFixed(2)+'px,0)';
  $('intro').style.opacity=((t<introOut+0.31)?(1-ib):0).toFixed(3);
  block($('cats'),t,bt(2)-V,0.5,null,1,30);
  // — başlıklar
  CFG.plan.forEach((p,i)=>{
    const el=$('b'+i), tin=bt(p.s)-V, tout=bt(p.e)-0.30;
    const b=EI((t-tout)/0.30);
    const vis=(t>=tin-0.05 && t<=bt(p.e)+0.05);
    el.style.opacity=vis?(1-b).toFixed(3):0;
    el.style.transform='translate3d(0,'+(b*-38).toFixed(2)+'px,0)';
    if(!vis) return;
    const words=el.querySelectorAll('.w'); const kick=el.querySelector('.kick'), src=el.querySelector('.src');
    const ka=E((t-tin)/0.4); kick.style.opacity=ka.toFixed(3); kick.style.transform='translate3d(0,'+((1-ka)*26)+'px,0)';
    el.querySelector('.acc').style.transform='scaleX('+E((t-(tin+0.05))/0.4).toFixed(4)+')';   // vuruşta çizilen zümrüt vurgu çizgisi
    words.forEach((w,j)=>{ const a=E((t-(tin+0.10+j*0.035))/0.45); w.style.opacity=a.toFixed(3); w.style.transform='translate3d(0,'+((1-a)*34).toFixed(2)+'px,0)'; });
    const tsrc=tin+0.10+words.length*0.035+0.20; const sa=E((t-Math.min(tsrc,tin+1.3))/0.4);
    src.style.opacity=sa.toFixed(3); src.style.transform='translate3d(0,'+((1-sa)*18)+'px,0)';
  });
  // — ilerleme çubuğu (n segment): girişte belirir, çıkışta kaybolur
  const segs=document.querySelectorAll('#prog u');
  CFG.plan.forEach((p,i)=>{ segs[i].style.width=(clamp((t-bt(p.s))/(bt(p.e)-bt(p.s)))*100).toFixed(2)+'%'; });
  const pin=E((t-(bt(CFG.plan[0].s)-0.1))/0.35), pout=EI((t-(bt(CFG.OUTRO_START)-0.30))/0.30);
  $('prog').style.opacity=(pin*(1-pout)).toFixed(3);
  // — kapanış: küre, wordmark, CTA; küre vuruşta nabız atar
  const o=CFG.OUTRO_START;
  const sa=E((t-(bt(o)-V))/0.7), s=0.72+0.28*sa;
  const pul=t>=bt(o)+0.7?(1+0.045*Math.exp(-(((t-bt(o))/CFG.P)%1)*6)):1;
  $('sph').style.opacity=sa.toFixed(3); $('sph').style.transform='scale('+(s*pul).toFixed(4)+')';
  block($('wm'),t,bt(o+1)-V,0.55,null,1,40);
  block($('cta'),t,bt(o+3)-V,0.5,null,1,24);
};
</script></body></html>`;
}

/**
 * Kareleri [ilk, son) aralığında W paralel sayfayla basar (her sayfa kendi dilimi; ad = mutlak indeks f%04d). Bir işçi düşerse diğerleri
 * (abort bayrağıyla) mevcut kareyi bitirip DURUR ve KENDİ sayfasını kapatır; `allSettled` hepsini bekler → iş hata verdiğinde artakalan işçi ya da
 * sızan sayfa kalmaz (kilit açıldığında yeni iş zombi işçilerle yarışmaz). Dikey Reel ve yatay LinkedIn videosu aynı yardımcıyı kullanır (v6.331).
 * @returns {Promise<number>} basılan kare sayısı
 */
export async function kareleriBas({ browser, html, viewport, frames, ilk = 0, son, workers = 4 }) {
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const adet = son - ilk;
  const per = Math.ceil(adet / workers);
  let abort = false;
  const sonuclar = await Promise.allSettled(Array.from({ length: workers }, (_, w) => sayfada(browser, { viewport, deviceScaleFactor: 1 }, async (page) => {
    try {
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await fontlariDogrula(page);
      await page.evaluate(() => window.init());
      for (let f = ilk + w * per; f < Math.min(son, ilk + (w + 1) * per); f++) {
        if (abort) return;
        await page.evaluate((t) => window.seek(t), f / FPS);
        await page.screenshot({ path: path.join(frames, `f${String(f).padStart(4, "0")}.png`), type: "png" });
      }
    } catch (e) {
      abort = true;
      throw e;
    }
  })));
  const dusen = sonuclar.find((r) => r.status === "rejected");
  if (dusen) throw dusen.reason;
  return adet;
}

/**
 * Reel A: deterministik kare render (W paralel sayfa) → müzikle MP4. Yalnız başlık + kaynak (teaser sınırı içinde; summaryLong KULLANILMAZ).
 * `linkedinOutPath` verilirse 16:9 YATAY LinkedIn videosu da basılır (v6.331; ikinci Playwright geçişi, aynı zaman çizelgesi, LINKEDIN_BASLANGIC_SN'den, aynı normalize ses).
 * Kesit üretilemezse Reel YİNE geçerlidir — hata fırlatılmaz, `linkedinHata` ile döner (n8n LinkedIn akışı reels-a dosyasına düşer); yarım dosya silinir.
 * @returns {Promise<{file:string, linkedinFile:string|null, linkedinHata:string|null, timings:object, frames:number, seconds:number}>}
 */
export async function renderReelA({ digest, outPath, workDir, music, grid, spherePath, browser, workers = 4, keepFrames = false, linkedinOutPath = null }) {
  const t0 = Date.now(); const tm = {};
  if (digest.items.length === 0) return { file: null, linkedinFile: null, linkedinHata: null, timings: {}, frames: 0, seconds: 0 };
  const frames = path.join(workDir, "reel-kareler");
  const { TOTAL_T } = reelPlan(digest, grid);
  const sphere = spherePng(spherePath);
  const total = Math.round(TOTAL_T * FPS);
  await kareleriBas({ browser, html: reelHtml(digest, grid, sphere), viewport: { width: DIKEY_DUZEN.w, height: DIKEY_DUZEN.h }, frames, ilk: 0, son: total, workers });
  tm.kareler_sn = (Date.now() - t0) / 1000;

  const SURE = total / FPS;
  const SS = grid.a - LEAD;
  const t1 = Date.now();
  const wav = path.join(workDir, "muzik-reel.wav");
  const olcum = await normalizeAudio({
    music, ss: SS, measureSec: SURE + 2, outSec: SURE, target: -16, tp: -2.5,
    post: `afade=t=in:st=0:d=0.12,afade=t=out:st=${(SURE - 1.6).toFixed(3)}:d=1.6`, outWav: wav,
  });
  tm.muzik_sn = (Date.now() - t1) / 1000;
  const t2 = Date.now();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // video BİR kez; ses ayrı AAC + kodlama sonrası tepe koruması (🪤 yerel AAC bazı dilimlerde tepe aşar); sonra `copy` ile birleştirme
  const vOnly = path.join(workDir, "reel-video.mp4");
  await ff([
    "-framerate", FPS, "-i", path.join(frames, "f%04d.png"), "-t", SURE,
    "-vf", "scale=1080:1920:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p",
    "-c:v", "libx264", "-preset", process.env.X264_PRESET || "slow", "-crf", 17, "-profile:v", "high", "-level", "4.1", "-r", FPS, "-g", 60,
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an", vOnly,
  ]);
  const m4a = path.join(workDir, "reel-ses.m4a");
  const ses = await aacGuvenli(wav, m4a, { tSec: SURE });
  tm.ses = { tepe_dbtp: ses.tepe, kazanc_db: Number(ses.kazanc.toFixed(2)), deneme: ses.deneme };
  await ff(["-i", vOnly, "-i", m4a, "-c", "copy", "-t", SURE, "-movflags", "+faststart", outPath]);
  tm.kodlama_sn = (Date.now() - t2) / 1000;
  if (!keepFrames) fs.rmSync(frames, { recursive: true, force: true }); // dikey kareler artık gerekmez (LinkedIn yatay AYRI basılır)
  // LinkedIn videosu (v6.331): 16:9 YATAY şablon, aynı zaman çizelgesi; LINKEDIN_BASLANGIC_SN'den (kare 51) başlar → ilk kare dolu (LinkedIn küçük resmi =
  // ilk kare; Buffer özel küçük resim veremez). Buffer 1280x720'ye yeniden kodlar → `medium` + CRF 18 yeter.
  // Ses: aynı normalize WAV'dan aynı ofsetle + mikro fade-in (sert kesilen dilimde AAC tepe aşımı 🪤) + kodlama sonrası tepe koruması.
  // Üretilemezse Reel YİNE geçerlidir: hata fırlatılmaz, `linkedinHata` döner, yarım dosya silinir (n8n LinkedIn akışı reels-a'ya düşer).
  let linkedinFile = null, linkedinHata = null;
  if (linkedinOutPath) {
    const t3 = Date.now();
    const framesLi = path.join(workDir, "reel-kareler-yatay");
    try {
      const ilkKare = Math.round(LINKEDIN_BASLANGIC_SN * FPS);
      const SURE_LI = Number((SURE - ilkKare / FPS).toFixed(3));
      await kareleriBas({ browser, html: reelHtml(digest, grid, sphere, "yatay"), viewport: { width: LINKEDIN_DUZEN.w, height: LINKEDIN_DUZEN.h }, frames: framesLi, ilk: ilkKare, son: total, workers });
      const karelerSn = (Date.now() - t3) / 1000;
      const vLi = path.join(workDir, "linkedin-video.mp4");
      await ff([
        "-framerate", FPS, "-start_number", ilkKare, "-i", path.join(framesLi, "f%04d.png"), "-t", SURE_LI,
        "-vf", `scale=${LINKEDIN_DUZEN.w}:${LINKEDIN_DUZEN.h}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
        "-c:v", "libx264", "-preset", "medium", "-crf", 18, "-profile:v", "high", "-level", "4.1", "-r", FPS, "-g", 60,
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an", vLi,
      ]);
      const m4aLi = path.join(workDir, "linkedin-ses.m4a");
      const sesLi = await aacGuvenli(wav, m4aLi, { ssSec: ilkKare / FPS, tSec: SURE_LI, post: "afade=t=in:st=0:d=0.12" });
      await ff(["-i", vLi, "-i", m4aLi, "-c", "copy", "-t", SURE_LI, "-movflags", "+faststart", linkedinOutPath]);
      linkedinFile = linkedinOutPath;
      tm.linkedin = { sn: Number(((Date.now() - t3) / 1000).toFixed(1)), kareler_sn: Number(karelerSn.toFixed(1)), duzen: "yatay", cozunurluk: `${LINKEDIN_DUZEN.w}x${LINKEDIN_DUZEN.h}`, baslangic_sn: ilkKare / FPS, sure_sn: SURE_LI, tepe_dbtp: sesLi.tepe };
    } catch (e) {
      linkedinHata = String(e?.message ?? e).slice(0, 300);
      try { fs.rmSync(linkedinOutPath, { force: true }); } catch { /* en iyi çaba */ }
      tm.linkedin = { hata: linkedinHata };
    } finally {
      if (!keepFrames) fs.rmSync(framesLi, { recursive: true, force: true });
    }
  }
  tm.toplam_sn = (Date.now() - t0) / 1000;
  tm.loudnorm_girdi_lufs = olcum.input_i;
  return { file: outPath, linkedinFile, linkedinHata, timings: tm, frames: total, seconds: SURE };
}

export async function launchBrowser() {
  const chromium = await loadChromium();
  return chromium.launch();
}
