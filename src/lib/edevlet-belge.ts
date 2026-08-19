// e-Devlet barkodlu belge okuyucu (v6.119, 2026-08-19) — TAMAMEN SUNUCUDA, DIŞ İSTEK YOK.
//
// NEDEN BÖYLE (kullanıcı kararı 2026-08-19, araştırma sonrası — vault
// wiki/kavramlar/doktor-kimlik-dogrulama.md §3):
// Doktor e-Devlet'ten "Yükseköğretim Mezun Belgesi"ni barkodlu PDF olarak indirip yükler. Bu modül
// PDF'in METİN KATMANINI okur; barkod numarası + TC + ad-soyadı çıkarıp profil adıyla eşleştirir.
// Eşleşirse belge ACCEPTED damgalanır → hesap OTOMATİK aktifleşir (doktor insan onayı beklemez);
// eşleşmezse belge PENDING kalır → insan incelemesine düşer. Fail-closed: şüphede kapı KAPALI.
//
// 🔴 turkiye.gov.tr'ye PROGRAMATİK İSTEK YAPILMAZ ve EKLENMEMELİ.
// Doğrulama ekranı (turkiye.gov.tr/belge-dogrulama) kamuya açık, girişsiz ve CAPTCHA'sız — ama
// e-Devlet'i bot ile sorgulamak kullanım şartlarına aykırıdır. Bu bilinçli bir hukuki karardır
// (2026-08-19; "D seçeneği" elendi). İnsan incelemeci linke KENDİSİ tıklar. e-Devlet'in kurumlara
// açtığı resmî TOPLU DOĞRULAMA web servisi ayrı bir iştir (protokol + izin gerektirir).
//
// 🔒 TC KİMLİK NO SAKLANMAZ. Belgeden yalnız EŞLEŞTİRME için okunur, sonuç boolean'a indirgenir;
// ham değer hiçbir yere (DB · log · audit detail · bildirim) yazılmaz. Sistemde TC kolonu YOKTUR
// ve bu modül gerekçe gösterilerek açılmamalıdır — KVKK veri minimizasyonu.
//
// ⚠️ KALİBRASYON: barkod/ad desenleri gerçek bir e-Devlet belgesiyle doğrulanmadan "otomatik
// doğrulama çalışıyor" DENMEZ. Yerel prova için: `npx tsx scripts/edevlet-parse-dene.ts <dosya.pdf>`
// (dosya makineden çıkmaz, repoya girmez). Desen tutmazsa sonuç PENDING olur — yani kalibrasyonsuz
// hâli GÜVENLİDİR, yalnız otomatik geçiş oranı düşer.

/** Tanınan e-Devlet belge türü. */
export type BelgeTuru = "MEZUNIYET" | "OGRENCI";

/** Belgeden okunan alanlar. `tckn` ÇAĞRI İÇİNDE tüketilir — asla persist edilmez. */
export interface EdevletBelge {
  /** Barkod / doğrulama numarası (kamuya açık kod). */
  barcode: string | null;
  /** Belgedeki TC kimlik no — YALNIZ eşleştirme için; saklanmaz. */
  tckn: string | null;
  /** Belgedeki ad-soyad. */
  name: string | null;
  /** Metinde e-Devlet üretimi belge imzası (turkiye.gov.tr / belge-dogrulama) bulundu mu. */
  isEdevlet: boolean;
  /**
   * Belgenin TÜRÜ. 🔴 Bu alan olmadan "e-Devlet barkodlu belge" kontrolü ALDATILABİLİR:
   * ikametgah · adli sicil · vergi levhası da e-Devlet'ten barkodlu ve kişinin adına çıkar,
   * yani tür bakılmazsa bunlar diploma diye geçerdi (2026-08-19'da yakalandı).
   */
  tur: BelgeTuru | null;
  /** Program tıp/diş hekimliği mi (resmî fakülte adları — terim istisnası). */
  tipProgrami: boolean;
}

/** Doğrulama sonucu — çağıranın damgalayacağı özet. */
export interface EdevletSonuc {
  /** TAM doğrulama geçti mi (tür + program + barkod + ad). Yalnız bu, kapı açar. */
  ok: boolean;
  /**
   * Belge e-Devlet barkodlu, DOĞRU TÜRDE bir tıp programı belgesi olarak TANINDI mı.
   * ⚠️ `tanindi && !ok` = "belge gerçek görünüyor ama ad tutmuyor" → bu, bekleyen belgelerin EN
   * ŞÜPHELİSİDİR (başkasının belgesi olabilir). Bu yüzden `tanindi` bir ERİŞİM KAPISI DEĞİLDİR,
   * yalnız incelemeciye gösterilen bayraktır. Kapı olarak kullanma.
   */
  tanindi: boolean;
  /** Damgalanacak barkod (ok=false ise de dolabilir — incelemeciye ipucu). */
  barcode: string | null;
  /** Neden geçmedi / nasıl geçti — audit detail'ine yazılabilir (PHI/TC İÇERMEZ). */
  reason: string;
}

// ── Türkçe metin normalizasyonu ────────────────────────────────────────────────────────────────
// ⚠️ `"İ".toLowerCase()` JS'te "i̇" (i + birleşen nokta) verir → saf toLowerCase ile karşılaştırma
// Türkçe adlarda SESSİZCE yanlış sonuç üretir. Bu yüzden harf-harf ASCII'ye katlıyoruz.
const TR_MAP: Record<string, string> = {
  İ: "i", I: "i", ı: "i", Ş: "s", ş: "s", Ğ: "g", ğ: "g",
  Ü: "u", ü: "u", Ö: "o", ö: "o", Ç: "c", ç: "c", Â: "a", â: "a", Î: "i", î: "i", Û: "u", û: "u",
};

/**
 * Türkçe metni ASCII küçük harfe katlar (İ/ı/ş/ğ/ü/ö/ç → i/i/s/g/u/o/c).
 * 🪤 DESEN YAZARKEN BUNU KULLAN: `/hekimli[ğg]i/i` gibi bir regex "HEKİMLİĞİ"yi EŞLEŞTİRMEZ —
 * JS'te `İ` (U+0130) küçük harfe `i` değil `i+birleşen nokta` olarak katlanır, `/i` bayrağı bunu
 * kurtarmaz. Desenleri katlanmış metne uygulamak bu sınıf hataları tümden kaldırır.
 */
export function foldTr(s: string): string {
  return [...s].map((c) => TR_MAP[c] ?? c).join("").toLowerCase();
}

/** Türkçe adı karşılaştırılabilir hâle getirir: ASCII küçük harf, tek boşluk, unvansız. */
export function normalizeTrName(s: string): string {
  const folded = foldTr(s);
  return folded
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !TITLES.has(w))
    .join(" ");
}

/** Ad karşılaştırmasında atılan unvan/derece sözcükleri (normalize edilmiş hâlleriyle). */
const TITLES = new Set([
  "dr", "dṙ", "doc", "doç", "prof", "op", "uzm", "uz", "md", "phd", "sayin", "sn",
]);

/**
 * Belgedeki ad ile profildeki ad aynı kişiyi mi gösteriyor?
 * Kural: profildeki her sözcük belgede de geçmeli (veya tersi) — sıra ve fazladan göbek adı serbest.
 * Tek sözcüklük eşleşme kabul EDİLMEZ (ad-soyad en az iki parça olmalı; "Ahmet" tek başına yetmez).
 */
export function nameMatches(docName: string | null, profileName: string | null): boolean {
  if (!docName || !profileName) return false;
  const a = normalizeTrName(docName).split(" ").filter(Boolean);
  const b = normalizeTrName(profileName).split(" ").filter(Boolean);
  if (a.length < 2 || b.length < 2) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  const aInB = a.every((w) => setB.has(w));
  const bInA = b.every((w) => setA.has(w));
  return aInB || bInA;
}

// ── TC kimlik no ───────────────────────────────────────────────────────────────────────────────

/**
 * TC kimlik no algoritmik geçerli mi (11 hane · ilk hane ≠ 0 · iki sağlama hanesi).
 * Metinden 11 haneli HER sayıyı TC sanmamak için şart — belge no/tarih/tescil no yanlış eşleşmesin.
 */
export function isValidTckn(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = [...v].map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8];
  const cift = d[1] + d[3] + d[5] + d[7];
  if ((tek * 7 - cift) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((x, y) => x + y, 0) % 10 === d[10];
}

// ── Ayrıştırma ─────────────────────────────────────────────────────────────────────────────────

// Barkod desenleri — SIRA ÖNEMLİ (spesifikten genele).
// 📐 GERÇEK BELGEYLE KALİBRE EDİLDİ (2026-08-19, YÖK Mezun Belgesi):
//    Kod `YOKME` ön ekiyle başlayan, TİRESİZ, 18 karakterlik alfanümerik bir dizgedir ve belgenin
//    EN ÜSTÜNDE, ETİKETSİZ, kendi satırında durur. İlk yazdığım "ABCD-1234-EFGH" (4-4-4) varsayımı
//    TAMAMEN YANLIŞTI — tireli biçim yalnız yedek olarak duruyor (başka kurum belgeleri için).
const BARCODE_PATTERNS: RegExp[] = [
  // Etiketli (varsa) — tireli ya da tiresiz
  /barkod\s*(?:numaras[ıi]|no)?\s*[:\-]?\s*([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z0-9]{12,30})/i,
  // YÖK ön ekli kod: YOKME… (mezun) · YOKOG… (öğrenci) vb.
  /\b(YOK[A-Z0-9]{9,27})\b/,
  // Etiketsiz, kendi satırında duran, EN AZ BİR RAKAM içeren büyük-harf alfanümerik dizge.
  // ⚠️ Rakam şartı kasıtlı: "ANKARA"/"MEZUN" gibi salt-harf başlıkları barkod sanılmasın.
  /^(?=[A-Z0-9]*\d)([A-Z0-9]{12,30})\s*$/m,
  // Tireli 4-4-4 (diğer kurumlar)
  /\b([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})\b/,
];

// Ad-soyad etiketleri.
// 📐 GERÇEK BELGEDE İKİ NOKTA YOK: "Adı Soyadı AHMET BURAK KARADERİ" — PDF metin çıkarımı ':'
//    karakterlerini ayrı bir sütun olarak topluyor. Bu yüzden ':' ZORUNLU DEĞİL (`:?`).
// ⚠️ Çıplak "Adı" deseni BİLİNÇLİ OLARAK YOK: belgede "Anne Adı MÜBECCEL" / "Baba Adı ..." satırları
//    var; çıplak desen anne adını yakalar ve doktorun adı sanardı. Fail-closed: yakalayamazsak
//    belge insan incelemesine düşer — yanlış ad yakalamaktan iyidir.
const NAME_PATTERNS: RegExp[] = [
  /ad[ıi]\s*(?:ve)?\s*soyad[ıi]\s*:?\s*([^\n\r]{3,80})/i,
  /ad\s*soyad\s*:?\s*([^\n\r]{3,80})/i,
];

/** Metinde e-Devlet üretimi belge işareti var mı. */
function looksEdevlet(t: string): boolean {
  return /turkiye\.gov\.tr|belge-?do[ğg]rulama|e-?devlet/i.test(t);
}

// ── Belge TÜRÜ tanıma (🔴 güvenliğin çekirdeği) ────────────────────────────────────────────────
// "e-Devlet barkodlu belge" olmak diploma olmak DEĞİLDİR. Aşağıdaki desenler tutmazsa belge
// otomatik geçemez ve insan incelemesine düşer (fail-closed). Yanlış-negatif ucuzdur (incelemeci
// bakar), yanlış-pozitif pahalıdır (ikametgahla klinik erişim açılır).
// ⚠️ Aşağıdaki desenler KATLANMIŞ metne (foldTr) uygulanır → hepsi saf ASCII küçük harftir.
// "YÜKSEKÖĞRETİM" → "yuksekogretim", "DİŞ HEKİMLİĞİ" → "dis hekimligi".
const YOK_ISARETI = /yuksekogretim/; // ⚠️ çıplak "yok" ARANMAZ: Türkçede sıradan bir sözcük (yanlış-pozitif)
const MEZUN_ISARETI = /\bmezun/; // "Mezun Belgesi" · "Mezuniyet Durumu" · "MEZUN"
const OGRENCI_ISARETI = /ogrenci\s*belgesi/;

// Tıp/diş programı desenleri. ⚠️ "Diş Hekimliği Fakültesi" RESMÎ ADDIR — proje terim kuralının
// (hekim→doktor) bilinçli istisnasıdır; buradaki "hekimligi" ÇEVRİLMEZ, yoksa desen tutmaz.
const TIP_PROGRAMI: RegExp[] = [
  /tip\s*fakulte/,
  /tip\s*(?:pr\.?|program)/,
  /dis\s*hekimligi/,
  /tip\s*doktoru/,
  /\btip\b/, // program alanı yalnız "Tıp" yazabilir ("tipi"/"tipin" \b sayesinde eşleşmez)
];

/** Belge türünü tanır. Öğrenci belgesi ÖNCE bakılır — mezuniyet desenine yanlış düşmesin. */
function tanıTur(t: string): BelgeTuru | null {
  const f = foldTr(t);
  if (OGRENCI_ISARETI.test(f)) return "OGRENCI";
  if (YOK_ISARETI.test(f) && MEZUN_ISARETI.test(f)) return "MEZUNIYET";
  return null;
}

/** Programın tıp/diş hekimliği olup olmadığını söyler (resmî fakülte adları). */
export function isTipProgrami(t: string): boolean {
  const f = foldTr(t);
  return TIP_PROGRAMI.some((re) => re.test(f));
}

/** PDF metin katmanından e-Devlet belgesi alanlarını çıkarır (saf — birim testlenebilir). */
export function parseEdevletBelge(text: string): EdevletBelge {
  const t = text.replace(/ /g, " ");

  let barcode: string | null = null;
  for (const re of BARCODE_PATTERNS) {
    const m = re.exec(t);
    if (m) { barcode = m[1].toUpperCase(); break; }
  }

  let name: string | null = null;
  for (const re of NAME_PATTERNS) {
    const m = re.exec(t);
    if (m) {
      const c = m[1].trim().replace(/\s{2,}/g, " ");
      // Etiket yakalaması (ör. "Adı: Soyadı") gibi anlamsız sonuçları ele
      if (c.length >= 3 && /[a-zçğıöşüA-ZÇĞİÖŞÜ]{2}/.test(c)) { name = c; break; }
    }
  }

  // TC: metindeki 11 haneli adayların ALGORİTMİK geçerli olan İLKİ.
  // 🪤 `\b\d{11}\b` KULLANMA: gerçek belgede değer etiketine YAPIŞIK çıkıyor ("12499104190T.C.
  //    Kimlik No") — rakamla harf arasında sözcük sınırı YOKTUR, o yüzden `\b` sessizce ıskalar.
  //    Rakam-komşuluğu bakan lookaround doğru araç (2026-08-19 kalibrasyonunda yakalandı).
  let tckn: string | null = null;
  for (const m of t.matchAll(/(?<!\d)\d{11}(?!\d)/g)) {
    if (isValidTckn(m[0])) { tckn = m[0]; break; }
  }

  return {
    barcode, tckn, name,
    isEdevlet: looksEdevlet(t),
    tur: tanıTur(t),
    tipProgrami: isTipProgrami(t),
  };
}

/**
 * Belge + profil karşılaştırması → damgalanacak sonuç (saf).
 * Otomatik geçiş ŞARTLARI (HEPSİ birden — sırayla elenir):
 *   1. Metinde e-Devlet belge işareti var
 *   2. 🔴 Belge TÜRÜ beklenendir (mezuniyet / öğrenci) — "barkodlu olması" YETMEZ
 *   3. 🔴 Program tıp / diş hekimliği
 *   4. Barkod numarası okundu
 *   5. Belgedeki ad-soyad profil adıyla eşleşiyor
 * 2 ve 3 olmadan ikametgah · adli sicil · vergi levhası gibi belgeler diploma sanılırdı.
 * TC okunduysa yalnız eşleştirmede kullanılır; değer DIŞARI ÇIKMAZ (reason'a da girmez).
 */
export function degerlendir(
  belge: EdevletBelge,
  profileName: string | null,
  beklenen: BelgeTuru = "MEZUNIYET",
): EdevletSonuc {
  const bos = { ok: false, tanindi: false, barcode: belge.barcode };
  if (!belge.isEdevlet) return { ...bos, reason: "e-Devlet belge işareti bulunamadı" };
  if (belge.tur !== beklenen) {
    return {
      ...bos,
      reason: belge.tur
        ? `belge türü beklenenden farklı (${belge.tur} ≠ ${beklenen})`
        : "belge türü tanınamadı (mezuniyet/öğrenci belgesi değil)",
    };
  }
  if (!belge.tipProgrami) return { ...bos, reason: "program tıp/diş hekimliği olarak tanınamadı" };
  if (!belge.barcode) return { ...bos, reason: "barkod numarası okunamadı" };

  // Buraya gelen belge DOĞRU TÜRDE, barkodlu bir tıp programı belgesidir.
  const tanindi = true;
  if (!nameMatches(belge.name, profileName)) {
    // ⚠️ Bu, PENDING hâllerin EN ŞÜPHELİSİDİR (belge gerçek ama başkasına ait olabilir) —
    // incelemeciye ayrıca bayrak olarak gösterilir. Erişim AÇMAZ.
    return { ok: false, tanindi, barcode: belge.barcode, reason: "belgedeki ad profil adıyla eşleşmedi" };
  }
  return { ok: true, tanindi, barcode: belge.barcode, reason: "e-Devlet barkodlu mezuniyet belgesi — ad eşleşti" };
}

// ── PDF metin katmanı (yan etkili — dinamik import) ────────────────────────────────────────────

/**
 * data URI'deki PDF'in metin katmanını döndürür. PDF değilse / metin katmanı yoksa null.
 * ⚠️ Dinamik import KASITLI: birim testler bu modülün saf fonksiyonlarını `unpdf` yüklemeden
 * kullanabilsin (kodun `await import("@vercel/blob")` deseninin eşleniği).
 * ⚠️ Bu SUNUCU tarafıdır — CSP'nin `unsafe-eval` yasağı tarayıcıya aittir, burayı bağlamaz.
 */
export async function pdfMetniOku(dataUri: string): Promise<string | null> {
  const m = /^data:[^;,]*;base64,([\s\S]*)$/.exec(dataUri);
  if (!m) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null; // yalnız PDF (görsel → insan incelemesi)
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text : Array.isArray(text) ? (text as string[]).join("\n") : null;
  } catch {
    return null; // bozuk/şifreli PDF → sessizce insan incelemesine düşer
  }
}

/**
 * Yüklenen belgeyi e-Devlet barkodlu belge olarak doğrulamayı dener (uçtan uca).
 * DIŞ İSTEK YOKTUR. Başarısızlık DAİMA `ok:false` döndürür — fırlatmaz, akışı bozmaz.
 */
export async function belgeyiDogrula(
  dataUri: string,
  profileName: string | null,
  beklenen: BelgeTuru = "MEZUNIYET",
): Promise<EdevletSonuc> {
  const text = await pdfMetniOku(dataUri);
  if (!text) {
    return { ok: false, tanindi: false, barcode: null, reason: "PDF metin katmanı okunamadı (görsel/taranmış belge)" };
  }
  return degerlendir(parseEdevletBelge(text), profileName, beklenen);
}

// ── Nihai kabul kararı: offline okuma × çevrimiçi teyit (v6.120) ───────────────────────────────
// `lib/edevlet-dogrula.ts` devreye girince (EDEVLET_VERIFY_ENABLED) belge kabulü İKİ katmanlı olur.
// Saf tutulur ki matris birim testle kilitlenebilsin. Yapısal string tipi KASITLI — edevlet-dogrula
// bu modülü import ediyor; buradan onu import etmek döngü yaratırdı.
export type CevrimiciDurum = "GECERLI" | "GECERSIZ" | "BELIRSIZ" | "KAPALI";

/**
 * Belge OTOMATİK kabul edilsin mi?
 *   offline ✕                → HAYIR (çevrimiçi sonuç ne olursa olsun — sorgu zaten yapılmamalı)
 *   offline ✓ + null/KAPALI  → EVET (çevrimiçi teyit yok/kapalı → offline tek başına karar verir,
 *                              v6.119 canlı davranışı; env açılınca kapı SIKILAŞIR, gevşemez)
 *   offline ✓ + GECERLI      → EVET (devletin aslı da doğruladı — en güçlü hâl)
 *   offline ✓ + GECERSIZ     → HAYIR (devlet iddiayı desteklemedi → sahtecilik/başkasının belgesi
 *                              şüphesi; insan incelemesine düşer)
 *   offline ✓ + BELIRSIZ     → HAYIR (ağ/yapı hatası; teyit AÇIKKEN belirsizlik kapı AÇMAZ —
 *                              fail-closed. e-Devlet kesintisinde doktorlar PENDING'e düşer;
 *                              kabul edilen bedel: insan incelemesi zaten var, env kapatılabilir)
 */
export function onayKarari(offlineOk: boolean, cevrimici: CevrimiciDurum | null): boolean {
  if (!offlineOk) return false;
  if (cevrimici === null || cevrimici === "KAPALI") return true;
  return cevrimici === "GECERLI";
}
