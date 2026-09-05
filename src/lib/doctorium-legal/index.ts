// Doctorium hukuki belge kaydı (v6.210 · 2026-09-03) — yayımlanan BEŞ belgenin TEK kaynağı.
//
// Kaynak set: Air vault `output/doctorium-hukuki-belgeler/` (20 belge + Kılavuz, Sürüm 1.0 NİHAİ,
// 👤 kararlar 03.09.2026). Buradaki metinler o belgelerin YAYIN KESİTİDİR (iç notlar, karar
// bölümleri ve kod bağlantıları çıkarılmış; `texts/*.ts` dosyaları vault script'iyle üretilir).
// Kimlik alanları (ticaret unvanı, adres, MERSİS, KEP, VERBİS) işletici tüzel kişilik kurulunca
// doldurulur; o güne dek metinlerde "Doctorium platform işleticisi" ifadesi kullanılır (👤 karar).
//
// Tüketenler: /doctorium/<slug> sayfaları · Doctorium footer'ları (LEGAL_LINKS) · sitemap
// (Doctorium deploy'u) · chrome-routes (krom-dışı rota sözleşmesi, testle bağlı) · 1b: aydınlatma
// metni DOCTORIUM_KVKK onam kapsamının kanonik metnidir (ekran = hash).
//
// ⚠️ Saf sabit modül: db/auth ağacına dokunmaz (client bileşenler de import edebilir — RSC
// client-reference tuzağı [[rsc-client-module-data-export]] burada yaşanmaz).
import { AYDINLATMA_MD } from "./texts/aydinlatma";
import { KOSULLAR_MD } from "./texts/kosullar";
import { CEREZ_MD } from "./texts/cerez";
import { ICERIK_POLITIKASI_MD } from "./texts/icerik-politikasi";
import { KVKK_BASVURU_MD } from "./texts/kvkk-basvuru";

export const DOCTORIUM_LEGAL_VERSION = "1.2";
export const DOCTORIUM_LEGAL_DATE = "2026-09-05";
export const DOCTORIUM_LEGAL_DATE_TR = "5 Eylül 2026";
/** Tüzel kişilik kurulana dek metinlerde kullanılan işletici ifadesi (👤 karar 03.09.2026). */
export const DOCTORIUM_OPERATOR_LABEL = "Doctorium platform işleticisi";
export const DOCTORIUM_LEGAL_CONTACT = "bilgi@doctorium.tr";

export type LegalSlug = "aydinlatma" | "kosullar" | "cerez" | "icerik-politikasi" | "kvkk-basvuru";

export interface LegalDoc {
  slug: LegalSlug;
  /** Rota — `/doctorium/<slug>` (Doctorium deploy'unda kanonik; AURA host'unda da servis edilir, canonical doctorium.tr). */
  path: `/doctorium/${LegalSlug}`;
  /** Sayfa başlığı (sekme: "<title> · Doctorium"). */
  title: string;
  /** Footer / belge gezinmesi kısa adı. */
  navTitle: string;
  description: string;
  /** Kaynak belge numarası (vault seti) — izlenebilirlik. */
  source: string;
  /** Markdown gövde — lib/doctorium-legal/markdown.ts alt kümesi. */
  body: string;
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  {
    slug: "aydinlatma",
    path: "/doctorium/aydinlatma",
    title: "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni",
    navTitle: "Aydınlatma Metni",
    description:
      "Doctorium üyeliğinde hangi kişisel verilerin, hangi amaçla ve hangi hukuki sebeple işlendiği; aktarım, saklama süreleri ve KVKK m.11 hakları.",
    source: "01-kvkk-aydinlatma-metni",
    body: AYDINLATMA_MD,
  },
  {
    slug: "kosullar",
    path: "/doctorium/kosullar",
    title: "Üyelik Sözleşmesi ve Kullanım Koşulları",
    navTitle: "Üyelik Sözleşmesi",
    description:
      "Doctorium üyeliğinin şartları: doğrulama, hizmetin niteliği ve sınırları, üyenin yükümlülükleri, sponsorlu içerik, puan programı, fikri mülkiyet, askıya alma ve fesih.",
    source: "02-uyelik-sozlesmesi-kullanim-kosullari",
    body: KOSULLAR_MD,
  },
  {
    slug: "cerez",
    path: "/doctorium/cerez",
    title: "Çerez Politikası",
    navTitle: "Çerez Politikası",
    description: "Doctorium'da kullanılan iki işlevsel çerez, çerezsiz ölçüm ve tarayıcı ayarları; rıza penceresi neden yok.",
    source: "03-cerez-politikasi",
    body: CEREZ_MD,
  },
  {
    slug: "icerik-politikasi",
    path: "/doctorium/icerik-politikasi",
    title: "İçerik Kaynak ve Telif Politikası",
    navTitle: "İçerik ve Telif",
    description:
      "Doctorium içeriğinin kaynağı ve dayanağı: özet + kaynak bağlantısı modeli, içtihat, doktrin, haber, mevzuat, ürün bilgisi; bildirim ve kaldırma kanalı.",
    source: "04-icerik-kaynak-telif-politikasi",
    body: ICERIK_POLITIKASI_MD,
  },
  {
    slug: "kvkk-basvuru",
    path: "/doctorium/kvkk-basvuru",
    title: "İlgili Kişi Başvuru Usul ve Esasları",
    navTitle: "KVKK Başvurusu",
    description: "KVKK m.11 kapsamındaki haklarınızı nasıl kullanırsınız: başvuru kanalları, gerekli bilgiler, cevap süresi ve Kurul'a şikâyet.",
    source: "06-veri-sahibi-basvuru-usul-esaslari",
    body: KVKK_BASVURU_MD,
  },
];

export function legalDoc(slug: string): LegalDoc | null {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
}

/** Footer ve belge gezinmesi bağlantıları (sıra = LEGAL_DOCS). */
export const LEGAL_LINKS: readonly { href: string; label: string }[] = LEGAL_DOCS.map((d) => ({ href: d.path, label: d.navTitle }));

/** Rota listesi — chrome-routes.ts CHROME_FREE_ROUTES bu beşini içermek ZORUNDADIR (birim test sözleşmesi). */
export const LEGAL_PATHS: readonly string[] = LEGAL_DOCS.map((d) => d.path);
