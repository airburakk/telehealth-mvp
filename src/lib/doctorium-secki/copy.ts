// "Günlük Seçki" sayfası (doctorium.tr/secki) — TÜM görünür metin TEK YERDE (v6.315, 2026-10-02).
// Neden ayrı modül: vitrin iddia disiplini (lib README "Vitrin iddia dürüstlüğü") — görünür metin + metadata aynı kurala tabidir;
// metinler burada durunca birim test (tests/unit/doctorium-secki.test.ts) yasak ifadeleri TARAYABİLİR.
// Kural özeti: yok → "ücretsiz" (literal ücret vitrinde YASAK), "akredite", "uçtan uca", ölçülmemiş hız/oran, "hekim" (terim kuralı).
// Platform tanımı = kullanıcı-onaylı mevcut cümleler (X 04.09 + Instagram başlığı): yeni iddia EKLENMEZ.
export const SECKI_COPY = {
  /** Sekme başlığı — segment şablonu " · Doctorium" ekler. */
  metaTitle: "Günlük Seçki",
  metaDescription: "Doctorium'un günlük seçkisi: akademik, ilaç & cihaz, sektörel ve mevzuat başlıkları, kaynak bağlantılarıyla.",
  ogTitle: "Günlük Seçki · Doctorium",
  mastheadLabel: "Günlük Seçki",
  h1: "Bugünün başlıkları",
  lead: "Doctorium'un günlük akışından her akıştan bir başlık. Başlıklar kaynağıyla birlikte verilir; tam metin için kaynağa gidin.",
  rotationLabel: "Günün branşı",
  sourceLink: "Kaynağa git",
  empty: {
    title: "Bugünün seçkisi henüz hazır değil.",
    body: "Seçki hazır olunca burada görünür; birkaç dakika sonra tekrar bakın.",
  },
  failed: {
    title: "Seçki şu an yüklenemedi.",
    body: "Birkaç dakika sonra tekrar deneyin.",
  },
  about: {
    heading: "Doctorium",
    body: "Doctorium, e-Devlet doğrulamalı doktorlar ve tıp öğrencilerine özel bir platformdur. Akışınız seçtiğiniz branş ve bölümlere göre kurulur.",
    doctor: "Doktor üyeliği",
    student: "Tıp öğrencisi üyeliği",
    learnMore: "Doctorium'u tanıyın",
  },
  note: "Başlıklar kaynağın yayınından alınır; otomatik olarak Türkçeleştirilmiş olabilir. Esas metin kaynak bağlantısındadır. Doctorium bu içeriklerin yayıncısı değildir.",
  policyLink: "İçerik kaynak ve telif politikası",
  join: "Katılın",
} as const;

/** Sayfada görünen veya metadata'ya giden TÜM düz metinler (test: yasak ifade taraması). */
export function seckiAllText(): string {
  const c = SECKI_COPY;
  return [
    c.metaTitle, c.metaDescription, c.ogTitle, c.mastheadLabel, c.h1, c.lead, c.rotationLabel, c.sourceLink,
    c.empty.title, c.empty.body, c.failed.title, c.failed.body,
    c.about.heading, c.about.body, c.about.doctor, c.about.student, c.about.learnMore,
    c.note, c.policyLink, c.join,
  ].join("\n");
}
