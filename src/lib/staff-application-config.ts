// Kurumsal üyelik başvurusu — ROL-CONFIG TEK KAYNAK (2026-08-12).
// SIR/DB İÇERMEZ → client bileşenleri güvenle import edebilir (roles.ts ayrılma dersi;
// [[rsc-client-module-data-export]]: db'li modülden client'a veri export edilemez — sunucu
// yardımcıları src/lib/staff-application.ts'te ayrı yaşar).
//
// Buradaki alan tanımları üç yüzeyi birden sürer:
//  1. /kayit/<rol> başvuru formu (StaffSignupForm — alanları config'ten çizer)
//  2. POST /api/auth/signup-staff sunucu validasyonu (validateStaffAnswers)
//  3. /admin/personel-onay inceleme ekranı (yanıt etiketleri + zorunlu belge listesi)
// Yeni rol/soru eklerken YALNIZ bu dosya + (gerekirse) migration değişir.

import { STAFF_SIGNUP_ROLES, type StaffSignupRole } from "@/lib/roles";
// cities.ts saf veridir (db/sır YOK) → bu client-güvenli config'e girmesi sorun değil.
import { CITY_OPTIONS } from "@/lib/cities";

export { STAFF_SIGNUP_ROLES, type StaffSignupRole };

// ── Alan modeli ──────────────────────────────────────────────────────────────────────────────────
export type StaffFieldType = "text" | "select" | "multiselect" | "tel";

export interface StaffField {
  key: string;
  label: string;
  type: StaffFieldType;
  required: boolean;
  options?: readonly string[]; // select/multiselect için geçerli değerler (sunucu da denetler)
  placeholder?: string;
  hint?: string;
  maxLen?: number;
}

export interface StaffDocRequirement {
  type: string; // StaffDocument.type anahtarı
  label: string; // insan-okur belge adı (durum sayfası + onay ekranı)
}

export interface StaffRoleConfig {
  role: StaffSignupRole;
  slug: string; // /kayit/<slug> rotası
  title: string; // form başlığı
  sub: string; // form alt metni
  fields: readonly StaffField[];
  nameKey: string; // User.name'e yazılacak yanıt anahtarı (AGENCY'de yetkili kişi)
  docs: readonly StaffDocRequirement[]; // zorunlu belgeler (yükleme /kayit/durum'dan; onay öncesi insan kontrolü)
}

// ── Sabit listeler ───────────────────────────────────────────────────────────────────────────────
export const HEALTH_PRO_PROFESSIONS = [
  "Hemşire",
  "Ebe",
  "Fizyoterapist",
  "Psikolog",
  "Diyetisyen",
  "Odyolog",
  "Dil ve Konuşma Terapisti",
  "Paramedik / ATT",
  "Diğer",
] as const;

export const PARTNER_TITLES = ["Dr.", "Uzm. Dr.", "Doç. Dr.", "Prof. Dr."] as const;

// ── Rol yapılandırmaları ─────────────────────────────────────────────────────────────────────────
// ⚖️ Soru/etiket metinleri TASLAK — nihai dil hukukçu (kullanıcı) onayıyla kesinleşir.
export const STAFF_ROLE_CONFIGS: Record<StaffSignupRole, StaffRoleConfig> = {
  PARTNER: {
    role: "PARTNER",
    slug: "partner",
    title: "Partner Doktor Başvurusu",
    sub: "Yurt dışından hasta yönlendiren ortak doktor — platform hasta veritabanına erişmez, anonimleştirilmiş konsültasyon talebi açar.",
    nameKey: "name",
    fields: [
      { key: "name", label: "Ad soyad", type: "text", required: true, placeholder: "Dr. Elena Petrova", maxLen: 120 },
      { key: "title", label: "Ünvan", type: "select", required: true, options: PARTNER_TITLES },
      { key: "country", label: "Ülke", type: "text", required: true, placeholder: "Almanya", hint: "Mesleğinizi icra ettiğiniz ülke", maxLen: 60 },
      { key: "institution", label: "Kurum / klinik", type: "text", required: true, placeholder: "Charité Berlin", maxLen: 160 },
      { key: "branch", label: "Ana branş", type: "text", required: true, placeholder: "Kardiyoloji", maxLen: 80 },
      { key: "licenseNo", label: "Tescil / lisans numarası", type: "text", required: true, hint: "Ülkenizdeki doktorluk tescil numaranız — doğrulamada kullanılır", maxLen: 60 },
      { key: "phone", label: "Telefon", type: "tel", required: false, placeholder: "+49 ...", maxLen: 20 },
    ],
    docs: [{ type: "LICENSE", label: "Doktorluk tescil / diploma belgesi (bulunduğunuz ülke)" }],
  },
  AGENCY: {
    role: "AGENCY",
    slug: "acente",
    title: "Sağlık Turizmi Acentesi Başvurusu",
    sub: "Tedavi dosyalarına teklif hazırlayan yetkili acente — başvuru kurum adına yapılır.",
    nameKey: "contactName",
    fields: [
      { key: "companyName", label: "Şirket unvanı", type: "text", required: true, placeholder: "Anadolu Sağlık Turizmi A.Ş.", maxLen: 160 },
      { key: "contactName", label: "Yetkili ad soyad", type: "text", required: true, maxLen: 120 },
      { key: "tursabNo", label: "TÜRSAB belge numarası", type: "text", required: true, hint: "Seyahat acentesi işletme belgesi numarası", maxLen: 40 },
      { key: "authorityNo", label: "Sağlık turizmi yetki belgesi no", type: "text", required: false, hint: "Sağlık Bakanlığı / USHAŞ yetki belgesi (varsa) — ⚖️ zorunluluk değerlendirmesi taslak", maxLen: 60 },
      { key: "taxNo", label: "Vergi numarası", type: "text", required: true, maxLen: 20 },
      { key: "country", label: "Merkez ülke", type: "text", required: true, placeholder: "Türkiye", maxLen: 60 },
      { key: "address", label: "Adres", type: "text", required: true, maxLen: 240 },
      { key: "markets", label: "Faaliyet gösterilen pazarlar", type: "text", required: false, placeholder: "Almanya, Rusya, Körfez", hint: "Hasta getirdiğiniz başlıca ülkeler", maxLen: 160 },
      { key: "phone", label: "Telefon", type: "tel", required: true, placeholder: "+90 ...", maxLen: 20 },
    ],
    docs: [
      { type: "TURSAB", label: "TÜRSAB işletme belgesi" },
      { type: "AUTHORITY", label: "Sağlık turizmi yetki belgesi (varsa)" },
    ],
  },
  HEALTH_PRO: {
    role: "HEALTH_PRO",
    slug: "saglik-uzmani",
    title: "Sağlık Uzmanı Başvurusu",
    sub: "Doktor dışı sağlık profesyoneli — bu aşamada klinik vaka erişimi bulunmaz; yetki kapsamı doğrulama sonrası ayrıca tanımlanır.",
    nameKey: "name",
    fields: [
      { key: "name", label: "Ad soyad", type: "text", required: true, maxLen: 120 },
      { key: "profession", label: "Meslek", type: "select", required: true, options: HEALTH_PRO_PROFESSIONS },
      { key: "licenseNo", label: "Diploma / tescil numarası", type: "text", required: true, maxLen: 60 },
      { key: "institution", label: "Çalıştığınız kurum", type: "text", required: false, maxLen: 160 },
      // Kapalı liste (v6.194) — v6.189 üç kayıt formunu kapatmıştı, başvuru formu dışarıda kalmıştı.
      // `select` seçmek tek başına SUNUCU korumasını da getirir: staff-application.ts alan
      // doğrulayıcısı `f.options.includes(...)` denetimini ZATEN yapıyor (uç değişikliği gerekmez).
      { key: "city", label: "Şehir", type: "select", required: true, options: CITY_OPTIONS },
      { key: "phone", label: "Telefon", type: "tel", required: false, placeholder: "+90 5xx ...", maxLen: 20 },
    ],
    docs: [{ type: "DIPLOMA", label: "Diploma / meslek belgesi" }],
  },
};

// slug → config (rota çözümü: /kayit/partner | /kayit/acente | /kayit/saglik-uzmani)
export function staffConfigBySlug(slug: string): StaffRoleConfig | null {
  return Object.values(STAFF_ROLE_CONFIGS).find((c) => c.slug === slug) ?? null;
}

// ── Başvuru durumu sözlüğü ───────────────────────────────────────────────────────────────────────
export const STAFF_APP_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;
export type StaffAppStatus = (typeof STAFF_APP_STATUS)[number];

export const STAFF_APP_STATUS_LABELS: Record<StaffAppStatus, string> = {
  PENDING: "İncelemede",
  APPROVED: "Onaylandı",
  REJECTED: "Düzeltme istendi",
};

// ⚖️ TASLAK — başvuru formundaki KVKK aydınlatma/onay kutusu metni (kanonik TR).
// Giriş sonrası /onam kapısındaki GENEL personel onamından AYRI bir kapsamdır: burada yalnız
// BAŞVURU verisinin (kimlik, meslek, kurum, belge) değerlendirme amaçlı işlenmesine onay alınır.
// Metin esaslı değişirse STAFF_APPLICATION_CONSENT_VERSION artırılır (ConsentRecord sürümlü).
export const STAFF_APPLICATION_CONSENT_SCOPE = "STAFF_APPLICATION_KVKK";
export const STAFF_APPLICATION_CONSENT_VERSION = 1;
export const STAFF_APPLICATION_CONSENT_TEXT = `AURA Kurumsal Üyelik Başvurusu — KVKK Aydınlatma ve Onay (Sürüm 1 · TASLAK)

1. Veri sorumlusu: AURA platformunu işleten şirket(ler) (S1 Yazılım / S2 Operasyon).
2. İşlenen veriler: başvuru formunda verdiğiniz kimlik, iletişim, meslek/kurum ve belge bilgileri.
3. Amaç: kurumsal üyelik başvurunuzun değerlendirilmesi, mesleki yeterlilik ve belge doğrulaması, üyelik ilişkisinin kurulması.
4. Saklama: başvurunuz reddedilirse verileriniz makul değerlendirme/itiraz süresi sonunda imha edilir; onaylanırsa üyelik süresince saklanır.
5. Haklarınız: KVKK m.11 kapsamındaki erişim, düzeltme, silme ve itiraz haklarınızı kullanabilirsiniz.
6. Onay: başvuru verilerimin yukarıdaki kapsamda işlenmesini kabul ediyorum.`;
