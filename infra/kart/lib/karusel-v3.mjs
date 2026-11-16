// Doctorium Post Instagram karuseli — v3 çizici ucu (2026-11-15, karusel hattı plan adım 3). YAYINLAMAZ.
// Onaylı v3 tasarımı Python + Pillow (RAQM) ile çizilir: karusel/render.py (Atölye paketinin BAYT BAYT kopyası üzerinde).
// Bu modül yalnız iş klasörünü hazırlar, çiziciyi çağırır ve çıktıyı sunar. Metin/görsel ÜRETMEZ; kalite kapısı ayrı adımdır.
//
//   POST /karusel/uret   Bearer SOCIAL_DIGEST_TOKEN (rubrik/render ile aynı kapı; n8n kendi sırrını taşımaz)
//        gövde: { edition: {day, rawBodyUtf8, rawBodySha256}, editorial: {...}, gorseller: {"kapak.png": base64, "haber-1.png": …},
//                 kapi?: { qaEditoryal, qaGorsel } }   ← 2026-11-16 (adım 5): verilirse çizimden SONRA karusel/editoryal/kalite_kapisi.py
//                 koşar (insan onayı yok; fail-closed) → kapi = {karar GECTI|KALDI, muhur, sorunlar, baglar}; verilmezse kapi: null
//        → 200 { gun, dosyalar: [{ad, sha256}], qa, kapi }  ·  400 girdi  ·  401  ·  413  ·  422 çizici reddetti (sığmadı/eşleşmedi)
//        · 429 başka karusel işi sürüyor  ·  500 kapanış kilidi tutmadı / çizici hatası  ·  503 jeton yok ya da sosyal üretim sürüyor
//   GET|HEAD /karusel/dosya/<gün>/<01-08>.png   yalnız `bitti.json`'da listeli dosyalar (yarım iş GÖRÜNMEZ). Instagram
//        konteyner oluştururken bu adresi kimliksiz çeker → jetonsuz; yalnız tamamlanmış PNG'ler.
//   GET /karusel/kapi/<gün>   Bearer — o günün kapı kararı (kapı koşulmadıysa 404). Yayın adımı mührü dosyalarla YENİDEN doğrular.
// Çıktı kökü <SOSYAL_DIR>/karusel/<gün>/ — 07:55 sosyal işinin gün klasöründen ve rubrik klasöründen AYRI.
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { yetkili } from "./social-rubrik.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VARSAYILAN_CIZICI = path.join(HERE, "..", "karusel", "render.py");
export const KARUSEL_SINIR = { govdeBayt: 40 * 1024 * 1024, gorselBayt: 8 * 1024 * 1024, ciziciMs: 180_000, cikti: 64 * 1024 };
export const GORSEL_ADLARI = ["kapak.png", "haber-1.png", "haber-2.png", "haber-3.png", "haber-4.png", "haber-5.png", "haber-6.png"];
const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAKLA = 7; // gün klasörü sayısı (arşiv sunucu tarafında n8n'in işi — burası yalnız yayın için geçici depo)
const DOSYA_RE = /^0[1-8]\.png$/;
const PNG_IMZA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const karuselDosyaAdiGecerli = (s) => typeof s === "string" && DOSYA_RE.test(s);

export function gunGecerli(s) {
  if (typeof s !== "string" || !GUN_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const json = (res, kod, nesne) => {
  const g = Buffer.from(JSON.stringify(nesne), "utf8");
  res.writeHead(kod, { "Content-Type": "application/json; charset=utf-8", "Content-Length": g.length });
  res.end(g);
};

function okuGovde(req, limit) {
  return new Promise((resolve, reject) => {
    const parcalar = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error("gövde çok büyük"), { kod: 413 })); req.resume(); return; }
      parcalar.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parcalar).toString("utf8")));
    req.on("error", reject);
  });
}

/** Gövdeyi doğrular; çözülmüş görselleri döndürür. Ayrıntılı içerik denetimi çizicidedir (edisyon hash'i, URL eşleşmesi, sığdırma). */
export function karuselGovdeDogrula(g) {
  if (!g || typeof g !== "object" || Array.isArray(g)) return { ok: false, hata: "gövde nesne olmalı" };
  const { edition, editorial, gorseller } = g;
  if (!edition || typeof edition !== "object") return { ok: false, hata: "edition eksik" };
  if (!gunGecerli(edition.day)) return { ok: false, hata: "edition.day geçersiz" };
  if (typeof edition.rawBodyUtf8 !== "string" || typeof edition.rawBodySha256 !== "string") return { ok: false, hata: "edition gövdesi eksik" };
  if (!editorial || typeof editorial !== "object" || editorial.day !== edition.day) return { ok: false, hata: "editorial günü edisyonla uyuşmuyor" };
  if (!gorseller || typeof gorseller !== "object") return { ok: false, hata: "gorseller eksik" };
  const adlar = Object.keys(gorseller).sort();
  if (adlar.join(",") !== [...GORSEL_ADLARI].sort().join(",")) return { ok: false, hata: `gorseller tam olarak şu adları içermeli: ${GORSEL_ADLARI.join(", ")}` };
  const cozulmus = {};
  for (const ad of GORSEL_ADLARI) {
    const v = gorseller[ad];
    if (typeof v !== "string" || !/^[A-Za-z0-9+/=\s]+$/.test(v)) return { ok: false, hata: `${ad}: base64 değil` };
    const b = Buffer.from(v, "base64");
    if (b.length === 0 || b.length > KARUSEL_SINIR.gorselBayt) return { ok: false, hata: `${ad}: boyut sınırı dışında` };
    if (!b.subarray(0, 8).equals(PNG_IMZA)) return { ok: false, hata: `${ad}: PNG değil` };
    cozulmus[ad] = b;
  }
  // İsteğe bağlı kalite kapısı (adım 5): editoryal + görsel QA kayıtları gelirse çizimden sonra kalite_kapisi.py koşar.
  let kapi = null;
  if (g.kapi !== undefined) {
    const k = g.kapi;
    if (!k || typeof k !== "object" || Array.isArray(k)) return { ok: false, hata: "kapi nesne olmalı" };
    for (const a of ["qaEditoryal", "qaGorsel"]) if (!k[a] || typeof k[a] !== "object" || Array.isArray(k[a])) return { ok: false, hata: `kapi.${a} eksik` };
    kapi = { qaEditoryal: k.qaEditoryal, qaGorsel: k.qaGorsel };
  }
  return { ok: true, gun: edition.day, edition, editorial, gorseller: cozulmus, kapi };
}

export const VARSAYILAN_KAPI = path.join(HERE, "..", "karusel", "editoryal", "kalite_kapisi.py");

/** kalite_kapisi.py: çıkış 0 = GEÇTİ · 1 = KALDI; karar <girdi>/QA.json'a yazılır. */
function pythonKapi(yol, python = "python3") {
  return (girdi, cikti, edition) => new Promise((resolve) => {
    execFile(python, [yol, girdi, cikti, edition], { timeout: 60_000, maxBuffer: KARUSEL_SINIR.cikti, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } },
      (err, stdout, stderr) => resolve({ kod: err ? (typeof err.code === "number" ? err.code : -1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") }));
  });
}

/** Çiziciyi çalıştırır; { kod, stdout } döner (kabuk YOK, argüman dizisi). */
function pythonCizici(ciziciYolu, python = "python3") {
  return (girdi, cikti) => new Promise((resolve) => {
    execFile(python, [ciziciYolu, girdi, cikti], { timeout: KARUSEL_SINIR.ciziciMs, maxBuffer: KARUSEL_SINIR.cikti, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } },
      (err, stdout, stderr) => resolve({ kod: err ? (typeof err.code === "number" ? err.code : -1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") }));
  });
}

const sonSatirJson = (s) => {
  const satir = String(s).trim().split("\n").pop() ?? "";
  try { return JSON.parse(satir); } catch { return null; }
};

/**
 * @param {object} o
 * @param {string} o.dir  çıktı kökü (SOSYAL_DIR) → <dir>/karusel/<gün>/
 * @param {string} o.token  SOCIAL_DIGEST_TOKEN — boşsa POST 503 (kapalı kapı)
 * @param {() => boolean} [o.mesgul]  07:55 sosyal işi sürüyor mu → POST 503
 * @param {(girdi:string, cikti:string) => Promise<{kod:number, stdout:string, stderr:string}>} [o.cizici]  test için sahte çizici
 * @param {(girdi:string, cikti:string, edition:string) => Promise<{kod:number, stdout:string, stderr:string}>} [o.kapici]  test için sahte kapı
 * @param {(m:string)=>void} [o.log]
 */
export function createKarusel({ dir, token, mesgul = () => false, cizici = pythonCizici(VARSAYILAN_CIZICI), kapici = pythonKapi(VARSAYILAN_KAPI), log = () => {} }) {
  const kok = path.join(dir, "karusel");
  const gunDizini = (gun) => path.join(kok, gun);
  let calisiyor = false;

  /** Son SAKLA günü tutar; daha eski gün klasörlerini ve yarım kalmış `.is-*` / `.eski-*` klasörlerini siler (en iyi çaba). */
  function eskileriTemizle(koru) {
    const girdiler = fs.readdirSync(kok, { withFileTypes: true }).filter((e) => e.isDirectory());
    const gunler = girdiler.filter((e) => GUN_RE.test(e.name)).map((e) => e.name).sort().reverse();
    for (const g of gunler.slice(SAKLA)) if (g !== koru) fs.rmSync(gunDizini(g), { recursive: true, force: true });
    for (const e of girdiler) if (/^\.(eski|is)-/.test(e.name) && !e.name.includes(`-${process.pid}-`)) {
      try { if (Date.now() - fs.statSync(path.join(kok, e.name)).mtimeMs > 3600_000) fs.rmSync(path.join(kok, e.name), { recursive: true, force: true }); } catch { /* en iyi çaba */ }
    }
  }

  function markerOku(gun) {
    try { return JSON.parse(fs.readFileSync(path.join(gunDizini(gun), "bitti.json"), "utf8")); } catch { return null; }
  }

  async function uret(req, res) {
    if (!token) { req.resume(); return json(res, 503, { hata: "SOCIAL_DIGEST_TOKEN tanımlı değil — uç kapalı" }); }
    if (!yetkili(req.headers.authorization, token)) { req.resume(); return json(res, 401, { hata: "yetkisiz" }); }
    if (mesgul()) { req.resume(); return json(res, 503, { hata: "sosyal üretim sürüyor — sonra deneyin" }); }
    if (calisiyor) { req.resume(); return json(res, 429, { hata: "başka bir karusel işi sürüyor" }); }
    calisiyor = true;
    let isDir;
    try {
      let raw;
      try { raw = await okuGovde(req, KARUSEL_SINIR.govdeBayt); } catch (e) {
        return json(res, e?.kod === 413 ? 413 : 400, { hata: e?.kod === 413 ? "gövde çok büyük" : "gövde okunamadı" });
      }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return json(res, 400, { hata: "gövde JSON değil" }); }
      const g = karuselGovdeDogrula(parsed);
      if (!g.ok) return json(res, 400, { hata: g.hata });

      fs.mkdirSync(kok, { recursive: true });
      isDir = fs.mkdtempSync(path.join(kok, `.is-${g.gun}-`));
      const girdi = path.join(isDir, "girdi");
      const cikti = path.join(isDir, "cikti");
      fs.mkdirSync(path.join(girdi, "gorseller"), { recursive: true });
      fs.writeFileSync(path.join(girdi, "edition.json"), JSON.stringify(g.edition));
      fs.writeFileSync(path.join(girdi, "editorial.json"), JSON.stringify(g.editorial));
      for (const [ad, b] of Object.entries(g.gorseller)) fs.writeFileSync(path.join(girdi, "gorseller", ad), b);

      const t0 = Date.now();
      const r = await cizici(girdi, cikti);
      const sonuc = sonSatirJson(r.stdout);
      if (r.kod !== 0) {
        const hata = typeof sonuc?.hata === "string" ? sonuc.hata.slice(0, 500) : "çizici hatası (kart günlüğüne bakın)";
        log(`karusel ${g.gun}: çizici çıkış ${r.kod} — ${hata}${r.stderr ? ` · ${r.stderr.trim().split("\n").pop()?.slice(0, 300)}` : ""}`);
        return json(res, r.kod === 2 ? 422 : 500, { hata });
      }
      const qa = JSON.parse(fs.readFileSync(path.join(cikti, "QA.json"), "utf8"));
      const dosyalar = [];
      for (let n = 1; n <= 8; n++) {
        const ad = `${String(n).padStart(2, "0")}.png`;
        const b = fs.readFileSync(path.join(cikti, ad));
        dosyalar.push({ ad, sha256: crypto.createHash("sha256").update(b).digest("hex") });
      }
      // Kalite kapısı (yalnız `kapi` geldiyse). FAIL-CLOSED: GEÇTİ yalnız çıkış 0 + QA.json karar GECTI + mühür; aksi her durum KALDI.
      let kapi = null;
      if (g.kapi) {
        fs.writeFileSync(path.join(girdi, "QA-editoryal.json"), JSON.stringify(g.kapi.qaEditoryal));
        fs.writeFileSync(path.join(girdi, "QA-gorsel.json"), JSON.stringify(g.kapi.qaGorsel));
        const kr = await kapici(girdi, cikti, path.join(girdi, "edition.json"));
        let karar = null;
        try { karar = JSON.parse(fs.readFileSync(path.join(girdi, "QA.json"), "utf8")); } catch { /* aşağıda KALDI */ }
        const gecti = kr.kod === 0 && karar?.karar === "GECTI" && typeof karar?.muhur === "string";
        kapi = gecti ? karar : { ...(karar ?? {}), kind: "karusel-kalite-kapisi", day: g.gun, karar: "KALDI", muhur: null,
          sorunlar: karar?.sorunlar?.length ? karar.sorunlar : [`kapı çalışmadı (çıkış ${kr.kod})`] };
        fs.writeFileSync(path.join(cikti, "kapi.json"), JSON.stringify(kapi));
        log(`karusel ${g.gun}: kapı ${kapi.karar}${gecti ? "" : ` — ${kapi.sorunlar.slice(0, 3).join(" · ")}`}`);
      }
      // Yayına hazır klasör: önce eskisini kenara al, sonra yenisini yerine koy; bitti.json EN SON yazılır (yarım iş görünmez).
      // Eski günün kapi.json'u klasörle birlikte gider → kapısız yeniden çizim eski GEÇTİ kararını TAŞIMAZ.
      const hedef = gunDizini(g.gun);
      const eski = `${hedef}.eski-${process.pid}-${Date.now()}`;
      if (fs.existsSync(hedef)) fs.renameSync(hedef, eski);
      fs.renameSync(cikti, hedef);
      fs.writeFileSync(path.join(hedef, "bitti.json"), JSON.stringify({ gun: g.gun, olusturuldu: new Date().toISOString(), dosyalar,
        kapi: kapi ? { karar: kapi.karar, muhur: kapi.muhur } : null }));
      fs.rmSync(eski, { recursive: true, force: true });
      try { eskileriTemizle(g.gun); } catch (e) { log(`karusel: eski günler temizlenemedi: ${e?.message ?? e}`); }
      log(`karusel ${g.gun}: 8 kart çizildi (${Date.now() - t0} ms)`);
      return json(res, 200, { gun: g.gun, dosyalar, qa, kapi });
    } catch (e) {
      log(`karusel: beklenmeyen hata — ${e?.message ?? e}`);
      return json(res, 500, { hata: "karusel işi tamamlanamadı (kart günlüğüne bakın)" });
    } finally {
      calisiyor = false;
      if (isDir) fs.rmSync(isDir, { recursive: true, force: true });
    }
  }

  async function dosyaGonder(req, res, rest) {
    const parcalar = rest.split("/");
    if (parcalar.length !== 2) return json(res, 404, { hata: "yok" });
    const [gun, ad] = parcalar;
    if (!gunGecerli(gun) || !karuselDosyaAdiGecerli(ad)) return json(res, 404, { hata: "yok" });
    if (!markerOku(gun)?.dosyalar?.some((d) => d.ad === ad)) return json(res, 404, { hata: "yok" });
    const yol = path.join(gunDizini(gun), ad);
    let st;
    try { st = fs.statSync(yol); } catch { return json(res, 404, { hata: "yok" }); }
    res.writeHead(200, { "Content-Type": "image/png", "Content-Length": st.size, "Cache-Control": "no-store" });
    if (req.method === "HEAD") return res.end();
    await pipeline(fs.createReadStream(yol), res);
  }

  /** GET /karusel/kapi/<gün> (Bearer): o günün kapı kararı — 07:50 akışının "karusel GEÇTİ mi?" okuması (plan adım 8) içindir. */
  function kapiGonder(req, res, gun) {
    if (!token) return json(res, 503, { hata: "SOCIAL_DIGEST_TOKEN tanımlı değil — uç kapalı" });
    if (!yetkili(req.headers.authorization, token)) return json(res, 401, { hata: "yetkisiz" });
    if (!gunGecerli(gun) || !markerOku(gun)) return json(res, 404, { hata: "yok" });
    try { return json(res, 200, JSON.parse(fs.readFileSync(path.join(gunDizini(gun), "kapi.json"), "utf8"))); } catch {
      return json(res, 404, { hata: "bu gün için kapı koşulmadı" });
    }
  }

  /** `/karusel/uret` · `/karusel/dosya/*` · `/karusel/kapi/*` dışındaki URL'lerde false döner (çağıran kendi yoluna devam eder). */
  async function handle(req, res) {
    let url;
    try { url = new URL(req.url ?? "/", "http://kart.local"); } catch { return false; }
    const p = url.pathname;
    if (p === "/karusel/uret") {
      if (req.method !== "POST") { req.resume(); res.setHeader("Allow", "POST"); json(res, 405, { hata: "yöntem desteklenmiyor" }); return true; }
      await uret(req, res);
      return true;
    }
    if (p.startsWith("/karusel/dosya/")) {
      if (req.method !== "GET" && req.method !== "HEAD") { req.resume(); res.setHeader("Allow", "GET, HEAD"); json(res, 405, { hata: "yöntem desteklenmiyor" }); return true; }
      await dosyaGonder(req, res, p.slice("/karusel/dosya/".length));
      return true;
    }
    if (p.startsWith("/karusel/kapi/")) {
      req.resume();
      if (req.method !== "GET") { res.setHeader("Allow", "GET"); json(res, 405, { hata: "yöntem desteklenmiyor" }); return true; }
      kapiGonder(req, res, p.slice("/karusel/kapi/".length));
      return true;
    }
    return false;
  }

  return { handle, calisiyor: () => calisiyor };
}
