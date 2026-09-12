// AURA hukuki belge ROTA kaydı (kod Paket A, v6.268 · 2026-09-13) — HAFİF modül: metin gövdesi YOK.
//
// Neden ayrı dosya: AuraFooter ("use client"), chrome-routes (proxy/Header yolu), sitemap ve testler yalnız slug/rota/
// yayın bayrağı/başlığa bakar; ~60 KB metin sabiti client bundle'a girmesin. Gövdeler lib/aura-legal/index.ts'te
// (texts/*.ts — vault `output/aura-hukuki-belgeler/_yayin-kesiti.py` üretir; elle düzenlenmez).
//
// Kaynak set: Air vault `output/aura-hukuki-belgeler/` (Sürüm 1.0 NİHAİ, 👤 kararlar 12.09.2026, S1–S10 + R1–R25).
// TR = kanonik (bağlayıcı) · EN = ikinci kanonik (S4; `?lang=en`, çelişkide TR esastır); diğer 7 arayüz dilinde TR/EN
// metin geçerlidir (kabuk notu). Kimlik alanları tüzel kişilik kurulana dek "AURA platform işleticisi" + "bu bölüme
// eklenecektir" yer tutucusuyla yayımlanır; e-posta kanalı kutu açılana dek yayımlanmaz (S6) → platform içi form.
//
// ⚠️ Saf sabit modül: db/auth ağacına dokunmaz.
export type AuraLegalSlug = "aydinlatma" | "kosullar" | "tele-saglik" | "cerez" | "kvkk-basvuru";
export type AuraLegalLang = "tr" | "en";

export const AURA_LEGAL_VERSION = "1.0";
export const AURA_LEGAL_DATE = "2026-09-12";
export const AURA_LEGAL_DATE_LABEL: Record<AuraLegalLang, string> = { tr: "12 Eylül 2026", en: "12 September 2026" };
/** Tüzel kişilik kurulana dek işletici ifadesi (Kılavuz madde 5 kimlik tablosu; Doctorium 03.09.2026 kararıyla aynı desen). */
export const AURA_OPERATOR_LABEL: Record<AuraLegalLang, string> = { tr: "AURA platform işleticisi", en: "the AURA platform operator" };

export interface AuraLegalRoute {
  slug: AuraLegalSlug;
  /** Kanonik rota — auraglobalcare.com/<slug>; doctorium.tr'de AURA_ONLY_PREFIXES ile AURA'ya 307. */
  path: `/${AuraLegalSlug}`;
  /**
   * Yayın bayrağı. A03 (tele-saglik) yayın şartı (Kılavuz madde 2): klinik hizmet sağlayıcı kimliği + USHAŞ yetki
   * belgesi alanları dolmadan yayımlanmaz → sayfa 404 + noindex, footer/sitemap/sentetik kontrol dışı. Krom sözleşmesi
   * (CHROME_FREE_ROUTES) şimdiden tamdır; açmak = bu bayrak + `_yayin-kesiti.py` ROUTE haritasına "/tele-saglik".
   */
  published: boolean;
  /** Kaynak belge (vault seti) — izlenebilirlik. */
  source: string;
  title: Record<AuraLegalLang, string>;
  navTitle: Record<AuraLegalLang, string>;
  description: Record<AuraLegalLang, string>;
}

export const AURA_LEGAL_ROUTES: readonly AuraLegalRoute[] = [
  {
    slug: "aydinlatma",
    path: "/aydinlatma",
    published: true,
    source: "A01-kvkk-aydinlatma-metni-hasta",
    title: {
      tr: "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni ve Açık Rıza (Hasta)",
      en: "Privacy Notice on the Processing of Personal Data and Explicit Consent (Patient)",
    },
    navTitle: { tr: "Aydınlatma Metni", en: "Privacy Notice" },
    description: {
      tr: "AURA telesağlık platformunda hasta olarak hangi kişisel ve sağlık verilerinizin, hangi amaçla ve hangi hukuki sebeple işlendiği; aktarım, saklama süreleri, KVKK madde 11 ve GDPR hakları; özel nitelikli sağlık verisi açık rızası.",
      en: "Which personal and health data AURA processes about you as a patient, for what purposes and on what legal grounds; transfers, retention periods, your KVKK Article 11 and GDPR rights; explicit consent for special-category health data.",
    },
  },
  {
    slug: "kosullar",
    path: "/kosullar",
    published: true,
    source: "A02-kullanim-kosullari-hizmet-sozlesmesi-hasta",
    title: { tr: "Kullanım Koşulları ve Hizmet Sözleşmesi (Hasta)", en: "Terms of Use and Service Agreement (Patient)" },
    navTitle: { tr: "Kullanım Koşulları", en: "Terms of Use" },
    description: {
      tr: "AURA telesağlık platformunun hastaya sunduğu koordinasyon hizmetinin şartları: dört hasta yolu, hizmetin niteliği ve sınırları, ücret ve ödeme durumu, kayıt paylaşımı, Etik Kurul, sorumluluk, fesih ve uygulanacak hukuk.",
      en: "The terms of the coordination service AURA offers to patients: the four patient paths, the nature and limits of the service, fees and payment status, record sharing, the Ethics Board, liability, termination and governing law.",
    },
  },
  {
    slug: "tele-saglik",
    path: "/tele-saglik",
    published: false,
    source: "A03-tele-saglik-hizmeti-bilgilendirmesi",
    title: { tr: "Tele-sağlık (Uzaktan Sağlık) Hizmeti Bilgilendirmesi", en: "Telehealth (Remote Health) Service Information" },
    navTitle: { tr: "Tele-sağlık Bilgilendirmesi", en: "Telehealth Information" },
    description: {
      tr: "Uzaktan sağlık hizmetinin ne olduğu, neleri kapsamadığı, acil durumlar, görüşme sırasında dikkat edilecekler, kayıtlar, yapay zekâ desteği, ücretler ve haklarınız.",
      en: "What the remote health service is and is not, emergencies, what to expect during the consultation, records, AI support, fees and your rights.",
    },
  },
  {
    slug: "cerez",
    path: "/cerez",
    published: true,
    source: "A05-cerez-politikasi",
    title: { tr: "Çerez ve Yerel Depolama Politikası", en: "Cookie and Local Storage Policy" },
    navTitle: { tr: "Çerez Politikası", en: "Cookie Policy" },
    description: {
      tr: "AURA'da kullanılan iki çerez (oturum ve tema), yerel depolama anahtarları, çerezsiz ölçüm ve tarayıcı ayarları; çerez rıza penceresi neden yok.",
      en: "The two cookies AURA uses (session and theme), local storage keys, cookie-free measurement and browser settings; why there is no cookie consent banner.",
    },
  },
  {
    slug: "kvkk-basvuru",
    path: "/kvkk-basvuru",
    published: true,
    source: "A07-veri-sahibi-basvuru-usul-esaslari",
    title: { tr: "İlgili Kişi (Veri Sahibi) Başvuru Usul ve Esasları", en: "Data Subject Request Procedure and Principles" },
    navTitle: { tr: "KVKK Başvurusu", en: "Data Subject Requests" },
    description: {
      tr: "KVKK madde 11 ve GDPR kapsamındaki haklarınızı nasıl kullanırsınız: başvuru kanalları, gerekli bilgiler, cevap süresi, Kurul'a şikâyet; platform içi silme ve dışa aktarma.",
      en: "How to exercise your KVKK Article 11 and GDPR rights: request channels, required information, response time, complaints to the Board; in-platform deletion and export.",
    },
  },
];

export const AURA_LEGAL_PATHS: readonly string[] = AURA_LEGAL_ROUTES.map((r) => r.path);
export const AURA_LEGAL_PUBLISHED: readonly AuraLegalRoute[] = AURA_LEGAL_ROUTES.filter((r) => r.published);
export const AURA_LEGAL_PUBLISHED_PATHS: readonly string[] = AURA_LEGAL_PUBLISHED.map((r) => r.path);

export function auraLegalRoute(slug: string): AuraLegalRoute | null {
  return AURA_LEGAL_ROUTES.find((r) => r.slug === slug) ?? null;
}

/** `?lang=` değeri → belge dili (yalnız tr/en; her şey TR'ye düşer — kanonik). */
export function auraLegalLang(value: string | string[] | undefined | null): AuraLegalLang {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "en" ? "en" : "tr";
}

/** Belge bağlantısı — TR kanonik yol, EN `?lang=en`. */
export function auraLegalHref(path: string, lang: AuraLegalLang): string {
  return lang === "en" ? `${path}?lang=en` : path;
}
