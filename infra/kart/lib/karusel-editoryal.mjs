// Doctorium Post Instagram karuseli — editoryal taslak ucu (karusel planı adım 5, 2026-11-16). YAYINLAMAZ.
// Dondurulmuş edisyondan 6 öğenin kısa Türkçe kart metnini üretir: karusel/editoryal/uret.py (Haiku; deterministik kapılar +
// ikinci model doğrulaması; insan onayı YOK → bir öğe geçmezse gün KALDI, editorial DÖNMEZ).
//
//   POST /karusel/editoryal   Bearer SOCIAL_DIGEST_TOKEN (karusel/rubrik ile aynı kapı)
//        gövde: { edition: {day, rawBodyUtf8, rawBodySha256} }
//        → 200 { gun, karar: "GECTI"|"KALDI", editorial|null, qaEditoryal }  ·  400 girdi  ·  401  ·  413
//        · 429 başka editoryal işi sürüyor  ·  500 üretici hatası  ·  503 jeton/ANTHROPIC_API_KEY yok ya da sosyal üretim sürüyor
// İz: <SOSYAL_DIR>/karusel-editoryal/<gün>/{QA-editoryal.json, editorial.json?} — son 7 gün (kalıcı arşiv n8n'in işi).
// Kaynak sayfaların ham önbelleği İZ'e KONMAZ (üçüncü taraf içeriği) — iş klasörüyle birlikte silinir.
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunGecerli } from "./karusel-v3.mjs";
import { yetkili } from "./social-rubrik.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VARSAYILAN_URETICI = path.join(HERE, "..", "karusel", "editoryal", "uret.py");
export const EDITORYAL_SINIR = { govdeBayt: 2 * 1024 * 1024, ureticiMs: 900_000, cikti: 64 * 1024 };
const SAKLA = 7;
const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export function editoryalGovdeDogrula(g) {
  if (!g || typeof g !== "object" || Array.isArray(g)) return { ok: false, hata: "gövde nesne olmalı" };
  const e = g.edition;
  if (!e || typeof e !== "object") return { ok: false, hata: "edition eksik" };
  if (!gunGecerli(e.day)) return { ok: false, hata: "edition.day geçersiz" };
  if (typeof e.rawBodyUtf8 !== "string" || typeof e.rawBodySha256 !== "string") return { ok: false, hata: "edition gövdesi eksik" };
  return { ok: true, gun: e.day, edition: e };
}

/** Python üreticisini çalıştırır (kabuk YOK). ANTHROPIC_API_KEY yalnız alt sürecin ortamına geçer; günlüğe yazılmaz. */
// Konteynerde ayrı sanal ortam (Dockerfile: KARUSEL_PY — anthropic + pydantic yalnız orada); çizici sistem python3'ünde kalır.
function pythonUretici(yol, python = process.env.KARUSEL_PY || "python3") {
  return (girdi, cikti) => new Promise((resolve) => {
    execFile(python, [yol, girdi, cikti], { timeout: EDITORYAL_SINIR.ureticiMs, maxBuffer: EDITORYAL_SINIR.cikti,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } },
    (err, stdout, stderr) => resolve({ kod: err ? (typeof err.code === "number" ? err.code : -1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") }));
  });
}

const sonSatirJson = (s) => {
  try { return JSON.parse(String(s).trim().split("\n").pop() ?? ""); } catch { return null; }
};

/**
 * @param {object} o
 * @param {string} o.dir  SOSYAL_DIR → <dir>/karusel-editoryal/<gün>/
 * @param {string} o.token  SOCIAL_DIGEST_TOKEN — boşsa 503
 * @param {boolean} o.modelHazir  ANTHROPIC_API_KEY tanımlı mı — değilse 503 (uç kapalı; değer bu modüle GELMEZ)
 * @param {() => boolean} [o.mesgul]
 * @param {(girdi:string, cikti:string) => Promise<{kod:number, stdout:string, stderr:string}>} [o.uretici]  test için sahte
 * @param {(m:string)=>void} [o.log]
 */
export function createKaruselEditoryal({ dir, token, modelHazir, mesgul = () => false, uretici = pythonUretici(VARSAYILAN_URETICI), log = () => {} }) {
  const kok = path.join(dir, "karusel-editoryal");
  let calisiyor = false;

  function eskileriTemizle() {
    const gunler = fs.readdirSync(kok, { withFileTypes: true }).filter((e) => e.isDirectory() && GUN_RE.test(e.name)).map((e) => e.name).sort().reverse();
    for (const g of gunler.slice(SAKLA)) fs.rmSync(path.join(kok, g), { recursive: true, force: true });
  }

  async function uret(req, res) {
    if (!token) { req.resume(); return json(res, 503, { hata: "SOCIAL_DIGEST_TOKEN tanımlı değil — uç kapalı" }); }
    if (!yetkili(req.headers.authorization, token)) { req.resume(); return json(res, 401, { hata: "yetkisiz" }); }
    if (!modelHazir) { req.resume(); return json(res, 503, { hata: "ANTHROPIC_API_KEY tanımlı değil — uç kapalı" }); }
    if (mesgul()) { req.resume(); return json(res, 503, { hata: "sosyal üretim sürüyor — sonra deneyin" }); }
    if (calisiyor) { req.resume(); return json(res, 429, { hata: "başka bir editoryal işi sürüyor" }); }
    calisiyor = true;
    let isDir;
    try {
      let raw;
      try { raw = await okuGovde(req, EDITORYAL_SINIR.govdeBayt); } catch (e) {
        return json(res, e?.kod === 413 ? 413 : 400, { hata: e?.kod === 413 ? "gövde çok büyük" : "gövde okunamadı" });
      }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return json(res, 400, { hata: "gövde JSON değil" }); }
      const g = editoryalGovdeDogrula(parsed);
      if (!g.ok) return json(res, 400, { hata: g.hata });

      fs.mkdirSync(kok, { recursive: true });
      isDir = fs.mkdtempSync(path.join(kok, `.is-${g.gun}-`));
      const girdi = path.join(isDir, "girdi");
      const cikti = path.join(isDir, "cikti");
      fs.mkdirSync(girdi, { recursive: true });
      fs.writeFileSync(path.join(girdi, "edition.json"), JSON.stringify(g.edition));

      const t0 = Date.now();
      const r = await uretici(girdi, cikti);
      const sonuc = sonSatirJson(r.stdout);
      if (r.kod !== 0 && r.kod !== 1) {
        const hata = typeof sonuc?.hata === "string" ? sonuc.hata.slice(0, 300) : "üretici hatası (kart günlüğüne bakın)";
        log(`karusel-editoryal ${g.gun}: çıkış ${r.kod} — ${hata}${r.stderr ? ` · ${r.stderr.trim().split("\n").pop()?.slice(0, 300)}` : ""}`);
        return json(res, r.kod === 2 ? 400 : 500, { hata });
      }
      const qaEditoryal = JSON.parse(fs.readFileSync(path.join(cikti, "QA-editoryal.json"), "utf8"));
      const edYol = path.join(cikti, "editorial.json");
      const gecti = r.kod === 0 && qaEditoryal.gun === "GECTI" && fs.existsSync(edYol);
      const editorial = gecti ? JSON.parse(fs.readFileSync(edYol, "utf8")) : null;
      // İz: yalnız QA + (geçtiyse) editorial — kaynak önbelleği (cikti/onbellek) kopyalanmaz.
      const hedef = path.join(kok, g.gun);
      fs.rmSync(hedef, { recursive: true, force: true });
      fs.mkdirSync(hedef, { recursive: true });
      fs.copyFileSync(path.join(cikti, "QA-editoryal.json"), path.join(hedef, "QA-editoryal.json"));
      if (editorial) fs.copyFileSync(edYol, path.join(hedef, "editorial.json"));
      try { eskileriTemizle(); } catch (e) { log(`karusel-editoryal: eski günler temizlenemedi: ${e?.message ?? e}`); }
      log(`karusel-editoryal ${g.gun}: ${gecti ? "GEÇTİ" : "KALDI"} · ${qaEditoryal.cagri} çağrı · ≈${qaEditoryal.tahminiUsd} $ (${Date.now() - t0} ms)`);
      return json(res, 200, { gun: g.gun, karar: gecti ? "GECTI" : "KALDI", editorial, qaEditoryal });
    } catch (e) {
      log(`karusel-editoryal: beklenmeyen hata — ${e?.message ?? e}`);
      return json(res, 500, { hata: "editoryal işi tamamlanamadı (kart günlüğüne bakın)" });
    } finally {
      calisiyor = false;
      if (isDir) fs.rmSync(isDir, { recursive: true, force: true });
    }
  }

  async function handle(req, res) {
    let url;
    try { url = new URL(req.url ?? "/", "http://kart.local"); } catch { return false; }
    if (url.pathname !== "/karusel/editoryal") return false;
    if (req.method !== "POST") { req.resume(); res.setHeader("Allow", "POST"); json(res, 405, { hata: "yöntem desteklenmiyor" }); return true; }
    await uret(req, res);
    return true;
  }

  return { handle, calisiyor: () => calisiyor };
}
