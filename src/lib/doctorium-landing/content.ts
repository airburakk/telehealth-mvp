// Doctorium landing V2 — İÇERİK SÖZLÜĞÜ (typed copy, 2026-08-23). Tek dil TR.
//
// Kurallar:
//   · Metin JSX'e dağılmaz; her bölüm buradan okur. Markdown/HTML yok. "{Doctorium}" yer tutucusu
//     marka lockup'ına (Doctor + zümrüt ium) çevrilir — rich-text.tsx. Rota burada YAZILMAZ
//     (routes.ts anahtarıyla).
//   · Her bölümün `requires` listesi capability registry'ye bağlıdır; gösterilemeyen anahtar
//     bölümü düşürür (canShowAll). Sözleşme testi: tests/unit/doctorium-landing-registry.test.ts.
//   · İddia disiplini: "hekim" YOK (terim kuralı) · "EMA/TİTCK" YOK (ingest yok) · "akredite" YOK ·
//     "uçtan uca" YOK · ölçülmemiş süre/oran YOK · "yalnızca doktorlar" YOK (öğrenci üyeliği var) ·
//     "ilgi alanı / kaynak seçimi / ülke / sıklık" YOK (tercih ekseni yok) · hero'da "AI" YOK.
//   · Üç katmanlı mesaj: marka (hero/final) → ürün (manifesto) → günlük dönüş (bugün).
import type { CapabilityId } from "./capabilities";
import type { LANDING_ROUTES } from "./routes";

// v6.262 (2026-09-10, 👤 Karar 1-3): "control" (→ personalize 3. madde) ve "transparency" (→ identity = Güven hub'ı)
// KALKTI; "students" (Öğrenciler) GİRDİ; legal 04'e, congress regulatory'nin önüne alındı. Sıra SECTIONS'tan.
export type SectionId =
  | "hero" | "problem" | "manifesto" | "personalize" | "legal" | "today" | "academic"
  | "congress" | "regulatory" | "students" | "identity" | "difference" | "get-started";

export type SectionTheme = "dark" | "deep" | "light";
export type RouteKey = keyof typeof LANDING_ROUTES;

export interface Cta {
  label: string;
  to: RouteKey | `#${string}`;
  /** Zümrüt dolgulu ana düğme (Doctor BEYAZ lockup varyantı) */
  primary?: boolean;
}

export interface SectionCopy {
  id: SectionId;
  /** Header çapası (routes.ts LANDING_ANCHORS ile eşleşir) — yoksa bölüm nav'da yer almaz. */
  anchor?: string;
  theme: SectionTheme;
  requires: readonly CapabilityId[];
  eyebrow?: string;
  title: string;
  lead?: string;
  body?: string;
  /** Madde/kart listesi — bölüm kendi düzenini seçer. */
  items?: readonly { k?: string; t: string; b?: string }[];
  /** Küçük dip notu (güven/sınır cümlesi). */
  note?: string;
  ctas?: readonly Cta[];
}

// 🔒 NİHAİ terminoloji (kullanıcı, 2026-08-24 — üçüncü ve SON dönüş): kategori adı ÜRÜN-GENELİ
// "İlaç & Cihaz" (FEED_MODULE_OPTIONS / portal MODULE_HEAD / raf / tercihler ile AYNI);
// "regülasyon/düzenleyici" yalnız açıklama/içerik türü seviyesinde.
export const HERO_PROOF_LINE = ["Akademik", "İlaç & Cihaz", "Sağlık Hukuku", "Kongre & Mesleki Gelişim"] as const;

/** Problem bölümü — yalnız GERÇEKTEN izlenen kaynaklar (registry: regulatory, legal, congress.db anahtarları).
 *  `requires` verilen satır yalnız o anahtar gösterilebilirken çizilir (Problem.tsx canShow) — bölümün kendisi düşmez. */
export const PROBLEM_SOURCES: readonly { k: string; sources: string; requires?: CapabilityId }[] = [
  { k: "Akademik", sources: "PubMed · Europe PMC · DOAJ" },
  { k: "Sektörel", sources: "Medscape · Medical Xpress · WHO", requires: "sector.news" }, // v6.262 (👤 küçük paket)
  { k: "İlaç & Cihaz", sources: "İlaç, cihaz ve düzenleyici gelişmeler — openFDA · ClinicalTrials.gov · Resmî Gazete" },
  { k: "Hukuk", sources: "Resmî Gazete · Yargıtay · TR-Dizin" },
  { k: "Kongre", sources: "TTB kredilendirme · uzmanlık dernekleri" },
] as const;

export const REGULATORY_SOURCES = ["openFDA", "ClinicalTrials.gov", "Resmî Gazete", "OHSAD"] as const;

export const DIFFERENCE_ROWS = [
  { portal: "Herkese benzer akış", doctorium: "Size göre şekillenen akış" },
  { portal: "Platform seçer", doctorium: "Siz seçersiniz" },
  { portal: "İçerik akışı", doctorium: "Çalışma alanı" },
  { portal: "Daha fazla içerik", doctorium: "Sizin için doğru içerik" }, // manifesto callback'i (inceleme notu 2026-08-23)
  { portal: "Genel gündem", doctorium: "Kişisel profesyonel gündem" },
] as const;

export const SECTIONS: readonly SectionCopy[] = [
  {
    id: "hero",
    theme: "dark",
    // 2026-09-05 (kullanıcı kararı, rapor §1.1): "ücretsiz" iddiası hero lead'inin sonunda — kayıt defteri
    // membership.free (kanıt: 02 Üyelik Sözleşmesi madde 5.1 + üye tarafında ödeme kodu yok). Mutlak "ömür boyu"
    // dili YASAK (madde 5.2 ileride ücretli hizmet hakkını saklı tutar).
    requires: ["feed.personal", "membership.free"],
    eyebrow: "Doktorlar için kişisel profesyonel çalışma alanı",
    title: "Her doktor kendi {Doctorium}'unu oluşturur.",
    lead: "Branşınıza ve takip etmek istediğiniz profesyonel gündeme göre şekillenen kişisel çalışma alanınız. Doktorlar ve tıp öğrencileri için ücretsiz.",
    note: "Doğrulanmış doktor ve tıp öğrencisi üyeliği — belge incelemesiyle.",
    ctas: [
      { label: "{Doctorium}'unu oluştur", to: "signup", primary: true },
      { label: "Nasıl çalıştığını gör", to: "#nasil" },
    ],
  },
  {
    id: "problem",
    theme: "light",
    requires: [],
    eyebrow: "Sorun",
    title: "Sorun bilgiye ulaşmak değil. Sizin için önemli olanı zamanında bulmak.",
    // v6.262 (2026-09-10, 👤 küçük paket): gövde tek cümle; Sektörel sütunu PROBLEM_SOURCES'a girdi (registry sector.news).
    body: "Akademik yayınlar, sektörel haberler, ilaç ve cihaz gelişmeleri, sağlık hukuku ve kongreler farklı kaynaklara dağılmış durumda; maliyet ulaşmak değil, sürekli aramak ve elemek.",
    note: "{Doctorium} bunlara yeni bir kaynak daha eklemez. Profesyonel gündeminizi tek çalışma alanında bir araya getirir.",
  },
  {
    id: "manifesto",
    theme: "deep",
    requires: ["prefs.branch"],
    title: "Daha fazla bilgi değil. Sizin için doğru bilgi.",
    body: "Herkese aynı akış değil. Sizin tercihlerinizle şekillenen {Doctorium}.",
  },
  {
    id: "personalize",
    anchor: "nasil",
    theme: "light",
    requires: ["prefs.branch", "prefs.modules", "prefs.eventTypes", "feed.personal"],
    eyebrow: "Nasıl çalışır",
    title: "{Doctorium}'unuz size göre şekillenir.",
    lead: "Neyi takip etmek istediğinizi siz belirlersiniz.",
    items: [
      { k: "01", t: "Uzmanlığınız", b: "35 branştan seçin; akademik akış bu seçime göre süzülür." },
      { k: "02", t: "Bölümleriniz", b: "Akademik, sektörel, ilaç ve cihaz, mevzuat, içtihat, doktrin, etkinlik, kariyer — hangileri akışınıza girsin?" },
      // v6.262 (👤 Karar 1): eski 10 "Kontrol sizde" bölümünün üçüncü kartı buraya katlandı (ilk ikisi 01/02'nin tekrarıydı).
      { k: "03", t: "Etkinlikleriniz", b: "Tür, kapsam ve hatırlatma gününü siz belirlersiniz." },
    ],
    note: "Bu sayfadaki seçim bir önizlemedir; hesabınıza yazılmaz. Üye olunca aynı tercihleri kendi akışınız için yaparsınız.",
  },
  {
    // v6.262 (👤 Karar 2): 07'den 04'e — pazardaki tek gerçek ayrım (Yargıtay + TR-Dizin + Resmî Gazete, aranabilir arşiv)
    // ilk kanıt olarak görünür. Registry testi sırayı kilitler (legal = personalize + 1).
    id: "legal",
    anchor: "hukuk",
    theme: "light",
    requires: ["legal.mevzuat", "legal.ictihat", "legal.doktrin", "legal.search"],
    eyebrow: "Sağlık Hukuku",
    title: "Sağlık hukukunda aradığınız bilgiye tek bir yerden başlayın.",
    body: "Mevzuat, içtihat ve doktrin aynı çalışma alanında: Resmî Gazete değişiklikleri, Yargıtay kararları ve TR-Dizin hakemli makaleleri.",
    note: "İçerikler bilgilendirme amacı taşır; hukuki görüş yerine geçmez.",
  },
  {
    id: "today",
    theme: "dark",
    requires: ["feed.personal", "feed.why"],
    eyebrow: "Bugün sizin için",
    title: "Her gün her şeyi takip etmeyin.",
    lead: "Bugün sizin için önemli olanları görün.",
    note: "Her kartın altında neden gördüğünüz yazar: branşınız ve seçtiğiniz bölüm. Başka bir sıralama mekanizması yok.",
  },
  {
    id: "academic",
    anchor: "akademik",
    theme: "light",
    requires: ["academic.summary", "academic.ai_flag", "transparency.source_meta"],
    eyebrow: "Akademik",
    title: "Bir yayının sizin için önemli olup olmadığını daha hızlı değerlendirin.",
    body: "Kısa klinik özet: ana çıkarımlar, çalışma tasarımı ve kısıtlılıklar. Kaynak adı, yayın tarihi ve DOI her özetin yanında; gerektiğinde tek tıkla özgün yayına gidin.",
    note: "Özet yapay zekâ ile üretilir ve açıkça işaretlenir. Özet, kaynağın yerini almaz.",
  },
  {
    id: "congress",
    anchor: "kongre",
    theme: "dark",
    requires: ["congress.db", "congress.deadlines", "congress.follow", "congress.save", "congress.calendar"],
    eyebrow: "Kongre & Mesleki Gelişim",
    title: "Size uygun fırsatları zamanı geçtikten sonra görmeyin.",
    body: "Branşınıza göre yaklaşan etkinlikler; bildiri ve erken kayıt son günleri kartın üstünde. Takip ettikleriniz takviminize düşer.",
    note: "Takip et ve Kaydet giriş yapınca açılır. TTB kredilendirme kodu kartta görünür; kredi tutarı TTB kaydında oluşur.",
  },
  {
    id: "regulatory",
    theme: "dark",
    requires: ["regulatory.fda", "regulatory.trials", "regulatory.rg", "regulatory.ohsad"],
    eyebrow: "İlaç & Cihaz", // 🔒 nihai ürün-geneli ad (2026-08-24)
    // İnceleme notu 2026-08-23 "takip etmeyi seçtiğiniz kaynaklardaki…" → KAYNAK seçimi üründe yok
    // (registry prefs.sources unsupported); dürüst eşdeğer = BÖLÜM seçimi (verified).
    // v6.262 (👤 küçük paket): "Seçtiğiniz bölümlerdeki gelişmeleri tek tek aramayın." → içerik türlerini sayan başlık.
    title: "Geri çekme, klinik faz ve mevzuat tek akışta.",
    body: "İlaç, cihaz ve düzenleyici gelişmeler tek akışta: geri çekme duyuruları, klinik faz kayıtları ve sağlık mevzuatı. Her kartta kaynak ve tarih; prospektüs bilgisine arama ile ulaşırsınız.",
    note: "Prospektüs verisi openFDA kaynaklıdır (ABD); bölgesel geçerlilik notu kartta görünür kalır.",
  },
  {
    // v6.262 (2026-09-10, 👤 Karar 3 = Seçenek A + C): öğrenci rafları landing'de ilk kez — her cümle kod kanıtlı
    // (registry student.*). Kanıt penceresi gerçek onaylı Kariyer EDU kayıtları + ÖSYM son dönem özeti; metinde ADET
    // yazılmaz (haftalık veri nöbetçisi değiştirir). Görsel taslak: vault output/doctorium-landing-taslak-2026-09-09.
    id: "students",
    anchor: "ogrenci",
    theme: "light",
    requires: ["identity.student_cert", "student.career_edu", "student.tus", "student.transition", "membership.free"],
    eyebrow: "Tıp öğrencileri için",
    title: "{Doctorium} tıp fakültesinde başlar.",
    lead: "Üniversite e-postanızla açılan öğrenci üyeliği: aynı akış, aynı sağlık hukuku arşivi, aynı takvim — ve öğrenciye özel iki raf.",
    items: [
      { k: "01", t: "Kariyer: Staj, Değişim Programları, Burs", b: "TurkMSIC SCOPE ve SCORE, Erasmus+, Farabi ve Mevlana, TEV, VKV ve TÜBİTAK destekleri tek listede. Takip ettiğiniz fırsatın son başvurusu 7, 3 ve 1 gün kala hatırlatılır." },
      { k: "02", t: "TUS: veriler, rehberler, sınav dönemleri", b: "ÖSYM yerleştirme verileri branş ve dönem bazında, kılavuz özetleri ve tarafsız kaynakça; sınav dönemleri Takvim'inize düşer. Tahmin ve tercih tavsiyesi yoktur." },
      { k: "03", t: "Mezun olunca aynı hesap", b: "Diplomanız doğrulanınca öğrenci kaydınız temizlenir, hesabınız doktor üyeliğine geçer." },
    ],
    note: "Öğrenci üyelikte sponsorlu içerik, anket ve puan gösterilmez; klinik yüzeyler kapalıdır.",
    // Düğme etiketi lockup'sız düz metin (akan metin kuralı v6.140); koral dolgu = öğrenci kulvarı (ui/button student).
    ctas: [{ label: "Öğrenci Doctorium'unu oluştur", to: "student", primary: true }],
  },
  {
    // v6.262 (👤 Karar 1): eski 11 "Güven" (şeffaflık) bölümü buraya katlandı → "Güven hub'ı": kimlik doğrulama + özet
    // sınırı + (bayrak açıkken) deneme satırı. id/analytics yerleşimi "identity" sürer; nav çapası #guven buraya taşındı.
    id: "identity",
    anchor: "guven",
    theme: "light",
    requires: ["identity.diploma_edevlet", "identity.student_cert", "identity.badge_ui", "transparency.source_meta", "academic.ai_flag"],
    eyebrow: "Güven",
    title: "Profesyonel alanın değeri, kimin içeride olduğuyla başlar.",
    lead: "Özet, kaynağın yerine geçmez.",
    // 2026-09-05 düzeltme: öğrenci kapısı v6.147'den beri üniversite e-postası doğrulaması — "öğrenci belgesiyle" yanlıştı.
    body: "Doktor üyeliği diploma belgesiyle açılır: e-Devlet barkodlu mezun belgesi veya inceleme. Tıp öğrencisi üyeliği üniversitesinin kurumsal e-posta adresiyle (.edu.tr) açılır; öğrenci üyelikte sponsorlu içerik, anket ve ödül özellikleri kapalıdır.",
    items: [
      { t: "Yapay zekâ özeti açıkça belirtilir." },
      { t: "Kaynak görünür." },
      { t: "Yayın tarihi görünür." },
      { t: "Özgün içeriğe erişim korunur." },
    ],
    note: "{Doctorium} bilgiyi sizin için düzenler. Mesleki değerlendirme doktora aittir.",
    ctas: [{ label: "Öğrenci üyeliğini incele", to: "student" }],
  },
  {
    id: "difference",
    theme: "dark",
    requires: [],
    eyebrow: "Neden {Doctorium}?",
    title: "Genel portal ile kişisel çalışma alanı arasındaki fark.",
    note: "{Doctorium}'a sadece üye olmazsınız. Kendi {Doctorium}'unuzu oluşturursunuz.",
  },
  {
    id: "get-started",
    anchor: "basla", // nav'da yok; mobil sticky CTA bu id'yi gözler (görünürken gizlenir)
    theme: "light",
    requires: [],
    title: "Her doktor kendi {Doctorium}'unu oluşturur.",
    body: "Profesyonel gündeminizi kendi önceliklerinize göre şekillendirin.",
    ctas: [
      { label: "{Doctorium}'unu oluştur", to: "signup", primary: true },
      { label: "Zaten üye misiniz? Giriş yap", to: "login" },
      // v6.262 (👤 Karar 3 · C): gri satırdan ikincil düğmeye (koral çerçeve) — FinalCta.tsx.
      { label: "Tıp öğrencisi misiniz? Öğrenci üyeliği", to: "student" },
    ],
  },
];

const BY_ID: ReadonlyMap<SectionId, SectionCopy> = new Map(SECTIONS.map((s) => [s.id, s]));
export function section(id: SectionId): SectionCopy {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Tanımsız bölüm: ${id}`);
  return s;
}

// "hero" HARİÇ (video-zeminli, LandingSection kullanmaz) sıradaki bölüm no'su — 01, 02, ... Bölüm
// ayrım rozeti için (2026-08-27, kullanıcı bulgusu: "sayfaların ayrımı belli olmuyor" — zebra
// v3'te kapalı, SECTIONS sırasından türeyen numara bölüm sınırını görsel olarak işaretler).
const NON_HERO_IDS = SECTIONS.filter((s) => s.id !== "hero").map((s) => s.id);
export function chapterNo(id: SectionId): string {
  const i = NON_HERO_IDS.indexOf(id);
  return String(i + 1).padStart(2, "0");
}

/** Metadata — görünür metinle AYNI iddia disiplinine tabi (meta/OG ayrı taranır). */
export const LANDING_META = {
  title: "Doctorium", // ayrışma 2026-08-24: sekme yalın "Doctorium" (page.tsx title.absolute)
  description:
    "Her doktor kendi Doctorium'unu oluşturur: branşınıza ve seçtiğiniz bölümlere göre şekillenen kişisel profesyonel çalışma alanı — hakemli yayın özetleri, ilaç ve cihaz, sağlık hukuku, kongre takvimi. Doğrulanmış doktor ve tıp öğrencisi üyeliği.",
  ogTitle: "Doctorium — Her doktor kendi Doctorium'unu oluşturur",
  ogDescription:
    "Doktorun kişisel profesyonel çalışma alanı: seçtiğiniz branş ve bölümlere göre kurulan akış; akademik, ilaç ve cihaz, sağlık hukuku, kongre.",
} as const;
