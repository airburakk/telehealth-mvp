// Doctorium landing V2 — CAPABILITY REGISTRY (2026-08-23, DOCV2-002).
//
// Landing'deki her pazarlama iddiası buradaki bir anahtara bağlanır. Kural:
//   · `verified`   → "mevcut özellik" diliyle yazılabilir.
//   · `partial`    → yalnız `allowedClaims`'teki daraltılmış alt-iddia yazılabilir.
//   · `planned` / `unsupported` / `unknown` → landing'de GÖRÜNMEZ (metin, çip, logo, kaynak adı dahil).
// Kanıt = kod yolu (path:satır) + doğrulama SHA'sı; sözleşme testi (tests/unit/doctorium-landing-
// registry.test.ts) content.ts'teki her bölümün `requires` listesini buraya karşı ölçer ve yasak
// ifadeleri metinde arar. Dosya SAF VERİ — istemci paketine girebilir (db/ai import'u YOK).
//
// ⚠️ Statü değiştirmek = kod kanıtı göstermek. "Tasarımda görüldüğü için var" sayılmaz
// ([[public-claim-honesty]] + wiki/yonetisim/iddia-kaydi.md). EMA/TİTCK gibi `unsupported`
// kayıtlar ingest geldiğinde `verified`e çekilir; o zamana dek adları landing'de geçmez.

export type CapabilityStatus = "verified" | "partial" | "planned" | "unsupported" | "unknown";

export interface Capability {
  id: CapabilityId;
  status: CapabilityStatus;
  /** Kod kanıtı — path:satır (keşif 2026-08-23, HEAD 4613fe2). */
  evidence: string[];
  /** Landing'de kullanılabilecek iddia dili (partial'da TEK izinli küme). */
  allowedClaims: string[];
  /** Metinde geçmesi YASAK kalıplar (test bunları content.ts'te arar). */
  prohibitedClaims: string[];
  verifiedAt: string;
  verifiedSha: string;
}

export type CapabilityId =
  | "feed.personal"
  | "feed.why"
  | "prefs.branch"
  | "prefs.modules"
  | "prefs.eventTypes"
  | "prefs.interests"
  | "prefs.sources"
  | "prefs.country"
  | "prefs.frequency"
  | "academic.summary"
  | "academic.ai_flag"
  | "regulatory.fda"
  | "regulatory.trials"
  | "regulatory.rg"
  | "regulatory.ohsad"
  | "regulatory.titck"
  | "regulatory.ema"
  | "regulatory.severity"
  | "legal.mevzuat"
  | "legal.ictihat"
  | "legal.doktrin"
  | "legal.search"
  | "congress.db"
  | "congress.deadlines"
  | "congress.follow"
  | "congress.save"
  | "congress.calendar"
  | "identity.diploma_edevlet"
  | "identity.student_cert"
  | "identity.badge_ui"
  | "membership.free"
  | "transparency.source_meta"
  | "transparency.ai_provenance"
  | "analytics.aggregate";

const SHA = "4613fe2";
const AT = "2026-08-23";

const cap = (
  id: CapabilityId,
  status: CapabilityStatus,
  evidence: string[],
  allowedClaims: string[],
  prohibitedClaims: string[] = [],
): Capability => ({ id, status, evidence, allowedClaims, prohibitedClaims, verifiedAt: AT, verifiedSha: SHA });

export const CAPABILITIES: readonly Capability[] = [
  cap("feed.personal", "verified",
    // v6.193: üçüncü kanıt `src/app/api/doctorium/feed/route.ts` idi — o uç SİLİNDİ (sonsuz
    // kaydırma v6.192'de sıralı sayfalamaya döndü, ucun çağıranı kalmadı). Kanıt, akışın
    // gerçekten sunulduğu yere taşındı; iddia ("branş ve bölümlere göre kurulur") değişmedi.
    ["src/lib/doctorium.ts personalFeedPage", "src/lib/doctorium.ts interleaveByModule", "src/app/doktor/doctorium/page.tsx akış sekmesi"],
    ["Akışınız seçtiğiniz branş ve bölümlere göre kurulur", "Bugün eklenen içerik sayısı (gerçek sayım)"],
    ["algoritma sizi tanır", "size özel sıralama", "ilgi skoru"]),
  cap("feed.why", "partial",
    ["src/lib/doctorium.ts:541-587 bölüm kotaları + branş süzgeci (deterministik)"],
    ["Neden görüyorum: branş + bölüm açıklaması (kuraldan türetilmiş)"],
    ["ilgi skoru", "yapay zekâ seçti", "sizin için sıraladı"]),
  cap("prefs.branch", "verified",
    ["prisma/schema.prisma:193 Doctor.newsBranches", "src/lib/doctorium.ts:206 BRANCH_OPTIONS", "src/app/api/doctor/news-branches/route.ts"],
    ["35 branştan seçim"]),
  cap("prefs.modules", "verified",
    ["prisma/schema.prisma:197 Doctor.feedModules", "src/lib/doctorium.ts:308 FEED_MODULE_OPTIONS"],
    ["8 bölümü açıp kapatma"]),
  cap("prefs.eventTypes", "verified",
    ["prisma/schema.prisma:217 congressEventTypes", "src/lib/doctorium.ts:63 EVENT_TYPES", "src/lib/doctorium.ts:836 ALERT_DAY_OPTIONS"],
    ["9 etkinlik türü", "ulusal/uluslararası kapsam", "hatırlatma günü"]),
  cap("prefs.interests", "unsupported", ["keşif 2026-08-23: ayrı ilgi-alanı kolonu/UI yok"], [], ["ilgi alanlarınızı seçin", "ilgi alanı"]),
  cap("prefs.sources", "unsupported", ["keşif: kaynak/dernek takibi kalıcı değil (yalnız ?s= URL süzgeci)"], [], ["kaynaklarınızı seçin", "hangi kaynaklardan"]),
  cap("prefs.country", "unsupported", ["keşif: ülke/regülasyon alanı tercihi yok (congressScope hariç)"], [], ["ülke seçin", "regülasyon alanı seçin"]),
  cap("prefs.frequency", "unsupported", ["keşif: akış bildirim sıklığı yok"], [], ["ne sıklıkta", "günlük özet e-postası", "haftalık bülten"]),
  cap("academic.summary", "verified",
    ["src/lib/doctorium.ts:1034 ensureClinicalSummary", "src/lib/ai-clinical.ts:725 summarizeArticleForClinician", "src/app/doktor/doctorium/[id]/page.tsx:116-157"],
    ["Kısa klinik özet: ana çıkarımlar + çalışma tasarımı + kısıtlılıklar", "Kaynak adı, yayın tarihi, DOI/PubMed bağlantısı", "Özet, kaynağın yerini almaz"],
    ["neden önemli", "iki dakika", "2 dk", "makaleyi okumanıza gerek yok"]),
  cap("academic.ai_flag", "partial",
    ["src/app/doktor/doctorium/ArticleCard.tsx:199-206 'Klinik özet' işareti", "src/app/doktor/doctorium/[id]/page.tsx:151-155 kaldırılamaz uyarı"],
    ["Yapay zekâ özeti açıkça işaretlenir"],
    ["model adı", "üretim zamanı görünür"]),
  cap("regulatory.fda", "verified", ["src/lib/doctorium-sources.ts:528 ingestFdaRecalls", "src/app/api/doctorium/prospektus/route.ts"], ["openFDA geri çekme duyuruları", "openFDA prospektüs araması"]),
  cap("regulatory.trials", "verified", ["src/lib/doctorium-sources.ts:537 ingestTrials"], ["ClinicalTrials.gov Faz 3/4 kayıtları"]),
  cap("regulatory.rg", "verified", ["src/lib/doctorium-sources.ts:312-368 Resmî Gazete"], ["Resmî Gazete sağlık mevzuatı"]),
  cap("regulatory.ohsad", "verified", ["src/lib/doctorium-sources.ts:396 ingestOhsad"], ["OHSAD duyuruları"]),
  cap("regulatory.titck", "unsupported", ["src/lib/doctorium-sources.ts:18 'TİTCK uçları 404'"], [], ["TİTCK", "Titck"]),
  cap("regulatory.ema", "unsupported", ["grep ema.europa = 0"], [], ["EMA", "Avrupa İlaç Ajansı"]),
  cap("regulatory.severity", "unsupported", ["keşif: NewsArticle'da severity kolonu yok"], [], ["kritik uyarı", "aciliyet sınıfı"]),
  cap("legal.mevzuat", "verified", ["src/lib/doctorium-sources.ts:368 ingestGazetteItems"], ["Mevzuat: Resmî Gazete + OHSAD"]),
  cap("legal.ictihat", "verified", ["src/lib/hukuk-ingest.ts:220 ingestYargitay"], ["İçtihat: Yargıtay karar arşivi"]),
  cap("legal.doktrin", "verified", ["src/lib/doktrin-ingest.ts"], ["Doktrin: TR-Dizin hakemli makaleler"]),
  cap("legal.search", "verified",
    ["src/app/doktor/doctorium/page.tsx:671 LegalSearchBox", "src/lib/hukuk-keywords.ts:22 'Aydınlatılmış onam'"],
    ["Sözlük çipleri + serbest arama", "İçerik bilgilendirme amaçlıdır; hukuki görüş yerine geçmez"],
    ["hukuki tavsiye", "hukuki danışmanlık"]),
  cap("congress.db", "verified", ["prisma/seed-data/congresses.json (214)", "src/lib/ttb-events.ts"], ["Küratörlü etkinlik veritabanı + TTB kredilendirme kayıtları"], ["kredi puanı sayısı"]),
  cap("congress.deadlines", "verified", ["prisma/schema.prisma:1143 abstractDeadline/earlyBirdDeadline"], ["Bildiri ve erken kayıt son günleri"]),
  cap("congress.follow", "verified", ["prisma/schema.prisma:1246 CongressFollow", "src/app/api/doctor/congress-follow/route.ts:79"], ["Takip et (girişli)"]),
  cap("congress.save", "verified", ["prisma/schema.prisma:1263 SavedArticle", "src/app/api/doctorium/save/route.ts"], ["Kaydet (girişli)"]),
  cap("congress.calendar", "verified", ["src/app/doktor/doctorium/takvim/page.tsx", "src/lib/calendar.ts:65"], ["Takvim görünümü — takip edilen etkinlikler kendiliğinden düşer"]),
  cap("identity.diploma_edevlet", "verified",
    ["src/lib/edevlet-belge.ts", "src/lib/doctor-activation.ts:252 diplomaVerifiedAt"],
    ["Doktor üyeliği diploma belgesiyle açılır: e-Devlet barkodlu mezun belgesi veya inceleme"],
    ["akredite", "yalnızca doktorlar"]),
  // v6.147: öğrenci kapısı belge DEĞİL üniversite e-postası tıklama-doğrulaması; 2026-09-05'te iddia buna
  // hizalandı ("öğrenci belgesiyle" yasak kalıba alındı). Pazarlama yüzeyi kapalılığı: doctorium-tiers STUDENT.
  cap("identity.student_cert", "verified",
    ["src/app/api/auth/verify-student-email/route.ts studentVerifiedAt", "src/lib/universities.ts domainMatches (.edu.tr allowlist)", "src/lib/doctorium-tiers.ts audienceFlags(STUDENT)"],
    ["Tıp öğrencisi üyeliği üniversitesinin kurumsal e-posta adresiyle (.edu.tr) açılır; sponsorlu içerik, anket ve ödül kapalı"],
    ["öğrenci belgesi"]),
  cap("identity.badge_ui", "partial",
    ["src/components/DoctorDocuments.tsx:45 statusRozet (onboarding)"],
    ["Temsilî doğrulama rozeti (statik)"],
    ["gerçek profil", "üye listesi"]),
  // Üyelik ÜCRETSİZ (2026-09-05, kullanıcı kararı — rapor §1.1): kanıt = hukuki metin + üye tarafında ödeme/abonelik
  // yolunun bulunmaması (gelir modeli SponsorCampaign). 02 madde 5.2 ileride ücretli HİZMET hakkını saklı tuttuğu için
  // mutlak "her zaman / ömür boyu / asla ücret" dili YASAK — yalnız bugünkü durum yazılır.
  cap("membership.free", "verified",
    ["src/lib/doctorium-legal/texts/kosullar.ts madde 5.1 'Doctorium üyeliği Üye için ücretsizdir'", "üye tarafında ödeme/abonelik kodu yok — gelir SponsorCampaign (prisma/schema.prisma)"],
    ["Doktorlar ve tıp öğrencileri için ücretsiz"],
    ["ömür boyu ücretsiz", "her zaman ücretsiz", "asla ücret", "sonsuza dek ücretsiz"]),
  cap("transparency.source_meta", "verified",
    ["src/app/doktor/doctorium/ArticleCard.tsx:161-211 künye"],
    ["Her kartta kaynak adı, yayın tarihi ve özgün bağlantı"],
    ["doğrulanmış bilgi", "kesin bilgi"]),
  cap("transparency.ai_provenance", "unsupported", ["keşif: model/üretim-zamanı kolonu yok"], [], ["model adı", "üretim zamanı"]),
  cap("analytics.aggregate", "verified",
    ["src/app/api/landing-event/route.ts", "prisma LandingEvent (günlük agregat, kimliksiz)"],
    []),
];

const BY_ID: ReadonlyMap<CapabilityId, Capability> = new Map(CAPABILITIES.map((c) => [c.id, c]));

export function capability(id: CapabilityId): Capability {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Tanımsız capability: ${id}`);
  return c;
}

/** Landing'de "var" diye gösterilebilir mi? (verified veya partial — partial'da yalnız allowedClaims) */
export function canShow(id: CapabilityId): boolean {
  const s = capability(id).status;
  return s === "verified" || s === "partial";
}

/** Bölüm için gerekli anahtarların hepsi gösterilebilir mi? Bir tanesi bile değilse bölüm render edilmez. */
export function canShowAll(ids: readonly CapabilityId[]): boolean {
  return ids.every(canShow);
}

/** Yasak kalıpların tamamı (test + içerik denetimi için). Küçük harf karşılaştırma çağıranda. */
export function allProhibitedClaims(): string[] {
  return CAPABILITIES.flatMap((c) => c.prohibitedClaims);
}
