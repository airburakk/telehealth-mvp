// Doctorium İÇERİK TAKVİMİ rubrik slaytları (v6.328, 2026-10-06) — "Karar masası" ve öteki haftalık rubriklerin kaydırmalı post (carousel) görselleri.
// `kart` servisinin `server.mjs`'i `createRubrik(...).handle`'ı çağırır: `POST /rubrik/render` (admin önizlemesi; Faz 3'te yayın görselleri de buradan).
//
// Girdi : { templateKey, seriesName, slotDay, slides:[{ role, title, body, bullets[], quote }] } — Next uygulamasından (n8n köprüsüyle) gelir.
// Çıktı : her slayt için 1080x1350 PNG (4:5) — kartla/karuselle AYNI çerçeve (72/84/64 dolgu · 3px üst çizgi · 22px künye · alt marka çubuğu).
// Tasarım: TÜM slaytlar TEK HTML belgesinde alt alta (yazı tipleri bir kez yüklenir, ≈7× hızlı) → her slayt kendi `.slide` öğesinden çekilir;
//   punto sığdırma slayt başına (önce gövde, sonra başlık; role göre asgari punto) — sığmayan slayt `tasma:true` ile işaretlenir (editör kısaltır).
// Güvenlik: girdi dışarıdan gelir → şablona HER ZAMAN `esc()`/`tipo()`'dan geçerek girer; gövde boyutu/slayt sayısı/alan uzunlukları sınırlı;
//   `Authorization: Bearer SOCIAL_DIGEST_TOKEN` doğrulaması BURADA yapılır (n8n köprüsü başlığı iletir, kendi sırrı yok); sosyal üretim (07:55 işi)
//   sürerken 503 (Chromium/bellek korunur); aynı anda tek önizleme (429).
// 🪤 Kaynakta \uXXXX YAZMA (araçlar kaçışı gerçek karaktere çevirebilir). 🪤 Emoji YOK (Docker imajında emoji yazı tipi yok → kutu çıkar).
import crypto from "node:crypto";
import { esc, fontlariDogrula, sayfada, spherePng, tipo, trTarih } from "./social-video.mjs";

const FONT_LINK = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">`;
const PAD_ANA = 40; // .main dikey iç boşluğu (sığdırma ölçümüyle sözleşmeli; social-carousel.mjs ile AYNI)
const WORDMARK = `Doctor<span style="color:#047857">ium</span>.tr`;

export const ROLLER = ["kapak", "uyusmazlik", "mahkeme", "gerekce", "sonuc", "cikarim", "kaynak", "genel"];
export const SABLONLAR = ["karar-masasi", "etkinlik-radari", "ogrenci-kosesi"];
export const SINIR = { slayt: 10, baslik: 140, govde: 1200, madde: 320, maddeSayisi: 6, seri: 60, govdeBayt: 256 * 1024 };

/** Rol → künye etiketi (büyük harfe CSS çevirir; lang="tr" ile İ doğru çıkar). Boş = künyede etiket yok. */
const ROL_ETIKET = {
  kapak: "",
  uyusmazlik: "Uyuşmazlık",
  mahkeme: "Mahkeme ve temyiz",
  gerekce: "Yargıtay gerekçesi",
  sonuc: "Sonuç",
  cikarim: "Doktor için çıkarım",
  kaynak: "Kaynak ve uyarı",
  genel: "",
};

/** Rol başına sığdırma asgarisi (okunabilirlik tabanı): b = gövde, t = başlık. */
const ASGARI = {
  kapak: { t: 48, b: 22 },
  uyusmazlik: { t: 36, b: 26 },
  mahkeme: { t: 36, b: 26 },
  gerekce: { t: 36, b: 26 },
  sonuc: { t: 48, b: 26 },
  cikarim: { t: 36, b: 26 },
  kaynak: { t: 36, b: 22 },
  genel: { t: 40, b: 26 },
};

// ── girdi doğrulaması ────────────────────────────────────────────────────────────────────────────────

const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : null);

/** @returns {{ ok:true, model:object } | { ok:false, hata:string }} */
export function rubrikGovdeDogrula(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, hata: "gövde nesne olmalı" };
  const templateKey = str(raw.templateKey);
  if (!templateKey || !SABLONLAR.includes(templateKey)) return { ok: false, hata: "templateKey bilinmiyor" };
  const seriesName = str(raw.seriesName);
  if (!seriesName || seriesName.length > SINIR.seri) return { ok: false, hata: "seriesName eksik ya da çok uzun" };
  const slotDay = str(raw.slotDay);
  if (!slotDay || !GUN_RE.test(slotDay) || Number.isNaN(new Date(`${slotDay}T00:00:00Z`).getTime()) || new Date(`${slotDay}T00:00:00Z`).toISOString().slice(0, 10) !== slotDay) {
    return { ok: false, hata: "slotDay geçerli bir YYYY-AA-GG olmalı" };
  }
  if (!Array.isArray(raw.slides) || raw.slides.length === 0 || raw.slides.length > SINIR.slayt) return { ok: false, hata: `slides 1–${SINIR.slayt} öğe olmalı` };
  const slides = [];
  for (const [i, s] of raw.slides.entries()) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return { ok: false, hata: `slayt ${i + 1} nesne olmalı` };
    if (typeof s.role !== "string" || !ROLLER.includes(s.role)) return { ok: false, hata: `slayt ${i + 1}: rol bilinmiyor` };
    const title = str(s.title ?? "");
    const body = str(s.body ?? "");
    if (title === null || title.length > SINIR.baslik) return { ok: false, hata: `slayt ${i + 1}: başlık geçersiz/çok uzun` };
    if (body === null || body.length > SINIR.govde) return { ok: false, hata: `slayt ${i + 1}: gövde geçersiz/çok uzun` };
    let bullets = [];
    if (s.bullets !== undefined && s.bullets !== null) {
      if (!Array.isArray(s.bullets) || s.bullets.length > SINIR.maddeSayisi || s.bullets.some((b) => typeof b !== "string" || b.length > SINIR.madde)) {
        return { ok: false, hata: `slayt ${i + 1}: maddeler geçersiz` };
      }
      bullets = s.bullets.map((b) => b.trim()).filter(Boolean);
    }
    if (!title && !body && bullets.length === 0 && s.role !== "cikarim") return { ok: false, hata: `slayt ${i + 1} boş` };
    slides.push({ role: s.role, title, body, bullets, quote: s.quote === true });
  }
  return { ok: true, model: { templateKey, seriesName, slotDay, slides } };
}

// ── şablon ───────────────────────────────────────────────────────────────────────────────────────────

// Çerçeve social-carousel.mjs TEMEL_CSS ile AYNI sayılar (padding/mast/bottom) — test ikisini birlikte denetler. `body` yerine `.slide`:
// tüm slaytlar tek belgede alt alta olduğu için aynı kurallar bölüm öğesine uygulanır.
const CSS = `
* { margin:0; box-sizing:border-box; }
body { font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; background:#fbfbfa; color:#18181b; }
.slide { width:1080px; height:1350px; padding:72px 84px 64px; display:flex; flex-direction:column; background:#fbfbfa; color:#18181b; overflow:hidden; }
.mono { font-family:"JetBrains Mono",monospace; }
.mast { border-top:3px solid #18181b; border-bottom:1px solid rgba(24,24,27,.25); padding:20px 0;
        display:flex; justify-content:center; gap:26px; font-size:22px; letter-spacing:.14em; text-transform:uppercase; color:#6b6b68; }
.mast b { color:#047857; font-weight:600; }
.main { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; padding:${PAD_ANA}px 0; }
.bottom { border-top:1px solid rgba(24,24,27,.25); padding-top:26px; display:flex; justify-content:center; align-items:center; gap:18px; }
.wm { font-size:38px; font-weight:600; letter-spacing:-0.02em; font-feature-settings:"cv11","ss01"; }
.kick { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:26px; }
.etiket { font-size:22px; font-weight:600; letter-spacing:.18em; color:#047857; text-transform:uppercase; }
.idx { font-size:22px; font-weight:600; letter-spacing:.14em; color:#6b6b68; }
h1,h2 { font-size:var(--t); font-weight:700; letter-spacing:-0.015em; line-height:1.18; }
h1 { line-height:1.1; letter-spacing:-0.02em; }
.metin { font-size:var(--b); line-height:1.5; color:#2a2a2d; font-weight:500; }
.metin + .metin { margin-top:.7em; }
.kapak-kural { width:120px; height:3px; background:#047857; margin:44px 0 36px; }
.kapak-govde { font-family:"JetBrains Mono",monospace; font-size:var(--b); line-height:1.5; color:#6b6b68; letter-spacing:.02em; }
h2 + .metin, h2 + .alinti, h2 + .zincir, h2 + .cikarim { margin-top:30px; }
.alinti { border-left:7px solid #047857; padding-left:34px; }
.alinti .metin { color:#18181b; }
.elip { color:#047857; font-weight:600; }
.alinti-not { font-size:20px; letter-spacing:.12em; color:#6b6b68; text-transform:uppercase; margin-top:30px; }
.sonuc-kural { width:120px; height:3px; background:#047857; margin:36px 0 34px; }
.zincir, .cikarim { list-style:none; }
.zincir li, .cikarim li { position:relative; display:flex; gap:28px; padding-bottom:38px; }
.zincir li:last-child, .cikarim li:last-child { padding-bottom:0; }
.zincir li:not(:last-child)::after { content:""; position:absolute; left:27px; top:62px; bottom:8px; width:2px; background:rgba(4,120,87,.35); }
.no { flex:0 0 56px; height:56px; border-radius:50%; background:#047857; color:#fff; font-weight:700; font-size:26px; display:flex; align-items:center; justify-content:center; }
.zincir .t, .cikarim .t { font-size:var(--b); line-height:1.4; padding-top:5px; font-weight:500; color:#18181b; }
.zincir b { display:block; font-family:"JetBrains Mono",monospace; font-size:.5em; letter-spacing:.16em; text-transform:uppercase; color:#047857; font-weight:600; margin-bottom:6px; }
.uyari { border:1px solid rgba(24,24,27,.25); border-radius:14px; padding:22px 26px; background:#f3f3f1; }
.liste { margin:.6em 0 0 1.2em; }
.liste li { font-size:var(--b); line-height:1.45; margin-top:.35em; color:#2a2a2d; font-weight:500; }
`;

/** Paragraflar: boş satırla ayrılmış bloklar; tek satır sonu <br>. Şablona girerken esc/tipo + atlama işareti vurgusu. */
const paragraflar = (s) => String(s).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const elip = (h) => h.replace(/\[…\]/g, '<span class="elip">[…]</span>');
const metinHtml = (s, sinif = "metin", ek = () => "") =>
  paragraflar(s).map((p) => `<p class="${sinif}${ek(p)}">${elip(tipo(p).replace(/\n/g, "<br>"))}</p>`).join("");
const tl = (s) => s.toLocaleLowerCase("tr-TR");

/** Başlangıç puntoları (başlık t · gövde b): metin uzunluğuna göre; sığdırma döngüsü aşağı çeker. */
function baslangicPunto(sl) {
  const len = (sl.body || sl.bullets.join(" ")).length;
  switch (sl.role) {
    case "kapak": return { t: sl.title.length < 40 ? 92 : sl.title.length < 70 ? 80 : 68, b: 32 };
    case "sonuc": return { t: 84, b: 38 };
    case "mahkeme": return { t: 54, b: 38 };
    case "cikarim": return { t: 54, b: len < 240 ? 44 : len < 420 ? 40 : 36 };
    case "kaynak": return { t: 54, b: 32 };
    default: // uyusmazlik · gerekce · genel (alıntı ya da değil)
      return { t: sl.role === "genel" ? 60 : 54, b: len < 260 ? 46 : len < 480 ? 40 : len < 700 ? 36 : 32 };
  }
}

/** Madde "Etiket: değer" biçimindeyse etiket vurgulanır (mahkeme zinciri). */
function zincirMaddesi(m, k) {
  const i = m.indexOf(": ");
  const metin = i > 0 && i < 24 ? `<b>${esc(m.slice(0, i))}</b>${tipo(m.slice(i + 2))}` : tipo(m);
  return `<li><span class="no mono">${k + 1}</span><span class="t">${metin}</span></li>`;
}

function icerikHtml(sl) {
  const baslik = (etiket) => (sl.title && tl(sl.title) !== tl(etiket) ? `<h2>${esc(sl.title)}</h2>` : "");
  switch (sl.role) {
    case "kapak":
      return `<h1>${esc(sl.title)}</h1>${sl.body ? `<div class="kapak-kural"></div><p class="kapak-govde">${tipo(sl.body).replace(/\n/g, "<br>")}</p>` : ""}`;
    case "sonuc":
      return `<h2>${esc(sl.title)}</h2>${sl.body ? `<div class="sonuc-kural"></div>${metinHtml(sl.body)}` : ""}`;
    case "mahkeme":
      return `${baslik(ROL_ETIKET.mahkeme)}<ol class="zincir">${sl.bullets.map(zincirMaddesi).join("")}</ol>${sl.body ? metinHtml(sl.body) : ""}`;
    case "cikarim":
      return `${baslik(ROL_ETIKET.cikarim)}<ol class="cikarim">${sl.bullets.map((m, k) => `<li><span class="no mono">${k + 1}</span><span class="t">${tipo(m)}</span></li>`).join("")}</ol>${sl.body ? metinHtml(sl.body) : ""}`;
    case "kaynak":
      return `${baslik(ROL_ETIKET.kaynak)}${metinHtml(sl.body, "metin", (p) => (/bilgilendirme amaçlıdır/i.test(p) ? " uyari" : ""))}`;
    default: {
      // uyusmazlik · gerekce · genel: alıntıysa kenar çizgili blok + aynen alıntı notu
      const govde = sl.quote
        ? `<div class="alinti">${metinHtml(sl.body)}</div><div class="alinti-not mono">Karar metninden aynen alıntıdır</div>`
        : `${metinHtml(sl.body)}${sl.bullets.length ? `<ul class="liste">${sl.bullets.map((m) => `<li>${tipo(m)}</li>`).join("")}</ul>` : ""}`;
      return `${baslik(ROL_ETIKET[sl.role] ?? "")}${govde}`;
    }
  }
}

function slaytBolumu(model, sl, i, n, sphere) {
  const p = baslangicPunto(sl);
  const etiket = ROL_ETIKET[sl.role] ?? "";
  return `<section class="slide" data-i="${i}" data-role="${sl.role}" style="--t:${p.t}px;--b:${p.b}px">
<div class="mast mono"><span>${esc(model.seriesName)}</span><b>·</b><span>${trTarih(model.slotDay)}</span></div>
<div class="main"><div class="inner">
  <div class="kick mono"><span class="etiket">${esc(etiket)}</span><span class="idx">${i + 1}/${n}</span></div>
  ${icerikHtml(sl)}
</div></div>
<div class="bottom"><img src="${sphere}" style="width:58px;height:58px"><span class="wm">${WORDMARK}</span></div>
</section>`;
}

/** Tüm slaytların tek belgesi. `lang="tr"` ŞART: künye/etiketler CSS ile büyütülür, dil yoksa "I" çıkar (README tuzakları). */
export function rubrikSayfaHtml(model, sphere) {
  const n = model.slides.length;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
${FONT_LINK}
<style>${CSS}</style></head><body>
${model.slides.map((sl, i) => slaytBolumu(model, sl, i, n, sphere)).join("\n")}
</body></html>`;
}

/**
 * Slaytları PNG'ye çizer. @returns {Promise<{slides:{index:number, role:string, png:Buffer, tasma:boolean}[]}>}
 * `tasma:true` → asgari puntoda bile sığmadı (editör kısaltmalı).
 */
export async function renderRubrik({ model, browser, spherePath }) {
  const sphere = spherePng(spherePath);
  return sayfada(browser, { viewport: { width: 1080, height: 1350 } }, async (page) => {
    await page.setContent(rubrikSayfaHtml(model, sphere), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await fontlariDogrula(page);
    // flex center'da taşma iki uca dağılır, scrollHeight SAYMAZ → ölçüm sarmalayıcının getBoundingClientRect yüksekliğiyle (README tuzağı)
    const fit = await page.evaluate(({ pad, asgari }) => {
      return [...document.querySelectorAll(".slide")].map((s) => {
        const main = s.querySelector(".main"), inner = s.querySelector(".inner");
        const bos = () => main.clientHeight - 2 * pad - inner.getBoundingClientRect().height;
        const lim = asgari[s.dataset.role] || { t: 40, b: 26 };
        let t = parseFloat(s.style.getPropertyValue("--t"));
        let b = parseFloat(s.style.getPropertyValue("--b"));
        while (bos() < 0 && (b > lim.b || t > lim.t)) {
          if (b > lim.b) b -= 1;
          if (t > lim.t) t -= 1;
          s.style.setProperty("--t", t + "px");
          s.style.setProperty("--b", b + "px");
        }
        return { t, b, bosluk: Math.round(bos()) };
      });
    }, { pad: PAD_ANA, asgari: ASGARI });
    const slides = [];
    for (let i = 0; i < model.slides.length; i++) {
      const png = await page.locator(`.slide[data-i="${i}"]`).screenshot({ type: "png" });
      slides.push({ index: i, role: model.slides[i].role, png, tasma: (fit[i]?.bosluk ?? 0) < 0 });
    }
    return { slides };
  });
}

// ── HTTP: POST /rubrik/render ────────────────────────────────────────────────────────────────────────

const json = (res, kod, nesne) => {
  const g = Buffer.from(JSON.stringify(nesne), "utf8");
  res.writeHead(kod, { "Content-Type": "application/json; charset=utf-8", "Content-Length": g.length });
  res.end(g);
};

/** Sabit-zamanlı Bearer karşılaştırması (iki tarafın sha256'sı → eşit uzunluk). */
export function yetkili(baslik, token) {
  const h = (s) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(String(baslik ?? "")), h(`Bearer ${token}`));
}

function okuGovde(req, limit) {
  return new Promise((resolve, reject) => {
    const parcalar = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) {
        reject(Object.assign(new Error("gövde çok büyük"), { kod: 413 }));
        req.resume(); // sokete yazılmaya devam eden veriyi at (yanıt yazılabilsin); destroy() 413 yanıtını kesebilirdi
        return;
      }
      parcalar.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parcalar).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * @param {object} o
 * @param {() => Promise<any>} o.getBrowser  paylaşılan Chromium (server.mjs)
 * @param {string} o.spherePath
 * @param {string} o.token  SOCIAL_DIGEST_TOKEN — boşsa uç 503 verir (kapalı kapı)
 * @param {() => boolean} [o.mesgul]  sosyal üretim (07:55 işi) sürüyor mu → true ise 503
 * @param {(m:string)=>void} [o.log]
 * @param {Function} [o.render]  test için sahte çizici
 */
export function createRubrik({ getBrowser, spherePath, token, mesgul = () => false, log = () => {}, render = renderRubrik }) {
  let calisiyor = false;

  async function handle(req, res) {
    let url;
    try { url = new URL(req.url ?? "/", "http://kart.local"); } catch { return false; }
    if (url.pathname !== "/rubrik/render") return false;
    try {
      if (req.method !== "POST") { req.resume(); res.setHeader("Allow", "POST"); json(res, 405, { hata: "yöntem desteklenmiyor" }); return true; }
      if (!token) { req.resume(); json(res, 503, { hata: "SOCIAL_DIGEST_TOKEN tanımlı değil — uç kapalı" }); return true; }
      if (!yetkili(req.headers.authorization, token)) { req.resume(); json(res, 401, { hata: "yetkisiz" }); return true; }
      if (mesgul()) { req.resume(); json(res, 503, { hata: "sosyal üretim sürüyor — sonra deneyin" }); return true; }
      if (calisiyor) { req.resume(); json(res, 429, { hata: "başka bir önizleme sürüyor" }); return true; }

      let raw;
      try { raw = await okuGovde(req, SINIR.govdeBayt); } catch (e) {
        json(res, e?.kod === 413 ? 413 : 400, { hata: e?.kod === 413 ? "gövde çok büyük" : "gövde okunamadı" });
        return true;
      }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { json(res, 400, { hata: "gövde JSON değil" }); return true; }
      const g = rubrikGovdeDogrula(parsed);
      if (!g.ok) { json(res, 400, { hata: g.hata }); return true; }

      calisiyor = true;
      const t0 = Date.now();
      try {
        const out = await render({ model: g.model, browser: await getBrowser(), spherePath });
        log(`rubrik: ${g.model.templateKey} ${g.model.slotDay} · ${out.slides.length} slayt · ${Math.round((Date.now() - t0) / 100) / 10} sn${out.slides.some((s) => s.tasma) ? " · TAŞMA var" : ""}`);
        json(res, 200, { slides: out.slides.map((s) => ({ index: s.index, role: s.role, png: Buffer.from(s.png).toString("base64"), tasma: s.tasma === true })) });
      } finally {
        calisiyor = false;
      }
    } catch (e) {
      log(`rubrik: render hatası: ${e instanceof Error ? e.message : e}`);
      if (!res.headersSent) json(res, 500, { hata: "render hatası" });
      else res.destroy();
    }
    return true;
  }

  return { handle };
}
