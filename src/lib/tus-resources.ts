// TUS KAYNAKÇA + KURS DİZİNİ + RESMÎ KAYNAKLAR — tarafsız KÜNYE dizini (K4, 👤 karar 2026-09-05: "tarafsız künye dizini").
// SAF modül. Kural (plan K): yalnız ad · kurum/yayınevi · resmî site · format/tür · şehir; SIRALAMA, PUAN, FİYAT, ÖNERİ, BAĞLI
// LİNK YOK; "sponsorlu değil, tanıtım değil" dipnotu UI'da. Her satır kurumun KENDİ sitesinden doğrulanır (verifiedAt) ve
// 👤 onayla (approvedAt) görünür; onaysız satır hiçbir yüzeyde çizilmez. Liste ALFABETİK sunulur (dizideki sıra anlamsız).
//
// ⚖️ Ticari kuruluşlar listelenir ama tanıtım yapılmaz: iddia/övgü/karşılaştırma cümlesi girilmez ("en büyük", "en çok
// satan" gibi kurumun kendi ifadeleri AKTARILMAZ). Fiyat asla. Kurumla ilişki yok (sponsor değil). Kayıtta yalnız kurumun
// açıkça yayımladığı olgular: ad, kuruluş yılı (varsa), format, merkez/şube şehri, hizmet türleri, yayın serilerinin ADI.
export type TusCourseFormat = "yuz-yuze" | "online" | "karma";
export type TusResourceKind = "yayinevi" | "kitabevi" | "resmi";

export const TUS_COURSE_FORMAT_LABEL: Record<TusCourseFormat, string> = { "yuz-yuze": "Yüz yüze", online: "Online", karma: "Yüz yüze + online" };
export const TUS_RESOURCE_KIND_LABEL: Record<TusResourceKind, string> = { yayinevi: "Yayınevi", kitabevi: "Kitabevi / dağıtım", resmi: "Resmî kaynak" };

export interface TusCourseProvider {
  id: string;
  name: string;
  /** Kurumun kendi sitesi (https). */
  officialUrl: string;
  format: TusCourseFormat;
  /** Merkez / şube şehirleri — kurumun sitesinde açıkça yazanlar; "birden çok şube" gibi belirsiz ifade için null. */
  cities: string[] | null;
  /** Kurumun sitesinde yazan kuruluş yılı; yoksa null. */
  founded: number | null;
  /** Hizmet türleri (kurs · kamp · deneme · soru bankası · yayın · online platform) — nötr sözcüklerle. */
  services: string[];
  verifiedAt: string;
  approvedAt: string | null;
}

export interface TusResource {
  id: string;
  kind: TusResourceKind;
  name: string;
  /** Bağlı olduğu kurum/şirket (kurumun kendi beyanı) — yoksa null. */
  organization: string | null;
  officialUrl: string;
  /** Yayın serilerinin ADI ya da resmî kaynağın içeriği — kısa, nötr. */
  note: string;
  verifiedAt: string;
  approvedAt: string | null;
}

const V = "2026-09-05";

/** TUS hazırlık kurumları — alfabetik sunulur. */
export const TUS_COURSE_PROVIDERS: readonly TusCourseProvider[] = [
  { id: "tusdata", name: "TUSDATA", officialUrl: "https://www.tusdata.com/", format: "karma", cities: ["Ankara (merkez)"], founded: null,
    services: ["yüz yüze kurs", "online kurs ve kamp", "online platform (QuadroTUS, MyTUSDATA)", "deneme sınavı (MEDİTEST)", "yayınevi (Klinisyen / TUSDATA Yayıncılık)", "soru danışma hattı"],
    verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tusem", name: "TUSEM — Tıpta Uzmanlık Sınavı Eğitim Merkezi", officialUrl: "https://tusem.com.tr/", format: "karma", cities: ["Ankara (merkez)"], founded: 1995,
    services: ["yüz yüze kurs", "online kurs ve kamp", "deneme sınavı takvimi", "soru kitapları", "online platform (tusemportal)"],
    verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tusmer", name: "TUSMER — Tıp Üniversite Sınav Merkezi", officialUrl: "https://www.tusmer.com/", format: "karma", cities: null, founded: null,
    services: ["yüz yüze ve uzaktan kurs", "tıp fakültesi dönem (1–6) eğitimi", "YDUS hazırlığı", "yayın", "deneme sınavı", "mobil uygulama"],
    verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tustime", name: "TUSTIME — TUS Eğitim Kurumu", officialUrl: "https://tustime.com/", format: "karma", cities: ["İstanbul (Zeytinburnu)"], founded: null,
    services: ["yüz yüze kurs", "online kurs ve kamp", "koçluk programı", "yayın (INFOTUS serisi, Fast Track notları)", "soru bankası", "deneme sınavı", "online platform"],
    verifiedAt: V, approvedAt: "2026-09-05" },
];

/** Kaynakça — yayınevi/kitabevi KÜNYELERİ (tek tek kitap değil; seri adları) + resmî kaynaklar. Alfabetik sunulur. */
export const TUS_RESOURCES: readonly TusResource[] = [
  // ── Resmî kaynaklar (ücretsiz, kamu) ──
  // 🪤 ÖSYM'de kalıcı bir "çıkmış sorular" sayfası YOK (2026-09-05: /tus-cikmis-sorular → ana sayfaya 302; eski /TR,<id>/ 404):
  // temel soru kitapçığı + cevap anahtarı her dönem sınav günü DUYURU olarak çıkar → TUS sınav grubu sayfasına bağlanır.
  { id: "osym-tus-sayfasi", kind: "resmi", name: "ÖSYM — TUS sınav grubu sayfası (duyurular, temel soru kitapçıkları ve cevap anahtarları)", organization: "ÖSYM",
    officialUrl: "https://www.osym.gov.tr/SinavGrubu/Index/6", note: "Dönem duyuruları, sınav günü yayımlanan temel soru kitapçıkları ve cevap anahtarları, tercih kılavuzları ve yerleştirme sayısal bilgileri bu sayfada listelenir.", verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "osym-kilavuz", kind: "resmi", name: "ÖSYM — 2026-TUS 2. Dönem Başvuru Kılavuzu", organization: "ÖSYM",
    officialUrl: "https://www.osym.gov.tr/2026tus-2-donem-kilavuz-ve-basvuru-bilgileri", note: "Başvuru koşulları, sınav yapısı, puanlama, tercih ve yerleştirme kuralları; bağlayıcı metin kılavuzun kendisidir. Her dönem yeni kılavuz yayımlanır.", verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tuk-mufredat", kind: "resmi", name: "Tıpta Uzmanlık Kurulu — uzmanlık dalları çekirdek eğitim müfredatları", organization: "T.C. Sağlık Bakanlığı Tıpta Uzmanlık Kurulu",
    officialUrl: "https://tuk.saglik.gov.tr/TR-82498/mufredatlar.html", note: "Her uzmanlık dalının çekirdek eğitim müfredatı (yürürlükteki sürüm v2.5) ve müfredat arşivi.", verifiedAt: V, approvedAt: "2026-09-05" },
  // mevzuat.gov.tr sayfaları JS yönlendirmeli (302) → doğrulanabilir kalıcı adres Resmî Gazete metni (3 Eylül 2022, sayı 31942 — 2. belge; 1. belge atama kararı).
  { id: "mevzuat-tuey", kind: "resmi", name: "Tıpta ve Diş Hekimliğinde Uzmanlık Eğitimi Yönetmeliği", organization: "Resmî Gazete (3 Eylül 2022, 31942)",
    officialUrl: "https://www.resmigazete.gov.tr/eskiler/2022/09/20220903-2.htm", note: "Uzmanlık eğitimine giriş, eğitim süreleri, uzmanlık dalı değişikliği ve atama koşullarının dayanağı; kılavuz bu yönetmeliğe atıf yapar.", verifiedAt: V, approvedAt: "2026-09-05" },
  // ── Yayınevleri (kurumların kendi sitelerinde yazan seri adları) ──
  { id: "akademisyen", kind: "kitabevi", name: "Akademisyen Kitabevi / Akademisyen Yayınevi", organization: null,
    officialUrl: "https://akademisyen.com/tus-kitaplari", note: "TUS kitapları bölümü — birden çok yayınevinin serilerini listeler; kendi TUS yayınları da var.", verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "klinisyen-tusdata", kind: "yayinevi", name: "Klinisyen Kitabevi / TUSDATA Yayıncılık", organization: "TUSDATA A.Ş.",
    officialUrl: "https://www.klinisyen.com/", note: "Seriler: Klinisyen Tüm TUS Soruları · Klinisyen Konu ve Soru Kitapları · ProspekTUS · PRETUS Deneme · Vaka Soru Kitapları · TUSDATA Ders Notları · yıl yıl çıkmış TUS soruları.", verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tusem-yayin", kind: "yayinevi", name: "TUSEM yayınları", organization: "TUSEM",
    officialUrl: "https://tusem.com.tr/", note: "Branş soru kitapları ve özet ders notları (kurumun kendi listesi).", verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tusmer-yayin", kind: "yayinevi", name: "TUSMER yayınları", organization: "TUSMER",
    officialUrl: "https://www.tusmer.com/", note: "Konu kitapları ve deneme yayınları (kurumun kendi listesi).", verifiedAt: V, approvedAt: "2026-09-05" },
  { id: "tustime-infotus", kind: "yayinevi", name: "TUSTIME — INFOTUS serisi", organization: "TUSTIME",
    officialUrl: "https://tustime.com/", note: "INFOTUS konu serisi · Fast Track özet notları · soru bankaları (kurumun kendi listesi).", verifiedAt: V, approvedAt: "2026-09-05" },
];

const trCompare = (a: string, b: string) => a.localeCompare(b, "tr-TR", { sensitivity: "base" });

export function approvedCourseProviders(list: readonly TusCourseProvider[] = TUS_COURSE_PROVIDERS): TusCourseProvider[] {
  return list.filter((p) => p.approvedAt !== null).sort((a, b) => trCompare(a.name, b.name));
}
/** Resmî kaynaklar önce (kamu, ücretsiz), sonra yayınevi/kitabevi alfabetik. */
export function approvedResources(list: readonly TusResource[] = TUS_RESOURCES): TusResource[] {
  const ok = list.filter((r) => r.approvedAt !== null);
  const rank = (k: TusResourceKind) => (k === "resmi" ? 0 : 1);
  return ok.sort((a, b) => rank(a.kind) - rank(b.kind) || trCompare(a.name, b.name));
}
