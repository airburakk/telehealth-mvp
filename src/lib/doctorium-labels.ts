// Doctorium içerik künyesi — İSTEMCİ-GÜVENLİ etiket sabitleri (2026-08-21).
//
// lib/doctorium.ts `db` (Prisma) içe aktaran bir SUNUCU modülüdür. SECTOR_CATEGORIES/
// categoryLabel/KIND_LABEL saf veri olduğu hâlde o dosyada yaşıyordu; sonsuz kaydırma "daha
// fazla yükle" istemci bileşeni (FeedLoadMore.tsx → ArticleCard.tsx) bu etiketlere ihtiyaç
// duyunca, lib/doctorium.ts'ten DEĞER import etmek db'yi (ve crypto/ai-clinical/doctorium-sources
// zincirini) istemci paketine sokup build'i kırardı. Bu üç sabit tek gerçek kaynak olarak
// buraya taşındı; lib/doctorium.ts aynı adlarla RE-EXPORT eder (davranış değişmez, mevcut
// `@/lib/doctorium` import'ları kırılmaz).
export const SECTOR_CATEGORIES: { key: string; label: string }[] = [
  { key: "meslek", label: "Doktorluk & Mesleki Gündem" },
  { key: "mevzuat", label: "Mevzuat & Sağlık Hukuku" },
  { key: "sut", label: "SGK · SUT & Geri Ödeme" },
  { key: "turizm", label: "Sağlık Turizmi & Teşvikler" },
  { key: "yonetim", label: "Hastane & Klinik Yönetimi" },
  { key: "teknoloji", label: "Sağlık Teknolojileri" },
  { key: "ilac-cihaz", label: "İlaç & Tıbbi Cihaz" },
  { key: "kuresel", label: "Küresel Sağlık Gündemi" },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(SECTOR_CATEGORIES.map((c) => [c.key, c.label]));
export function categoryLabel(k: string | null | undefined): string | null {
  return k ? CAT_LABEL[k] ?? null : null;
}

export const KIND_LABEL: Record<string, string> = {
  makale: "Makale",
  ilac: "Klinik Çalışma",
  mevzuat: "Mevzuat",
  haber: "Haber",
  uyari: "Geri Çekme",
  lansman: "Klinik Faz",
  ictihat: "İçtihat", // v6.86 — Yargıtay kararları (source: yargitay, lib/hukuk-ingest.ts)
  doktrin: "Doktrin", // v6.91 — TR-Dizin hakemli makaleler (source: trdizin, lib/doktrin-ingest.ts)
  etkinlik: "Etkinlik", // 2026-08-14 kongre olarak eklendi, v6.120'de tüm etkinlik türlerine açıldı
  kariyer: "Süreç Rehberi", // 2026-08-14 — akış kartı olarak yeni eklenen kariyer kayıtları
};
