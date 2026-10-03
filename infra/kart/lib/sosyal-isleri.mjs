// Doctorium sosyal VİDEO + carousel işleri (v6.320 · carousel v6.323) — `kart` servisinin arka plan üretim yöneticisi.
//
// Sözleşme (n8n tarafı):
//   POST /sosyal/uret[?yenile=1] → 202 üretim başladı · 200 o günün klipleri HAZIR (idempotent) ya da boş gün (`bos_gun`) · 409 başka iş sürüyor ·
//                                  502 seçki alınamadı/geçersiz · 503 müzik dosyası yok
//   GET  /sosyal/durum           → { durum: "bos" | "calisiyor" | "hazir" | "hata", gun, … } (n8n `gun`u kendi beklediği günle karşılaştırır)
//   GET|HEAD /sosyal/dosya/<gün>/<ad> → MP4 (`dosyalar`) ya da PNG (`gorseller`) — yalnız `hazir` günün, `bitti.json`'da listeli adlar
//
// 🪤 GERİYE UYUM (v6.323): carousel slaytları `dosyalar`a DEĞİL ayrı `gorseller` dizisine yazılır. Çalışan n8n akışı `dosyalar`daki HER öğeyi indirip
//   MP4 imzası (`ftyp`) arar → PNG'yi `dosyalar`a koymak, sunucu güncellendiği anda 07:55 koşusunu düşürürdü. `gorseller` yoksa/boşsa eski istemci etkilenmez.
//
// Tasarım kararları:
//   · TEK iş (2 vCPU paylaşımlı VPS): ikinci POST kuyruğa girmez, 409 alır. Kilit, seçki çekilmeden ÖNCE alınır → iki eşzamanlı POST ikisi de geçemez.
//   · TEK seçki anlık görüntüsü: kart + hikâyeler + Reel AYNI `digest` nesnesinden üretilir (seçki ucu gün içinde değişse bile klipler birbiriyle tutarlı).
//   · Yarım iş GÖRÜNMEZ: klipler `<dir>/<gün>/`e yazılır, `bitti.json` EN SON ve atomik (tmp + rename) yazılır; dosya ucu yalnız onda listeli adları sunar.
//   · Hata → üretim fiilen başladıysa gün klasörü silinir, durum `hata` (bellekte). Kalıcı durum yalnız diskteki `bitti.json`'dur
//     → konteyner yeniden başlarsa `bos`/`hazir` döner. Başarısız bir `yenile` üretim BAŞLAMADAN düştüyse (ör. müzik yok) önceki iyi klipler KORUNUR.
//   · Saklama: en yeni 2 gün klasörü (kalıcı arşivi n8n `bulten-arsiv/`ye yazar).
//   · Sızıntı yok: jeton buraya GİRMEZ (`getDigest` dışarıdan verilir); günlükte içerik/başlık yok, yalnız gün + sayı + süre.
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;
const AD_RE = /^[a-z0-9][a-z0-9-]*\.mp4$/;
const GORSEL_RE = /^carousel-\d{4}-\d{2}-\d{2}-\d{2}-(?:kart|icerik-\d+|kapanis)\.png$/;
const MARKER = "bitti.json";
const GECICI = ".is";
const TUR_SIRA = { hikaye: 0, reel: 1, diger: 2 };

export const gunGecerli = (s) => typeof s === "string" && GUN_RE.test(s);
export const dosyaAdiGecerli = (s) => typeof s === "string" && AD_RE.test(s);
export const gorselAdiGecerli = (s) => typeof s === "string" && GORSEL_RE.test(s);

/**
 * Seçki JSON'unu üretimden ÖNCE doğrular: eksik alanla şablon "undefined" yazardı. `day` dosya yoluna girer → biçimi katı.
 * Boş gün (items: []) geçerlidir (üretilmez ama hata da değildir).
 */
export function digestDogrula(d) {
  if (!d || typeof d !== "object") throw new Error("seçki JSON'u geçersiz");
  if (!gunGecerli(d.day)) throw new Error("seçkide `day` yok ya da biçimi YYYY-AA-GG değil");
  if (!Array.isArray(d.items)) throw new Error("seçkide `items` dizisi yok");
  d.items.forEach((it, i) => {
    for (const k of ["title", "streamLabel", "sourceName"]) {
      if (typeof it?.[k] !== "string" || !it[k].trim()) throw new Error(`öğe ${i + 1}: \`${k}\` yok`);
    }
    if (typeof it.summaryLong !== "string" || !it.summaryLong.trim()) throw new Error(`öğe ${i + 1}: \`summaryLong\` yok — seçki ucu v6.317 ve sonrası olmalı`);
  });
}

/**
 * Durum yanıtındaki kapsam özeti: kaç öğe, kaçında dürüst yedek cümle (`summaryLongFallback`) kullanıldı, günün akışları.
 * `akislar` = akış etiketleri (`streamLabel`), seçki sırasıyla, TEKRARSIZ — Reel/carousel altyazısının akış satırı için (n8n büyük harfe çevirip " · " ile birleştirir).
 */
export function kapsamHesapla(d) {
  return {
    ogeSayisi: d.items.length,
    yedekSayisi: d.items.filter((it) => it.summaryLongFallback === true).length,
    akislar: [...new Set(d.items.map((it) => it.streamLabel))],
  };
}

/** Dosya adından yayın bilgisi: hikâye `sira` = klip numarası (01-kart → 1), Reel → 1. */
export function dosyaMeta(ad) {
  const h = /^hikaye-\d{4}-\d{2}-\d{2}-(\d{2})-/.exec(ad);
  if (h) return { tur: "hikaye", sira: Number(h[1]) };
  if (/^reels-[a-z0-9]+-\d{4}-\d{2}-\d{2}\.mp4$/.test(ad)) return { tur: "reel", sira: 1 };
  return { tur: "diger", sira: 0 };
}

function dosyalariListele(gunDir) {
  return fs.readdirSync(gunDir)
    .filter((ad) => dosyaAdiGecerli(ad))
    .map((ad) => ({ ad, boyut: fs.statSync(path.join(gunDir, ad)).size, ...dosyaMeta(ad) }))
    .sort((a, b) => (TUR_SIRA[a.tur] - TUR_SIRA[b.tur]) || (a.sira - b.sira) || a.ad.localeCompare(b.ad));
}

/** Carousel slaytı: `sira` = slayt numarası (01-kart → 1; sonuncusu kapanış). */
export function gorselMeta(ad) {
  const m = /^carousel-\d{4}-\d{2}-\d{2}-(\d{2})-/.exec(ad);
  return { tur: "carousel", sira: m ? Number(m[1]) : 0 };
}

function gorselleriListele(gunDir) {
  return fs.readdirSync(gunDir)
    .filter((ad) => gorselAdiGecerli(ad))
    .map((ad) => ({ ad, boyut: fs.statSync(path.join(gunDir, ad)).size, ...gorselMeta(ad) }))
    .sort((a, b) => a.sira - b.sira);
}

function json(res, kod, govde) {
  const s = JSON.stringify(govde);
  res.writeHead(kod, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(s), "Cache-Control": "no-store" });
  res.end(s);
}

const hataMesaji = (e) => String(e?.message ?? e).slice(0, 500);

/**
 * @typedef {object} SosyalSecenekler
 * @property {string} dir Çıktı kökü (gün klasörleri burada açılır; ör. /tmp/sosyal).
 * @property {() => Promise<any>} getDigest Seçkiyi çeker (jetonu bilen taraf; burada YOK).
 * @property {(digest: any) => Promise<Buffer | null>} renderCardPng Paylaşımla AYNI kart PNG'si (boş gün → null).
 * @property {{ renderStories: Function, renderReelA: Function, renderCarousel: Function }} uretici `lib/social-video.mjs` + `lib/social-carousel.mjs`.
 * @property {() => Promise<any>} getBrowser Paylaşılan Playwright tarayıcısı.
 * @property {string} muzikPath Müzik MP3'ü (repo DIŞI; sunucuda `/varlik/muzik.mp3`).
 * @property {string} spherePath Küre görseli.
 * @property {any} grid Vuruş ızgarası nesnesi ya da onu (tembel) döndüren işlev.
 * @property {number} [workers] Reel için paralel Playwright sayfası (vars. 2 = 2 vCPU ölçümü).
 * @property {(m: string) => void} [log]
 * @property {() => number} [now]
 * @property {number} [saklananGun] Diskte tutulan en yeni gün klasörü sayısı (vars. 2).
 */

/** @param {SosyalSecenekler} o */
export function createSosyal(o) {
  const { dir, getDigest, renderCardPng, uretici, getBrowser, muzikPath, spherePath } = o;
  const gridAl = typeof o.grid === "function" ? o.grid : () => o.grid;
  const workers = o.workers ?? 2;
  const log = o.log ?? (() => {});
  const now = o.now ?? Date.now;
  const saklananGun = o.saklananGun ?? 2;

  /** @type {null | { gun: string | null, basladi: number, asama: string, kapsam: any }} */
  let calisan = null;
  /** @type {null | { gun: string | null, mesaj: string, adim: string, zaman: string }} */
  let sonHata = null;

  const gunDizini = (gun) => path.join(dir, gun);

  function okuBitti(gun) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(gunDizini(gun), MARKER), "utf8"));
      return j && Array.isArray(j.dosyalar) ? j : null;
    } catch {
      return null;
    }
  }

  function gunleriListele() {
    try {
      return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && GUN_RE.test(e.name)).map((e) => e.name).sort().reverse();
    } catch {
      return [];
    }
  }

  function eskileriTemizle(koru) {
    for (const g of gunleriListele().slice(saklananGun)) {
      if (g !== koru) fs.rmSync(gunDizini(g), { recursive: true, force: true });
    }
  }

  // `gorseller`: v6.320'de yazılmış (carousel öncesi) bitti.json'da yok → [] (eski kayıt hâlâ geçerli).
  const govdeHazir = (b) => ({ durum: "hazir", gun: b.gun, dosyalar: b.dosyalar, gorseller: Array.isArray(b.gorseller) ? b.gorseller : [], kapsam: b.kapsam, sure_sn: b.sure_sn, olusturuldu: b.olusturuldu });

  function durumGovdesi() {
    if (calisan) {
      return { durum: "calisiyor", gun: calisan.gun, asama: calisan.asama, gecen_sn: Math.round((now() - calisan.basladi) / 1000), kapsam: calisan.kapsam };
    }
    if (sonHata) return { durum: "hata", gun: sonHata.gun, hata: sonHata.mesaj, adim: sonHata.adim, zaman: sonHata.zaman };
    for (const g of gunleriListele()) {
      const b = okuBitti(g);
      if (b) return govdeHazir(b);
    }
    return { durum: "bos" };
  }

  /** Bu gün (ya da gün bilinmeden düşen) için bayat bir hata kaydı varsa siler. */
  function sonHataTemizle(gun) {
    if (sonHata && (sonHata.gun === null || sonHata.gun === gun)) sonHata = null;
  }

  async function isiCalistir(digest) {
    const gun = digest.day;
    const gunDir = gunDizini(gun);
    const workDir = path.join(gunDir, GECICI);
    const t0 = now();
    let basladi = false; // gün klasörüne dokunulduktan SONRA true → hata durumunda silme yalnız o zaman
    try {
      calisan.asama = "hazirlik";
      fs.rmSync(gunDir, { recursive: true, force: true });
      fs.mkdirSync(workDir, { recursive: true });
      basladi = true;
      const browser = await getBrowser();

      calisan.asama = "kart";
      const cardPng = await renderCardPng(digest);
      if (!cardPng) throw new Error("kart üretilemedi (boş seçki)");
      const cardPath = path.join(workDir, "kart-1080x1350.png");
      fs.writeFileSync(cardPath, cardPng);

      // Carousel ÖNCE: ~10–30 sn sürer → yazı tipi/tarayıcı sorunu dakikalarca süren videolardan ÖNCE ve yüksek sesle (iş `hata`) düşer.
      calisan.asama = "carousel";
      const tC = now();
      const carousel = await uretici.renderCarousel({ digest, cardPng: cardPath, outDir: gunDir, spherePath, browser });
      const carouselSn = Math.round((now() - tC) / 100) / 10;
      (carousel?.fit ?? []).forEach((f, i) => { if (f.bosluk < 0) log(`sosyal: ${gun} slayt ${i + 2} asgari puntoda sığmadı (boşluk ${f.bosluk} px)`); });

      calisan.asama = "hikaye";
      const hikaye = await uretici.renderStories({ digest, cardPng: cardPath, outDir: gunDir, workDir, music: muzikPath, spherePath, browser });

      calisan.asama = "reel";
      const reel = await uretici.renderReelA({ digest, outPath: path.join(gunDir, `reels-a-${gun}.mp4`), workDir, music: muzikPath, grid: gridAl(), spherePath, browser, workers });

      calisan.asama = "kapanis";
      fs.rmSync(workDir, { recursive: true, force: true });
      const dosyalar = dosyalariListele(gunDir);
      if (!dosyalar.length) throw new Error("hiç MP4 üretilmedi");
      const gorseller = gorselleriListele(gunDir);
      const beklenenSlayt = digest.items.length + 2; // kart + her içerik için 1 + kapanış
      if (gorseller.length !== beklenenSlayt) throw new Error(`carousel slayt sayısı beklenenden farklı (${gorseller.length}/${beklenenSlayt})`);
      const sure_sn = Math.round((now() - t0) / 100) / 10;
      const bitti = {
        surum: 2, gun, olusturuldu: new Date(now()).toISOString(), sure_sn, kapsam: kapsamHesapla(digest), dosyalar, gorseller,
        olcum: { hikaye: hikaye?.timings ?? null, reel: reel?.timings ?? null, carousel: { sn: carouselSn, puntolar: carousel?.fit ?? null } },
      };
      const gecici = path.join(gunDir, `${MARKER}.tmp`);
      fs.writeFileSync(gecici, JSON.stringify(bitti, null, 2));
      fs.renameSync(gecici, path.join(gunDir, MARKER));
      sonHata = null;
      eskileriTemizle(gun);
      log(`sosyal: ${gun} hazır — ${dosyalar.length} dosya, ${gorseller.length} slayt, ${sure_sn} sn`);
    } catch (e) {
      sonHata = { gun, mesaj: hataMesaji(e), adim: calisan?.asama ?? "?", zaman: new Date(now()).toISOString() };
      if (basladi) {
        try { fs.rmSync(gunDir, { recursive: true, force: true }); } catch { /* en iyi çaba */ }
      }
      log(`sosyal: ${gun} HATA (${sonHata.adim}): ${sonHata.mesaj}`);
    } finally {
      calisan = null;
    }
  }

  async function uret(res, yenile) {
    if (calisan) return json(res, 409, { ...durumGovdesi(), hata: "başka bir üretim sürüyor" });
    // Müzik repo DIŞINDA (sunucu volume'u): yoksa HİÇ başlama — önceki iyi klipler (yenile) korunur.
    if (!fs.existsSync(muzikPath)) {
      sonHata = { gun: null, mesaj: `müzik dosyası bulunamadı: ${muzikPath}`, adim: "kontrol", zaman: new Date(now()).toISOString() };
      return json(res, 503, { durum: "hata", hata: sonHata.mesaj });
    }
    calisan = { gun: null, basladi: now(), asama: "seçki", kapsam: null }; // kilit await'ten ÖNCE
    let digest;
    try {
      digest = await getDigest();
      digestDogrula(digest);
    } catch (e) {
      calisan = null;
      sonHata = { gun: null, mesaj: `seçki alınamadı/geçersiz: ${hataMesaji(e)}`, adim: "seçki", zaman: new Date(now()).toISOString() };
      log(`sosyal: ${sonHata.mesaj}`);
      return json(res, 502, { durum: "hata", hata: sonHata.mesaj });
    }
    if (digest.items.length === 0) {
      calisan = null;
      sonHataTemizle(digest.day);
      return json(res, 200, { durum: "hazir", gun: digest.day, bos_gun: true, dosyalar: [], gorseller: [], kapsam: kapsamHesapla(digest) });
    }
    const hazir = yenile ? null : okuBitti(digest.day);
    if (hazir) {
      calisan = null;
      sonHataTemizle(digest.day);
      return json(res, 200, govdeHazir(hazir));
    }
    calisan.gun = digest.day;
    calisan.kapsam = kapsamHesapla(digest);
    calisan.asama = "hazirlik";
    log(`sosyal: ${digest.day} üretim başladı — ${digest.items.length} öğe${yenile ? " (yenile)" : ""}`);
    void isiCalistir(digest); // arka plan; her hata içeride yakalanır, kilit finally'de açılır
    return json(res, 202, durumGovdesi());
  }

  async function dosyaGonder(req, res, rest) {
    // `url.pathname` zaten ".." parçalarını çözmüş olur; kodlanmış "/" ise ad içinde kalır ve AD_RE/GORSEL_RE'yi geçemez.
    const parcalar = rest.split("/");
    if (parcalar.length !== 2) return json(res, 404, { hata: "yok" });
    const [gun, ad] = parcalar;
    const png = gorselAdiGecerli(ad);
    if (!gunGecerli(gun) || !(png || dosyaAdiGecerli(ad))) return json(res, 404, { hata: "yok" });
    const b = okuBitti(gun);
    const kayit = (png ? b?.gorseller : b?.dosyalar)?.find((d) => d.ad === ad); // yalnız tamamlanmış günün LİSTELİ dosyaları (tür başına kendi listesi)
    if (!kayit) return json(res, 404, { hata: "yok" });
    const yol = path.join(gunDizini(gun), ad);
    let st;
    try { st = fs.statSync(yol); } catch { return json(res, 404, { hata: "yok" }); }
    res.writeHead(200, { "Content-Type": png ? "image/png" : "video/mp4", "Content-Length": st.size, "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="${ad}"` });
    if (req.method === "HEAD") return res.end();
    await pipeline(fs.createReadStream(yol), res);
  }

  const yontem = (res, izinli) => { res.setHeader("Allow", izinli); json(res, 405, { hata: "yöntem desteklenmiyor" }); };

  /** `/sosyal/*` isteklerini karşılar; ilgisiz URL → false (çağıran kendi yoluna devam eder). */
  async function handle(req, res) {
    // Bozuk istek yolu ("//", "http://") `new URL`'de fırlatır; try DIŞINDA kalırsa işlenmeyen reddetme süreci düşürür (Node ≥15) ve istek asılı kalır.
    // Bozuk yol bu uca ait DEĞİL → false: çağıran kendi 404'ünü verir.
    let url;
    try { url = new URL(req.url ?? "/", "http://kart.local"); } catch { return false; }
    const p = url.pathname;
    if (!p.startsWith("/sosyal/")) return false;
    try {
      if (p === "/sosyal/uret") {
        if (req.method !== "POST") yontem(res, "POST");
        else { req.resume(); await uret(res, url.searchParams.get("yenile") === "1"); }
      } else if (p === "/sosyal/durum") {
        if (req.method !== "GET") yontem(res, "GET");
        else json(res, 200, durumGovdesi());
      } else if (p.startsWith("/sosyal/dosya/")) {
        if (req.method !== "GET" && req.method !== "HEAD") yontem(res, "GET, HEAD");
        else await dosyaGonder(req, res, p.slice("/sosyal/dosya/".length));
      } else {
        json(res, 404, { hata: "yok" });
      }
    } catch (e) {
      if (e?.code !== "ERR_STREAM_PREMATURE_CLOSE") log(`sosyal: istek hatası: ${hataMesaji(e)}`); // istemci indirmeyi yarıda kesmiş olabilir
      if (!res.headersSent) json(res, 500, { hata: "sunucu hatası" });
      else res.destroy();
    }
    return true;
  }

  return { handle, durum: durumGovdesi };
}
