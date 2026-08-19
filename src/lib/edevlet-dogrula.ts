// e-Devlet barkodlu belge ÇEVRİMİÇİ doğrulama istemcisi (v6.120, 2026-08-19).
//
// NE YAPAR (vault wiki/kavramlar/doktor-kimlik-dogrulama.md §5-6):
// `lib/edevlet-belge.ts` yüklenen PDF'in METNİNİ okur — ama sahteci o metni değiştirebilir. Bu modül
// bir adım öteye gider: barkod + TC'yi turkiye.gov.tr/belge-dogrulama akışına sokar ve DEVLETİN
// döndürdüğü belgenin ASLINI alır. Sahteci yüklediği PDF'i değiştirebilir; devletin ne döndüreceğini
// değiştiremez → sahtecilik burada kırılır (§5). Dönen aslı, offline okuyucunun aynı boru hattından
// (`pdfMetniOku → parseEdevletBelge → degerlendir`) geçirilir; karar orada verilir, burada yeniden
// icat edilmez.
//
// 🟡 DURUM: DORMANT (uykuda). `EDEVLET_VERIFY_ENABLED` açık değilse ağa HİÇ dokunmaz, `KAPALI` döner.
//    §5'teki akış gerçek formdan çıkarıldı, ama form ALAN DEĞERLERİ (özellikle `btn`, `token`
//    input adı, negatif-yanıt metinleri) gerçek bir koşuyla KALİBRE EDİLMEDEN "çalışıyor" DENMEZ —
//    tıpkı `edevlet-belge.ts`'teki desenlerin gerçek belgeyle kalibre edilmesi gibi. Kalibrasyonsuz
//    hâli GÜVENLİDİR: kapı env ile kapalı, üstelik her belirsizlik `BELIRSIZ` (insan incelemesi).
//
// ⚖️ HUKUKİ DAYANAK (§5, kullanıcı=avukat kararı 2026-08-19): akışın onay ekranındaki taahhüt,
//    doğrulamayı "ilgili kurum/kuruluş"a hasreder. Doktor diplomasını AURA'ya ibraz eder → AURA
//    ilgili kuruluştur. Girişsiz/CAPTCHA'sız kamu uç noktası, doktorun KENDİ belgesi, kullanıcı
//    başına tek sorgu. Bu bir kitlesel kazıma değil, KYC teyididir.
//
// 🔒 TC KİMLİK NO (`ikinciAlan`) ÇAĞRI İÇİNDE TÜKETİLİR. Yalnız sorgu gövdesine yazılır; hiçbir
//    dönüş alanına, `reason`a, log'a GİRMEZ. `edevlet-belge.ts`'in KVKK duruşuyla aynı (o dosya §16).
//
// 🔴 FAIL-CLOSED, ASLA FIRLATMAZ: dışa açık `edevletDogrula` her yolda bir sonuç döndürür. Ağ hatası,
//    zaman aşımı, beklenmedik yanıt, bozuk PDF → hepsi `BELIRSIZ` (kapı açmaz). Yalnız devlet
//    belgeyi açıkça geçerli/geçersiz derse `GECERLI`/`GECERSIZ` olur.

import {
  parseEdevletBelge,
  degerlendir,
  pdfMetniOku,
  isValidTckn,
  type EdevletSonuc,
  type BelgeTuru,
} from "./edevlet-belge";

/**
 * Çevrimiçi doğrulama sonucu.
 * - `GECERLI`  : devlet belgenin ASLINI döndürdü ve aslı profil adıyla eşleşti (kapı açar).
 * - `GECERSIZ` : devlet barkodu/TC'yi reddetti VEYA dönen aslı belgeyi desteklemedi (kapı açmaz).
 * - `BELIRSIZ` : akış tamamlanamadı (hata/zaman aşımı/beklenmedik yanıt) → insan incelemesi.
 * - `KAPALI`   : `EDEVLET_VERIFY_ENABLED` kapalı → ağa dokunulmadı (dormant).
 */
export type EdevletDurum = "GECERLI" | "GECERSIZ" | "BELIRSIZ" | "KAPALI";

export interface EdevletDogrulamaSonucu {
  durum: EdevletDurum;
  /** Neden bu duruma varıldı — audit detail'e yazılabilir. PHI/TC İÇERMEZ. */
  reason: string;
  /** Devletin döndürdüğü aslın değerlendirmesi (yalnız asıl elde edilebildiyse). */
  sonuc: EdevletSonuc | null;
  /** İpucu olarak damgalanacak barkod (varsa). */
  barcode: string | null;
}

// ── Sabitler ─────────────────────────────────────────────────────────────────────────────────────

const BASE = "https://www.turkiye.gov.tr/belge-dogrulama";
const TIMEOUT_MS = 15_000; // §6: 15 sn TOPLAM zaman aşımı (tüm akış için tek bütçe)
const MAX_REDIRECTS = 5; // 302 zincirini elle izlerken güvenlik sınırı

// Formun HTML uç noktasının yanıt verebilmesi için gereken olağan tarayıcı başlıkları.
// (Gizleme/atlatma DEĞİL: form tarayıcıya servis edildiğinden UA'sız istekler reddedilebiliyor.)
const ORTAK_BASLIK: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  "accept-language": "tr-TR,tr;q=0.9",
};

// ✅ KALİBRE EDİLDİ (2026-08-19, canlı formdan): buton değeri gerçekten "Devam Et"
// (input[name=btn][type=submit] value niteliği tarayıcıda okundu).
const BTN_DEGERI = "Devam Et";

// Devletin "bu barkod/TC geçersiz" dediğini gösteren AÇIK negatif imzalar. Sadece bunlardan biri
// görülürse `GECERSIZ` denir; aksi hâlde (tanımadığımız yanıt) fail-closed `BELIRSIZ`.
// ✅ KALİBRE EDİLDİ (2026-08-19, canlı denemelerle — ilk iki kalıp GERÇEK yanıt metinleri):
//   · Geçersiz barkod (aşama 1'de yeniden çizilen sayfada): "Girilen barkod numarası e-Devlet
//     Kapısında tanımlı değildir." → `tanımlı değil`
//   · Geçerli barkod + YANLIŞ TC: aşama 2-3 REDDETMEZ (ölçüldü — akış onaya kadar ilerliyor);
//     ret ancak AŞAMA 4 sonuç sayfasında gelir: "Kayıt bulunmadı." (indirme düğmesi/PDF yok)
//     → `kayıt bulunmadı`. Yanlış TC belgeye ULAŞAMIYOR (güvenlik canlı doğrulandı).
//   ⚠️ Bu yüzden adım-2/3 imzaları erken-çıkış iyileştirmesidir, nihai karar adım 4 imzası +
//     adım 5'in PDF olup olmamasıdır (kod her iki noktada da bakıyor).
// Kalan kalıplar savunma derinliği (görülmemiş varyantlar) — eksik kalırsa sonuç en kötü BELIRSIZ.
const NEGATIF_IMZA =
  /(tan[ıi]ml[ıi]\s*de[ğg]il|kay[ıi]t\s*bulunmad[ıi]|do[ğg]rulanamad[ıi]|bulunamad[ıi]|ge[çc]ersiz|hatal[ıi]|yanl[ıi][şs]|sistemde\s*kay[ıi]tl[ıi]\s*de[ğg]il)/i;

// ── Env kapısı ───────────────────────────────────────────────────────────────────────────────────

/** Çevrimiçi doğrulama açık mı. Varsayılan KAPALI — açık niyet gerekir. */
function etkinMi(): boolean {
  const v = (process.env.EDEVLET_VERIFY_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

// ── Çerez kavanozu (elle) ────────────────────────────────────────────────────────────────────────
// Akış OTURUMLUDUR: bir oturum çerezi + her adımda tazelenen gizli `token`. `fetch`'in otomatik
// yönlendirmesi Set-Cookie/Location'ı yutar; bu yüzden `redirect:"manual"` + elle kavanoz şart.

class CerezKavanozu {
  private jar = new Map<string, string>();

  yanittanAl(res: Response): void {
    // undici: getSetCookie() birden çok Set-Cookie'yi ayrı ayrı verir (headers.get bunları katlar).
    const cookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie") as string]
          : [];
    for (const c of cookies) {
      const pair = c.split(";", 1)[0];
      const idx = pair.indexOf("=");
      if (idx > 0) this.jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  baslik(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

// ── HTTP: elle 302 izleme + çerez taşıma ─────────────────────────────────────────────────────────

/**
 * Tek isteği yollar, 3xx zincirini ELLE izler, çerezleri kavanoza biriktirir, nihai yanıtı döner.
 * Yönlendirmede gövde düşer, yöntem GET olur (tarayıcı davranışı). Fırlatabilir — üst kat yakalar.
 */
async function cekVeIzle(
  kavanoz: CerezKavanozu,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  let hedef = url;
  let mevcut: RequestInit = init;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const cerez = kavanoz.baslik();
    const res = await fetch(hedef, {
      ...mevcut,
      redirect: "manual",
      signal,
      headers: { ...(mevcut.headers as Record<string, string>), ...(cerez ? { cookie: cerez } : {}) },
    });
    kavanoz.yanittanAl(res);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res; // yönlendirme başlığı yoksa yanıtı olduğu gibi ver
      hedef = new URL(loc, hedef).toString();
      mevcut = { method: "GET", headers: ORTAK_BASLIK }; // 302 sonrası GET, gövdesiz
      continue;
    }
    return res;
  }
  throw new Error("çok fazla yönlendirme");
}

/** Form-encoded POST adımı; nihai yanıtı döner. */
function adimGonder(
  kavanoz: CerezKavanozu,
  url: string,
  alanlar: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  return cekVeIzle(
    kavanoz,
    url,
    {
      method: "POST",
      headers: { ...ORTAK_BASLIK, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(alanlar).toString(),
    },
    signal,
  );
}

/** HTML'den her adımda tazelenen gizli `token` input'unu çeker (attr sırası iki yönlü). */
function tokenCek(html: string): string | null {
  const m =
    /<input[^>]*\bname=["']token["'][^>]*\bvalue=["']([^"']+)["']/i.exec(html) ??
    /<input[^>]*\bvalue=["']([^"']+)["'][^>]*\bname=["']token["']/i.exec(html);
  return m ? m[1] : null;
}

// ── Sonuç kısayolları ────────────────────────────────────────────────────────────────────────────

const kapali = (): EdevletDogrulamaSonucu => ({
  durum: "KAPALI",
  reason: "e-Devlet çevrimiçi doğrulama kapalı (EDEVLET_VERIFY_ENABLED)",
  sonuc: null,
  barcode: null,
});
const belirsiz = (reason: string, barcode: string | null = null): EdevletDogrulamaSonucu => ({
  durum: "BELIRSIZ",
  reason,
  sonuc: null,
  barcode,
});
const gecersiz = (reason: string, barcode: string | null = null): EdevletDogrulamaSonucu => ({
  durum: "GECERSIZ",
  reason,
  sonuc: null,
  barcode,
});

// ── Dışa açık API ────────────────────────────────────────────────────────────────────────────────

/**
 * Bir barkod + TC'yi e-Devlet doğrulama akışından geçirir, devletin döndürdüğü aslı değerlendirir.
 *
 * Akış (§5, 5 adım — çerez + her adımda tazelenen `token` taşınır):
 *   1. GET  /belge-dogrulama                                   → gizli token + çerez
 *   2. POST /belge-dogrulama?submit                            (sorgulananBarkod, btn, token)
 *   3. POST /belge-dogrulama?islem=dogrulama&submit            (ikinciAlan=TC, btn, token)
 *   4. POST /belge-dogrulama?islem=onay&submit                 (chkOnay=1, btn, token)
 *   5. GET  /belge-dogrulama?belge=goster&goster=1&display=display → belgenin aslı (PDF binary)
 *
 * @param barkod        Yüklenen belgeden okunan barkod (`parseEdevletBelge().barcode`).
 * @param ikinciAlan    TC kimlik no — ÇAĞRI İÇİNDE tüketilir, persist EDİLMEZ, reason'a GİRMEZ.
 * @param profileName   Profil adı — dönen aslın adıyla `degerlendir` içinde eşleştirilir.
 * @param beklenen      Beklenen belge türü (varsayılan mezuniyet).
 *
 * ASLA FIRLATMAZ. Her hata `BELIRSIZ` (fail-closed).
 */
export async function edevletDogrula(
  barkod: string,
  ikinciAlan: string,
  profileName: string | null,
  beklenen: BelgeTuru = "MEZUNIYET",
): Promise<EdevletDogrulamaSonucu> {
  // 0. Env kapısı — kapalıysa ağa DOKUNMA.
  if (!etkinMi()) return kapali();

  // Girdi sağlığı (ağı boş yere yormamak için). Eksik/geçersiz girdi bizim sorunumuz → BELIRSIZ,
  // sahtecilik sinyali değil.
  const barkodTemiz = (barkod ?? "").trim().toUpperCase();
  if (!barkodTemiz) return belirsiz("barkod boş — sorgu yapılamadı");
  if (!isValidTckn((ikinciAlan ?? "").trim())) return belirsiz("TC alanı algoritmik geçerli değil — sorgu yapılamadı");
  const tc = ikinciAlan.trim();

  const ac = new AbortController();
  const zamanlayici = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const kavanoz = new CerezKavanozu();

  try {
    // 1. Formu aç: gizli token + çerez.
    let res = await cekVeIzle(kavanoz, BASE, { method: "GET", headers: ORTAK_BASLIK }, ac.signal);
    let html = await res.text();
    let token = tokenCek(html);
    if (!token) return belirsiz("adım 1: gizli token bulunamadı (form yanıtı beklenenden farklı)", barkodTemiz);

    // 2. Barkodu gönder.
    res = await adimGonder(kavanoz, `${BASE}?submit`, { sorgulananBarkod: barkodTemiz, btn: BTN_DEGERI, token }, ac.signal);
    html = await res.text();
    if (NEGATIF_IMZA.test(html)) return gecersiz("barkod devlet tarafından tanınmadı (adım 2)", barkodTemiz);
    token = tokenCek(html) ?? token;

    // 3. İkinci alanı (TC) gönder.
    res = await adimGonder(kavanoz, `${BASE}?islem=dogrulama&submit`, { ikinciAlan: tc, btn: BTN_DEGERI, token }, ac.signal);
    html = await res.text();
    if (NEGATIF_IMZA.test(html)) return gecersiz("barkod ile TC eşleşmedi (adım 3)", barkodTemiz);
    token = tokenCek(html) ?? token;

    // 4. Zorunlu onayı ver (§5 ⚖️: taahhüt ekranı).
    res = await adimGonder(kavanoz, `${BASE}?islem=onay&submit`, { chkOnay: "1", btn: BTN_DEGERI, token }, ac.signal);
    // Bu adımın gövdesi HTML olabilir; PDF'i ayrı GET ile alıyoruz. Yine de negatif imzaya bakalım.
    const onayHtml = await res.text();
    if (NEGATIF_IMZA.test(onayHtml)) return gecersiz("onay adımı reddedildi (adım 4)", barkodTemiz);

    // 5. Belgenin ASLINI indir (binary PDF).
    res = await cekVeIzle(
      kavanoz,
      `${BASE}?belge=goster&goster=1&display=display`,
      { method: "GET", headers: ORTAK_BASLIK },
      ac.signal,
    );
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      // PDF gelmedi: açık negatif imza varsa geçersiz, yoksa tanımadığımız yanıt → belirsiz.
      const govde = buf.toString("latin1", 0, 4096);
      return NEGATIF_IMZA.test(govde)
        ? gecersiz("adım 5: belge geçersiz olarak döndü", barkodTemiz)
        : belirsiz("adım 5: PDF aslı alınamadı (beklenmedik yanıt)", barkodTemiz);
    }

    // 6. Devletin aslını, offline okuyucunun AYNI boru hattından geçir — karar orada verilir.
    const text = await pdfMetniOku(`data:application/pdf;base64,${buf.toString("base64")}`);
    if (!text) return belirsiz("devlet PDF'inin metin katmanı okunamadı", barkodTemiz);

    const sonuc = degerlendir(parseEdevletBelge(text), profileName, beklenen);
    if (sonuc.ok) {
      return { durum: "GECERLI", reason: `e-Devlet aslı doğrulandı — ${sonuc.reason}`, sonuc, barcode: sonuc.barcode };
    }
    // Devletin ASLI belgeyi desteklemedi (tür/program/ad tutmadı). Yüklenen sahte olabilir veya
    // barkod başkasına ait olabilir → kapı açmaz. (sonuc.reason TC içermez.)
    return { durum: "GECERSIZ", reason: `e-Devlet aslı bu iddiayı desteklemedi — ${sonuc.reason}`, sonuc, barcode: sonuc.barcode };
  } catch (e) {
    // Zaman aşımı dahil HER hata fail-closed → BELIRSIZ (asla fırlatma, asla kapı açma).
    // 🔎 Teşhis: EDEVLET_DEBUG=1 iken hata sınıfı log'a düşer (PHI/TC İÇERMEZ — yalnız mesaj).
    // Üretimde kapalı: `reason` audit'e gittiği için oraya ham hata metni KOYULMAZ.
    if (process.env.EDEVLET_DEBUG === "1") {
      console.warn("[edevlet-dogrula] hata:", e instanceof Error ? `${e.name}: ${e.message}` : e);
    }
    const aborted = e instanceof Error && (e.name === "AbortError" || ac.signal.aborted);
    return belirsiz(aborted ? "15 sn zaman aşımı — doğrulama tamamlanamadı" : "doğrulama sırasında ağ/işlem hatası", barkodTemiz);
  } finally {
    clearTimeout(zamanlayici);
  }
}
