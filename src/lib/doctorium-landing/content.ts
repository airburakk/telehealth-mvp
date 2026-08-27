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

export type SectionId =
  | "hero" | "problem" | "manifesto" | "personalize" | "today" | "academic" | "regulatory"
  | "legal" | "congress" | "identity" | "control" | "transparency" | "difference" | "get-started";

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

/** Problem bölümü — yalnız GERÇEKTEN izlenen kaynaklar (registry: regulatory, legal, congress.db anahtarları). */
export const PROBLEM_SOURCES = [
  { k: "Akademik", sources: "PubMed · Europe PMC · DOAJ" },
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
    requires: ["feed.personal"],
    eyebrow: "Doktorlar için kişisel profesyonel çalışma alanı",
    title: "Her doktor kendi {Doctorium}'unu oluşturur.",
    lead: "Branşınıza ve takip etmek istediğiniz profesyonel gündeme göre şekillenen kişisel çalışma alanınız.",
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
    body: "Akademik yayınlar, düzenleyici gelişmeler, sağlık hukuku, kongreler ve mesleki gündem farklı kaynaklara dağılmış durumda. Maliyet ulaşmak değil; sürekli aramak, seçmek, elemek ve takip etmek.",
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
    requires: ["prefs.branch", "prefs.modules", "feed.personal"],
    eyebrow: "Nasıl çalışır",
    title: "{Doctorium}'unuz size göre şekillenir.",
    lead: "Neyi takip etmek istediğinizi siz belirlersiniz.",
    items: [
      { k: "01", t: "Uzmanlığınız", b: "35 branştan seçin; akademik akış bu seçime göre süzülür." },
      { k: "02", t: "Bölümleriniz", b: "Akademik, sektörel, ilaç ve cihaz, mevzuat, içtihat, doktrin, etkinlik, kariyer — hangileri akışınıza girsin?" },
    ],
    note: "Bu sayfadaki seçim bir önizlemedir; hesabınıza yazılmaz. Üye olunca aynı tercihleri kendi akışınız için yaparsınız.",
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
    id: "regulatory",
    theme: "dark",
    requires: ["regulatory.fda", "regulatory.trials", "regulatory.rg", "regulatory.ohsad"],
    eyebrow: "İlaç & Cihaz", // 🔒 nihai ürün-geneli ad (2026-08-24)
    // İnceleme notu 2026-08-23 "takip etmeyi seçtiğiniz kaynaklardaki…" → KAYNAK seçimi üründe yok
    // (registry prefs.sources unsupported); dürüst eşdeğer = BÖLÜM seçimi (verified).
    title: "Seçtiğiniz bölümlerdeki gelişmeleri tek tek aramayın.",
    body: "İlaç, cihaz ve düzenleyici gelişmeler tek akışta: geri çekme duyuruları, klinik faz kayıtları ve sağlık mevzuatı. Her kartta kaynak ve tarih; prospektüs bilgisine arama ile ulaşırsınız.",
    note: "Prospektüs verisi openFDA kaynaklıdır (ABD); bölgesel geçerlilik notu kartta görünür kalır.",
  },
  {
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
    id: "identity",
    theme: "light",
    requires: ["identity.diploma_edevlet", "identity.student_cert", "identity.badge_ui"],
    eyebrow: "Profesyonel alan",
    title: "Profesyonel alanın değeri, kimin içeride olduğuyla başlar.",
    body: "Doktor üyeliği diploma belgesiyle açılır: e-Devlet barkodlu mezun belgesi veya inceleme. Tıp öğrencisi üyeliği öğrenci belgesiyle; öğrenci üyelikte sponsorlu içerik, anket ve ödül özellikleri kapalıdır.",
    ctas: [{ label: "Öğrenci üyeliğini incele", to: "student" }],
  },
  {
    id: "control",
    theme: "dark",
    requires: ["prefs.branch", "prefs.modules", "prefs.eventTypes"],
    eyebrow: "Kontrol sizde",
    title: "Algoritma sizin yerinize karar vermez.",
    lead: "Önceliklerinizi siz belirlersiniz.",
    items: [
      { t: "Neyi takip edeceğim?", b: "Sekiz bölümü tek tek açıp kapatırsınız." },
      { t: "Hangi branşlarda?", b: "Otuz beş branştan istediğiniz kadarını seçersiniz." },
      { t: "Etkinlikler nasıl?", b: "Tür, kapsam ve hatırlatma gününü siz belirlersiniz." },
    ],
    note: "{Doctorium} sizin profesyonel tercihlerinize göre çalışır.",
  },
  {
    id: "transparency",
    anchor: "guven",
    theme: "light",
    requires: ["transparency.source_meta", "academic.ai_flag"],
    eyebrow: "Güven",
    title: "Özet, kaynağın yerine geçmez.",
    items: [
      { t: "Yapay zekâ özeti açıkça belirtilir." },
      { t: "Kaynak görünür." },
      { t: "Yayın tarihi görünür." },
      { t: "Özgün içeriğe erişim korunur." },
    ],
    note: "{Doctorium} bilgiyi sizin için düzenler. Mesleki değerlendirme doktora aittir.",
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
