// Doctorium İÇERİK TAKVİMİ YAYIN uçları (v6.335, 2026-10-07; Faz 2-B2) — `kart` servisinin MAKİNE yüzeyi: bugünün ONAYLI rubrik içeriğini Vercel'den ALIR,
// slaytları PNG'ye çizer, dosyaları sunar ve yayın sonucunu Vercel'e iletir. n8n (Faz 3) yalnız BU uçlarla konuşur — Vercel jetonu (CONTENT_PLAN_TOKEN)
// YALNIZ burada yaşar, n8n'e GİRMEZ (SOCIAL_DIGEST_TOKEN deseni).
//
// Sözleşme (n8n tarafı). Kart compose iç ağında — /sosyal/* ile AYNI güven modeli (internete AÇIK DEĞİL; n8n köprüsü yalnız /rubrik/render'a gider):
//   POST /rubrik/bugun[?kuru=1[&gun=YYYY-AA-GG]]
//        kuru=1  → Vercel `bak` (SALT OKUMA: durum DEĞİŞMEZ) → çiz + arşivle = deneme. Her gün için serbest (`gun` verilmezse bugün).
//        kuru yok → Vercel `al` (KİLİTLER: ONAYLI → YAYINLANIYOR) → çiz → dosyalar + altyazı n8n'e döner. YALNIZ bugün (Türkiye günü, kartta hesaplanır).
//        200 { ok, gun, kuru, items:[{ id, version, seriesKey, slotDay, approvedHash, altyazi, caption, hashtags, gorseller:[{ad,boyut,sira}] }],
//              hatalar:[{ id, seriesKey, hata, bildirildi }], atlanan, sure_sn }
//        502 { hata, belirsiz } yayın planına ulaşılamadı/yanıt geçersiz (`belirsiz:true` → `al` içerik aldıysa durum bilinmiyor: İNSAN bakar)
//        503 kapalı (CONTENT_PLAN_TOKEN yok) ya da sosyal üretim sürüyor · 429 başka `bugun` sürüyor
//   GET|HEAD /rubrik/dosya/<gün>/<ad>.png → yalnız `bitti.json`'da listeli adlar (yarım iş GÖRÜNMEZ)
//   POST /rubrik/sonuc { id, version, durum:"ok"|"hata", kanallar?, basarisiz?, hata? } → Vercel `sonuc`'a İLETİR (durum kodu + gövde aynen;
//        idempotensi Vercel'de: aynı sonuç ikinci kez 200 `tekrar:true`). `version` = `bugun` yanıtındaki öğe sürümü.
//
// Değişmezler:
//   · EN FAZLA BİR KEZ: içeriği `al` ile ALAN çağıran yayınlar; aynı gün ikinci `bugun` boş döner (Vercel). Çökme/zaman aşımında içerik YAYINLANIYOR'da takılı
//     kalır → çift paylaşım yerine İNSAN karar verir (Vercel panelinde "elle yayınlandı" / "yayınlanmadı — yeniden dene"). Bu yüzden `bugun` ölü yanıt alırsa
//     (kart çöktü / ağ koptu) n8n AYNI içeriği yeniden almaya ÇALIŞMAZ; yeniden alma yalnız insan "yeniden dene" dedikten sonra olur.
//   · Render hatası → içerik YAYIN HATASI'na çekilir (kart `sonuc hata` bildirir; yayınlanmadığı kesin) → insan "yeniden dene". Bildirilemezse `bildirildi:false`.
//   · `tasma` (asgari puntoda bile sığmayan slayt) FAIL-CLOSED: kırpılmış görsel yayına çıkmaz; hata notu "slayt N … kısaltın".
//   · Görsel = onaylanan önizleme: kart gövdesi Vercel'in `render` alanından gelir (önizlemeyle AYNI işlev); kart rubrik adını/şablonunu KENDİ bilmez.
//   · Dosyalar `<dir>/rubrik/<gün>/` altında — sosyal işinin `<dir>/<gün>/` klasöründen AYRI (07:55 işi kendi gün klasörünü siler); en yeni 3 gün saklanır.
//   · Sızıntı yok: jeton ve içerik günlüğe/hata gövdesine GİRMEZ (günlükte yalnız gün + sayı + süre; beklenmeyen hata gövdesi genel).
// 🪤 Kaynakta \uXXXX YAZMA (araçlar kaçışı gerçek karaktere çevirebilir). 🪤 Emoji YOK.
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { renderRubrik, rubrikGovdeDogrula } from "./social-rubrik.mjs";

const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const DOSYA_RE = /^rubrik-[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}-\d{2}\.png$/;
const MARKER = "bitti.json";
const PNG_IMZA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const YAYIN_SINIR = { planYanitBayt: 4 * 1024 * 1024, sonucGovdeBayt: 64 * 1024, planZamanAsimiMs: 30_000, altyazi: 2200, etiket: 30, kanal: 6, hata: 500 };
export const VARSAYILAN_PLAN_URL = "https://doctorium.tr/api/social-calendar/yayin";

export function gunGecerli(s) {
  if (typeof s !== "string" || !GUN_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // 2026-13-01 gibi taşmalar Invalid Date → toISOString() FIRLATIRDI
}
export const dosyaAdiGecerli = (s) => typeof s === "string" && DOSYA_RE.test(s);

/** Türkiye takvim günü ("YYYY-AA-GG") — Vercel `todayIsoTr` ile AYNI kural (Europe/Istanbul; UTC gece yarısında farklı gün olabilir). */
export function bugunTr(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

/** Dosya adı: slayt sırası iki haneli (01 = kapak). `seriesKey` Vercel'den gelir → slug biçimi dosya yoluna girmeden ÖNCE doğrulanır. */
export const slaytDosyaAdi = (seriesKey, gun, n) => `rubrik-${seriesKey}-${gun}-${String(n).padStart(2, "0")}.png`;

/** `buildCaptionText` (Vercel, ZIP içindeki altyazi.txt) ile AYNI biçim: altyazı + boş satır + etiketler. */
export const altyaziMetni = (caption, hashtags) => [String(caption).trim(), hashtags.join(" ").trim()].filter(Boolean).join("\n\n");

class PlanHatasi extends Error {
  constructor(kod, mesaj, belirsiz = false) {
    super(mesaj);
    this.kod = kod;
    this.belirsiz = belirsiz;
  }
}

/**
 * Vercel `bak`/`al` yanıtının YAPISI. Öğe düzeyindeki sorunlar (ör. geçersiz `render`) tüm partiyi düşürmez: `modelHata` işaretlenir ve o öğe
 * (canlıda) YAYIN HATASI'na çekilir; ama kimliği (`id`/`version`) bozuksa hiçbir bildirim yapılamaz → parti geçersiz (502).
 * @typedef {{ id:string, version:string, seriesKey:string, slotDay:string, approvedHash:string, caption:string, hashtags:string[], altyazi:string, model:any, modelHata:string|null }} PlanOgesi
 * @returns {{ gun:string, items:PlanOgesi[], atlanan:{ id:string, seriesKey:string, neden:string }[] }}
 */
export function planYanitiDogrula(j) {
  const gecersiz = () => new PlanHatasi(502, "yayın planı yanıtı geçersiz biçimde", true);
  if (!j || typeof j !== "object" || j.ok !== true || !gunGecerli(j.gun) || !Array.isArray(j.items)) throw gecersiz();
  const items = j.items.map((it) => {
    if (!it || typeof it !== "object") throw gecersiz();
    if (typeof it.id !== "string" || !ID_RE.test(it.id)) throw gecersiz();
    if (typeof it.version !== "string" || it.version.length < 1 || it.version.length > 40) throw gecersiz();
    if (typeof it.seriesKey !== "string" || !SLUG_RE.test(it.seriesKey)) throw gecersiz();
    if (typeof it.approvedHash !== "string" || !HASH_RE.test(it.approvedHash)) throw gecersiz();
    const caption = typeof it.payload?.caption === "string" ? it.payload.caption : null;
    const hashtags = Array.isArray(it.payload?.hashtags) && it.payload.hashtags.length <= YAYIN_SINIR.etiket && it.payload.hashtags.every((h) => typeof h === "string") ? it.payload.hashtags : null;
    if (caption === null || caption.length > YAYIN_SINIR.altyazi || hashtags === null) throw gecersiz();
    const g = rubrikGovdeDogrula(it.render);
    return {
      id: it.id, version: it.version, seriesKey: it.seriesKey, slotDay: gunGecerli(it.slotDay) ? it.slotDay : j.gun, approvedHash: it.approvedHash,
      caption, hashtags, altyazi: altyaziMetni(caption, hashtags),
      model: g.ok ? g.model : null, modelHata: g.ok ? null : g.hata,
    };
  });
  const atlanan = Array.isArray(j.atlanan)
    ? j.atlanan.filter((a) => a && typeof a.id === "string" && typeof a.seriesKey === "string").slice(0, 20).map((a) => ({ id: a.id, seriesKey: a.seriesKey, neden: typeof a.neden === "string" ? a.neden.slice(0, 40) : "bilinmiyor" }))
    : [];
  return { gun: j.gun, items, atlanan };
}

/** `/rubrik/sonuc` gövdesi: YALNIZ beyaz listedeki alanlar Vercel'e gider (`action` sabit; `manual` vb. enjekte edilemez). Anlamsal doğrulama (kanal adı kümesi, bağlantı) Vercel'dedir. */
export function sonucGovdeDogrula(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, hata: "gövde nesne olmalı" };
  if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) return { ok: false, hata: "id geçersiz" };
  if (typeof raw.version !== "string" || raw.version.length < 1 || raw.version.length > 40) return { ok: false, hata: "version geçersiz" };
  if (raw.durum !== "ok" && raw.durum !== "hata") return { ok: false, hata: "durum 'ok' ya da 'hata' olmalı" };
  const govde = { action: "sonuc", durum: raw.durum, id: raw.id, version: raw.version };
  const kanalGecerli = (c, alan) => c && typeof c === "object" && !Array.isArray(c) && typeof c.channel === "string" && c.channel.length >= 1 && c.channel.length <= 24 && (c[alan] === undefined || (typeof c[alan] === "string" && c[alan].length <= (alan === "url" ? 500 : YAYIN_SINIR.hata)));
  if (raw.durum === "ok") {
    if (!Array.isArray(raw.kanallar) || raw.kanallar.length < 1 || raw.kanallar.length > YAYIN_SINIR.kanal || !raw.kanallar.every((c) => kanalGecerli(c, "url"))) return { ok: false, hata: "kanallar 1–6 öğe olmalı ({ channel, url? })" };
    govde.kanallar = raw.kanallar.map((c) => (c.url === undefined ? { channel: c.channel } : { channel: c.channel, url: c.url }));
    if (raw.basarisiz !== undefined && raw.basarisiz !== null) {
      if (!Array.isArray(raw.basarisiz) || raw.basarisiz.length > YAYIN_SINIR.kanal || !raw.basarisiz.every((c) => kanalGecerli(c, "error"))) return { ok: false, hata: "basarisiz en çok 6 öğe olmalı ({ channel, error? })" };
      if (raw.basarisiz.length) govde.basarisiz = raw.basarisiz.map((c) => (c.error === undefined ? { channel: c.channel } : { channel: c.channel, error: c.error }));
    }
  } else {
    if (raw.hata !== undefined && (typeof raw.hata !== "string" || raw.hata.length > YAYIN_SINIR.hata)) return { ok: false, hata: `hata en çok ${YAYIN_SINIR.hata} karakter olmalı` };
    govde.hata = typeof raw.hata === "string" ? raw.hata : "";
  }
  return { ok: true, govde };
}

const json = (res, kod, nesne) => {
  const g = Buffer.from(JSON.stringify(nesne), "utf8");
  res.writeHead(kod, { "Content-Type": "application/json; charset=utf-8", "Content-Length": g.length, "Cache-Control": "no-store" });
  res.end(g);
};

function okuGovde(req, limit) {
  return new Promise((resolve, reject) => {
    const parcalar = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) {
        reject(Object.assign(new Error("gövde çok büyük"), { kod: 413 }));
        req.resume(); // sokete yazılmaya devam eden veriyi at (yanıt yazılabilsin)
        return;
      }
      parcalar.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parcalar).toString("utf8")));
    req.on("error", reject);
  });
}

const hataMesaji = (e) => String(e?.message ?? e).replace(/\s+/g, " ").slice(0, 200);

/**
 * @param {object} o
 * @param {string} o.dir  Çıktı kökü (SOSYAL_DIR); dosyalar `<dir>/rubrik/<gün>/`
 * @param {() => Promise<any>} o.getBrowser  paylaşılan Chromium (server.mjs)
 * @param {string} o.spherePath
 * @param {string} [o.planUrl]  Vercel yayın ucu (CONTENT_PLAN_URL)
 * @param {string} o.planToken  CONTENT_PLAN_TOKEN — boşsa `bugun`/`sonuc` 503 verir (DORMANT)
 * @param {() => boolean} [o.mesgul]  sosyal üretim (07:55 işi) sürüyor mu → true ise `bugun` 503
 * @param {(m:string)=>void} [o.log]
 * @param {Function} [o.render]  test için sahte çizici
 * @param {typeof fetch} [o.fetchImpl]  test için sahte ağ
 * @param {() => number} [o.now]
 * @param {number} [o.saklananGun]
 */
export function createRubrikYayin({ dir, getBrowser, spherePath, planUrl = VARSAYILAN_PLAN_URL, planToken, mesgul = () => false, log = () => {}, render = renderRubrik, fetchImpl = fetch, now = Date.now, saklananGun = 3 }) {
  let calisiyor = false;
  const kok = path.join(dir, "rubrik");
  const gunDizini = (gun) => path.join(kok, gun);

  // ── Vercel çağrısı ─────────────────────────────────────────────────────────────────────────────────
  async function planCagir(govde) {
    const ctrl = new AbortController();
    const zamanlayici = setTimeout(() => ctrl.abort(), YAYIN_SINIR.planZamanAsimiMs);
    let r;
    let metin;
    try {
      r = await fetchImpl(planUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${planToken}` }, body: JSON.stringify(govde), signal: ctrl.signal });
      metin = await r.text();
    } catch {
      throw new PlanHatasi(502, "yayın planı ucuna ulaşılamadı (ağ/zaman aşımı)", true);
    } finally {
      clearTimeout(zamanlayici);
    }
    if (metin.length > YAYIN_SINIR.planYanitBayt) throw new PlanHatasi(502, "yayın planı yanıtı beklenenden büyük", true);
    let j = null;
    try { j = JSON.parse(metin); } catch { /* gövde JSON değil: j null kalır */ }
    return { kod: r.status, json: j };
  }

  /** Başarısız (200-dışı) Vercel yanıtını kart yanıtına çevirir. `belirsizOlabilir`: `al` 5xx'te içerik alınmış olabilir. */
  function planHatasi(kod, j, belirsizOlabilir) {
    if (kod === 401 || kod === 403) return new PlanHatasi(502, "yayın planı kimliği reddetti — CONTENT_PLAN_TOKEN kartta ve Vercel'de aynı değil");
    if (kod === 503) return new PlanHatasi(503, "yayın planı ucu kapalı — Vercel'de CONTENT_PLAN_TOKEN tanımlı değil");
    if (kod === 404) return new PlanHatasi(502, "yayın planı ucu bulunamadı — Vercel'de v6.334+ yayında mı?");
    const ayrinti = typeof j?.error === "string" ? `: ${j.error.slice(0, 160)}` : "";
    return new PlanHatasi(502, `yayın planı hata verdi (HTTP ${kod}${ayrinti})`, belirsizOlabilir && kod >= 500);
  }

  // ── Dosyalar ───────────────────────────────────────────────────────────────────────────────────────
  function markerOku(gun) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(gunDizini(gun), MARKER), "utf8"));
      return m && Array.isArray(m.items) ? m : null;
    } catch {
      return null;
    }
  }

  function gunleriListele() {
    try {
      return fs.readdirSync(kok, { withFileTypes: true }).filter((e) => e.isDirectory() && GUN_RE.test(e.name)).map((e) => e.name).sort().reverse();
    } catch {
      return [];
    }
  }

  function eskileriTemizle(koru) {
    for (const g of gunleriListele().slice(saklananGun)) {
      if (g !== koru) fs.rmSync(gunDizini(g), { recursive: true, force: true });
    }
  }

  /** Slayt PNG'lerini diske yazar (önce .tmp, sonra rename; bu serinin önceki dosyaları silinir) → listelenecek dosya kaydı. */
  function dosyalariYaz(gun, seriesKey, pngler) {
    const gunDir = gunDizini(gun);
    fs.mkdirSync(gunDir, { recursive: true });
    const onek = `rubrik-${seriesKey}-${gun}-`;
    for (const ad of fs.readdirSync(gunDir)) {
      if (DOSYA_RE.test(ad) && ad.startsWith(onek)) fs.rmSync(path.join(gunDir, ad), { force: true });
    }
    return pngler.map((png, i) => {
      const ad = slaytDosyaAdi(seriesKey, gun, i + 1);
      const gecici = path.join(gunDir, `${ad}.tmp`);
      fs.writeFileSync(gecici, png);
      fs.renameSync(gecici, path.join(gunDir, ad));
      return { ad, boyut: png.length, sira: i + 1 };
    });
  }

  function markerYaz(gun, yeniKayitlar) {
    const eski = markerOku(gun)?.items ?? [];
    const ids = new Set(yeniKayitlar.map((k) => k.id));
    const items = [...eski.filter((k) => !ids.has(k.id)), ...yeniKayitlar];
    const gunDir = gunDizini(gun);
    const gecici = path.join(gunDir, `${MARKER}.tmp`);
    fs.writeFileSync(gecici, JSON.stringify({ surum: 1, gun, items }, null, 2));
    fs.renameSync(gecici, path.join(gunDir, MARKER));
  }

  // ── Çizim: tek öğe ─────────────────────────────────────────────────────────────────────────────────
  /** @returns {Promise<{ id, seriesKey, version, kuru, olusturuldu, dosyalar }>} hata → fırlatır (mesaj kullanıcıya/Vercel'e gidebilir: iç ayrıntı YOK) */
  async function ogeyiCiz(gun, it, kuru) {
    if (it.modelHata) throw new Error(`render modeli geçersiz: ${it.modelHata}`);
    let out;
    try {
      out = await render({ model: it.model, browser: await getBrowser(), spherePath });
    } catch (e) {
      log(`rubrik-yayin: ${gun} render istisnası: ${hataMesaji(e)}`);
      throw new Error("render hatası (kart günlüğüne bakın)");
    }
    const slides = out?.slides ?? [];
    if (slides.length === 0 || slides.length !== it.model.slides.length) throw new Error("render sonucu eksik (slayt sayısı uyuşmuyor)");
    const tasan = slides.findIndex((s) => s.tasma === true);
    if (tasan >= 0) throw new Error(`slayt ${tasan + 1} metni asgari puntoda sığmadı — kısaltın`);
    const pngler = slides.map((s) => (Buffer.isBuffer(s.png) || s.png instanceof Uint8Array ? Buffer.from(s.png) : null));
    const bozuk = pngler.findIndex((b) => !b || b.subarray(0, 8).compare(PNG_IMZA) !== 0);
    if (bozuk >= 0) throw new Error(`slayt ${bozuk + 1} geçerli bir PNG değil`);
    // Disk hatası (izin/doluluk) da render istisnası gibi GENEL mesaja çevrilir: iç yol Vercel'e/yanıta SIZMAZ (ayrıntı yalnız kart günlüğünde).
    try {
      const dosyalar = dosyalariYaz(gun, it.seriesKey, pngler);
      const kayit = { id: it.id, seriesKey: it.seriesKey, version: it.version, kuru, olusturuldu: new Date(now()).toISOString(), dosyalar };
      markerYaz(gun, [kayit]); // öğe BAŞINA (kimliğe göre birikir): sonraki öğe düşse de bu öğenin dosyaları listeli kalır
      return kayit;
    } catch (e) {
      log(`rubrik-yayin: ${gun} disk istisnası: ${hataMesaji(e)}`);
      throw new Error("dosyalar diske yazılamadı (kart günlüğüne bakın)");
    }
  }

  // ── POST /rubrik/bugun ────────────────────────────────────────────────────────────────────────────
  async function bugun(res, url) {
    if (!planToken) return json(res, 503, { hata: "CONTENT_PLAN_TOKEN tanımlı değil — yayın ucu kapalı" });
    const kuru = url.searchParams.get("kuru") === "1";
    let gun = bugunTr(now());
    const gunParam = url.searchParams.get("gun");
    if (gunParam !== null) {
      if (!kuru) return json(res, 400, { hata: "gun yalnız kuru=1 ile verilebilir — canlı alma YALNIZ bugünü alır" });
      if (!gunGecerli(gunParam)) return json(res, 400, { hata: "gun geçerli bir YYYY-AA-GG olmalı" });
      gun = gunParam;
    }
    if (mesgul()) return json(res, 503, { hata: "sosyal üretim sürüyor — sonra deneyin" });
    if (calisiyor) return json(res, 429, { hata: "başka bir yayın hazırlığı sürüyor" });

    calisiyor = true;
    const t0 = now();
    try {
      let plan;
      try {
        const r = await planCagir({ action: kuru ? "bak" : "al", gun });
        if (r.kod !== 200) throw planHatasi(r.kod, r.json, !kuru);
        plan = planYanitiDogrula(r.json);
      } catch (e) {
        if (!(e instanceof PlanHatasi)) throw e;
        log(`rubrik-yayin: ${gun} plan hatası: ${e.message}`);
        return json(res, e.kod, { hata: e.message, belirsiz: e.belirsiz && !kuru });
      }

      const items = [];
      const hatalar = [];
      for (const it of plan.items) {
        try {
          const kayit = await ogeyiCiz(plan.gun, it, kuru);
          items.push({
            id: it.id, version: it.version, seriesKey: it.seriesKey, slotDay: it.slotDay, approvedHash: it.approvedHash,
            altyazi: it.altyazi, caption: it.caption, hashtags: it.hashtags, gorseller: kayit.dosyalar,
          });
        } catch (e) {
          const mesaj = hataMesaji(e);
          let bildirildi = false;
          if (!kuru) {
            // Yayınlanmadığı KESİN → YAYIN HATASI (insan "yeniden dene" der). Bildirilemezse içerik YAYINLANIYOR'da kalır (insan çözer).
            try {
              const r = await planCagir({ action: "sonuc", durum: "hata", id: it.id, version: it.version, hata: `kart: ${mesaj}` });
              bildirildi = r.kod === 200;
            } catch { /* bildirildi=false */ }
          }
          log(`rubrik-yayin: ${plan.gun} ${it.seriesKey} HATA${kuru ? " (kuru)" : ""}${kuru || bildirildi ? "" : " — Vercel'e BİLDİRİLEMEDİ"}`);
          hatalar.push({ id: it.id, seriesKey: it.seriesKey, hata: mesaj, bildirildi });
        }
      }
      if (items.length) {
        try { eskileriTemizle(plan.gun); } catch (e) { log(`rubrik-yayin: eski günler temizlenemedi: ${hataMesaji(e)}`); } // en iyi çaba: hazır içeriği düşürmez
      }
      const sure_sn = Math.round((now() - t0) / 100) / 10;
      log(`rubrik-yayin: ${plan.gun}${kuru ? " KURU" : ""} — ${items.length} öğe, ${hatalar.length} hata, ${plan.atlanan.length} atlanan, ${sure_sn} sn`);
      return json(res, 200, { ok: true, gun: plan.gun, kuru, items, hatalar, atlanan: plan.atlanan, sure_sn });
    } finally {
      calisiyor = false;
    }
  }

  // ── POST /rubrik/sonuc ────────────────────────────────────────────────────────────────────────────
  async function sonuc(req, res) {
    if (!planToken) { req.resume(); return json(res, 503, { hata: "CONTENT_PLAN_TOKEN tanımlı değil — yayın ucu kapalı" }); }
    let raw;
    try { raw = await okuGovde(req, YAYIN_SINIR.sonucGovdeBayt); } catch (e) { return json(res, e?.kod === 413 ? 413 : 400, { hata: e?.kod === 413 ? "gövde çok büyük" : "gövde okunamadı" }); }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return json(res, 400, { hata: "gövde JSON değil" }); }
    const g = sonucGovdeDogrula(parsed);
    if (!g.ok) return json(res, 400, { hata: g.hata });
    try {
      const r = await planCagir(g.govde);
      // Vercel'in KENDİ yanıtı (JSON) aynen geçer: 200 · 400 · 404 yuva yok · 409 geçiş yasak/çakışma. Kimlik (401/403), kapalı (503), JSON-dışı 404 (= uç yok) ve 5xx kart hatasına çevrilir.
      const vercel = r.json && typeof r.json === "object" && !Array.isArray(r.json);
      if (vercel && (r.kod === 200 || (r.kod >= 400 && r.kod < 500 && r.kod !== 401 && r.kod !== 403))) return json(res, r.kod, r.json);
      throw planHatasi(r.kod, r.json, true);
    } catch (e) {
      if (!(e instanceof PlanHatasi)) throw e;
      log(`rubrik-yayin: sonuç iletilemedi: ${e.message}`);
      return json(res, e.kod, { hata: e.message, belirsiz: e.belirsiz });
    }
  }

  // ── GET|HEAD /rubrik/dosya/<gün>/<ad> ─────────────────────────────────────────────────────────────
  async function dosyaGonder(req, res, rest) {
    const parcalar = rest.split("/");
    if (parcalar.length !== 2) return json(res, 404, { hata: "yok" });
    const [gun, ad] = parcalar;
    if (!gunGecerli(gun) || !dosyaAdiGecerli(ad)) return json(res, 404, { hata: "yok" });
    const listeli = markerOku(gun)?.items.some((k) => Array.isArray(k.dosyalar) && k.dosyalar.some((d) => d.ad === ad)); // yalnız TAMAMLANMIŞ içeriğin listeli adları
    if (!listeli) return json(res, 404, { hata: "yok" });
    const yol = path.join(gunDizini(gun), ad);
    let st;
    try { st = fs.statSync(yol); } catch { return json(res, 404, { hata: "yok" }); }
    res.writeHead(200, { "Content-Type": "image/png", "Content-Length": st.size, "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="${ad}"` });
    if (req.method === "HEAD") return res.end();
    await pipeline(fs.createReadStream(yol), res);
  }

  const yontem = (req, res, izinli) => { req.resume(); res.setHeader("Allow", izinli); json(res, 405, { hata: "yöntem desteklenmiyor" }); };

  /** `/rubrik/bugun` · `/rubrik/sonuc` · `/rubrik/dosya/*` isteklerini karşılar; ilgisiz URL (ör. `/rubrik/render`) → false (çağıran kendi yoluna devam eder). */
  async function handle(req, res) {
    let url;
    try { url = new URL(req.url ?? "/", "http://kart.local"); } catch { return false; }
    const p = url.pathname;
    if (p !== "/rubrik/bugun" && p !== "/rubrik/sonuc" && !p.startsWith("/rubrik/dosya/")) return false;
    try {
      if (p === "/rubrik/bugun") {
        if (req.method !== "POST") yontem(req, res, "POST");
        else { req.resume(); await bugun(res, url); }
      } else if (p === "/rubrik/sonuc") {
        if (req.method !== "POST") yontem(req, res, "POST");
        else await sonuc(req, res);
      } else if (req.method !== "GET" && req.method !== "HEAD") {
        yontem(req, res, "GET, HEAD");
      } else {
        await dosyaGonder(req, res, p.slice("/rubrik/dosya/".length));
      }
    } catch (e) {
      if (e?.code !== "ERR_STREAM_PREMATURE_CLOSE") log(`rubrik-yayin: istek hatası: ${hataMesaji(e)}`);
      if (!res.headersSent) json(res, 500, { hata: "sunucu hatası" });
      else res.destroy();
    }
    return true;
  }

  return { handle };
}
