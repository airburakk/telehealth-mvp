// Doctorium kart-render servisi (2026-09-02) — SADECE compose iç ağından erişilir (+ host loopback).
// GET /bulten.png → günün seçkisini çeker (SOCIAL_DIGEST_TOKEN yalnız BURADA yaşar; n8n'e girmez),
// kullanıcı-onaylı TAM BÜLTEN şablonunu (V3-lockup dili, 2026-08-31) basar, PNG döndürür.
// Boş gün → 204 (kart üretilmez; "boş gazete basılmaz" kuralı — Post'la aynı disiplin).
// lang="tr" ŞART (2026-10-02): akış/branş etiketleri CSS text-transform:uppercase ile büyütülür; dil bildirilmezse
// tarayıcı "i"yi "I" yapar ("AKADEMIK", "CIHAZ", "DOKTRIN"). Türkçe büyük harf kuralı (i → İ) yalnız lang="tr" ile işler.
// v6.320 (2026-10-03): kod depoya alındı (infra/kart/) + hikâye/Reels MP4 üretimi: POST /sosyal/uret · GET /sosyal/durum ·
// GET /sosyal/dosya/<gün>/<ad>.mp4 (lib/sosyal-isleri.mjs; ffmpeg + müzik /varlik/muzik.mp3 — README). Kart ucu DEĞİŞMEDİ.
// v6.323 (2026-10-04): + Instagram kaydırmalı post (carousel) slaytları (lib/social-carousel.mjs) — aynı iş, `gorseller` dizisi + PNG dosya ucu;
// `kapsam.akislar` (günün akış etiketleri) eklendi. Mevcut uçların sözleşmesi geriye uyumlu (README).
// v6.327 (2026-10-06): + Reel A'nın LinkedIn kesiti linkedin-a-<gün>.mp4 (`linkedin[]` dizisi, aynı dosya ucu; `dosyalar` değişmez) · Reel kapanış satırı iki platformda ortak
// (REEL_CTA). n8n "LinkedIn video (Buffer)" akışı kesiti arşive alıp Buffer'a verir; kesit üretilemezse reels-a'ya düşer.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createSosyal } from "./lib/sosyal-isleri.mjs";
import * as video from "./lib/social-video.mjs";
import * as carousel from "./lib/social-carousel.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.SOCIAL_DIGEST_TOKEN ?? "";
const DIGEST_URL = process.env.SOCIAL_DIGEST_URL ?? "https://doctorium.tr/api/social-digest";
const SPHERE = "https://doctorium.tr/brand/doctorium-sphere-disk-1024-v3.webp";
const AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const trTarih = (s) => { const [y, m, d] = s.split("-").map(Number); return `${d} ${AYLAR[m-1]} ${y}`; };
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function bulten(digest) {
  const n = digest.items.length;
  const sik = n > 4;
  const items = digest.items.map((it, i) => `
    <div class="item${i === n - 1 ? " son" : ""}">
      <div class="stream mono">${esc(it.streamLabel)}${it.branch ? ` <span class="brans">· ${esc(it.branch.label)}</span>` : ""}</div>
      <h2>${esc(it.title)}</h2>
      <div class="src">${esc(it.sourceName)}</div>
    </div>`).join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">
<style>
* { margin:0; box-sizing:border-box; }
html,body { width:1080px; height:1350px; }
body { font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; background:#fbfbfa; color:#18181b;
       padding:72px 84px 64px; display:flex; flex-direction:column; }
.mono { font-family:"JetBrains Mono",monospace; }
.mast { border-top:3px solid #18181b; border-bottom:1px solid rgba(24,24,27,.25); padding:20px 0;
        display:flex; justify-content:center; gap:26px; font-size:22px; letter-spacing:.14em; text-transform:uppercase; color:#6b6b68; }
.mast b { color:#047857; font-weight:600; }
.list { flex:1; display:flex; flex-direction:column; justify-content:center; }
.item { padding:${sik ? 20 : 30}px 0; border-bottom:1px solid rgba(24,24,27,.12); }
.item.son { border-bottom:none; }
.stream { font-size:${sik ? 18 : 20}px; font-weight:600; letter-spacing:.18em; color:#047857; text-transform:uppercase; }
.brans { color:#6b6b68; letter-spacing:.1em; }
/* Kısaltma YOK (kullanıcı kararı 2026-09-02): başlık tam yazılır; sığmazsa render sığdırma
   döngüsü puntoyu düşürür (renderBulten içindeki evaluate). */
h2 { font-size:${sik ? 29 : 34}px; font-weight:700; letter-spacing:-0.015em; line-height:1.24; margin-top:10px; }
.src { font-size:${sik ? 18 : 20}px; font-weight:600; color:#6b6b68; margin-top:8px; }
.bottom { border-top:1px solid rgba(24,24,27,.25); padding-top:26px; display:flex; justify-content:center; align-items:center; gap:18px; }
.wm { font-size:38px; font-weight:600; letter-spacing:-0.02em; font-feature-settings:"cv11","ss01"; }
</style></head><body>
<div class="mast mono"><span>GÜNLÜK SEÇKİ</span><b>·</b><span>${trTarih(digest.day)}</span></div>
<div class="list">${items}</div>
<div class="bottom"><img src="${SPHERE}" style="width:58px;height:58px"><span class="wm">Doctor<span style="color:#047857">ium</span>.tr</span></div>
</body></html>`;
}

// Paylaşılan tarayıcı (kart + video işleri). Tembel başlar; çökerse / kapanırsa `disconnected` ile sıfırlanır → sonraki istek yenisini açar
// (eskiden ölü tutamaç sonsuza dek kalırdı). `--disable-dev-shm-usage`: Docker'ın 64 MB /dev/shm'i çok sayfalı Reel render'ında Chromium'u çökertir.
let browserP = null;
function getBrowser() {
  browserP ??= chromium.launch({ args: ["--disable-dev-shm-usage"] }).then(
    (b) => { b.on("disconnected", () => { browserP = null; }); return b; },
    (e) => { browserP = null; throw e; },
  );
  return browserP;
}

async function fetchDigest() {
  const r = await fetch(DIGEST_URL, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`seçki ucu HTTP ${r.status}`);
  return r.json();
}

// `digestIn` verilirse (sosyal iş: kart + klipler AYNI anlık görüntüden) seçki yeniden çekilmez.
async function renderBulten(digestIn) {
  const digest = digestIn ?? (await fetchDigest());
  if (!digest.items?.length) return null; // boş gün
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  try {
    await page.setContent(bulten(digest), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Sığdırma döngüsü: başlıklar KISALTILMAZ (kullanıcı kararı) — içerik alana sığmıyorsa
    // başlık puntosu (ve öğe dolgusu) kademeli düşürülür; 6 akışlı uzun günlerde de tam metin.
    await page.evaluate(() => {
      const list = document.querySelector(".list");
      let boy = parseFloat(getComputedStyle(document.querySelector("h2")).fontSize);
      let dolgu = parseFloat(getComputedStyle(document.querySelector(".item")).paddingTop);
      while (list.scrollHeight > list.clientHeight && boy > 20) {
        boy -= 1;
        if (dolgu > 12) dolgu -= 1;
        document.querySelectorAll("h2").forEach((h) => { h.style.fontSize = `${boy}px`; });
        document.querySelectorAll(".item").forEach((el) => {
          el.style.paddingTop = `${dolgu}px`; el.style.paddingBottom = `${dolgu}px`;
        });
      }
    });
    return await page.screenshot({ type: "png" });
  } finally {
    await page.close();
  }
}

// Hikâye + Reels (v6.320) + carousel (v6.323). Müzik repo DIŞINDA: sunucuda ./kart-varlik/muzik.mp3 → konteynerde /varlik/muzik.mp3 (salt-okur volume).
const sosyal = createSosyal({
  dir: process.env.SOSYAL_DIR ?? "/tmp/sosyal",
  getDigest: fetchDigest,
  renderCardPng: renderBulten,
  uretici: { renderStories: video.renderStories, renderReelA: video.renderReelA, renderCarousel: carousel.renderCarousel },
  getBrowser,
  muzikPath: process.env.SOSYAL_MUZIK ?? "/varlik/muzik.mp3",
  spherePath: path.join(HERE, "assets", "doctorium-sphere-disk-1024-v3.webp"),
  grid: () => JSON.parse(fs.readFileSync(path.join(HERE, "assets", "beatgrid.json"), "utf8")),
  workers: Number(process.env.SOSYAL_ISCI) || 2,
  log: (m) => console.log(`[kart] ${m}`),
});

http.createServer(async (req, res) => {
  if (req.url === "/saglik") { res.writeHead(200); return res.end("ok"); }
  if (await sosyal.handle(req, res)) return;
  if (req.url !== "/bulten.png") { res.writeHead(404); return res.end(); }
  try {
    const png = await renderBulten();
    if (!png) { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(png);
  } catch (e) {
    console.error("[kart] render hatası:", e?.message ?? e);
    res.writeHead(500); res.end("render hatası");
  }
}).listen(Number(process.env.PORT) || 3000, () => console.log(`[kart] ${Number(process.env.PORT) || 3000} dinleniyor`)); // PORT yalnız yerel deneme; konteynerde 3000
