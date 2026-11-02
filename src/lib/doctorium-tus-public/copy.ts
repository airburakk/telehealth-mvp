// Herkese açık TUS taban puanları sayfası (doctorium.tr/tus) — TÜM görünür metin TEK YERDE (v6.358, 2026-10-29).
// 👤 onaylı metin: vault output/doctorium-tus-herkese-acik-sayfa-taslak-2026-10-29.md §4 ("Önerilerle uygula", 29.10).
// Neden ayrı modül: vitrin iddia disiplini — görünür metin + metadata + JSON-LD aynı kurala tabidir; metin burada durunca birim test
// (tests/unit/doctorium-tus-public.test.ts) yasak ifadeleri TARAYABİLİR.
// Kural özeti (TUS kuralı + vitrin): tahmin/simülasyon/tavsiye YOK · "AI" YOK · "resmî/en güncel/en doğru" YOK (resmî olan ÖSYM'dir,
// biz aktarıcıyız) · "hekim" YOK (terim kuralı). 🔴 İstisna: branş adları ÖSYM verisidir ("Aile Hekimliği") — bu dosyada DEĞİL,
// summary.json'da yaşar ve taramaya girmez.
export const TUS_PUBLIC_COPY = {
  /** <title> — segment şablonu (" · Doctorium") ezilir: başlık kendi markasını taşır (onaylı metin). */
  metaTitle: "TUS Taban Puanları ve Kontenjanları — ÖSYM Verisi · Doctorium",
  metaDescription:
    "2021'den bu yana her TUS döneminde uzmanlık dallarının kontenjan, yerleşen, boş kalan ve en küçük–en büyük yerleştirme puanları. Kaynak: ÖSYM yerleştirme tabloları.",
  ogTitle: "TUS Taban Puanları ve Kontenjanları · Doctorium",
  mastheadLabel: "TUS · ÖSYM yerleştirme verisi",
  h1: "TUS taban puanları ve kontenjanları",
  lead:
    "ÖSYM'nin her dönem yayımladığı yerleştirme tablolarını uzmanlık dalına göre bir araya getirdik. Her sayının kaynağı aşağıda bağlantılıdır; tahmin veya tercih önerisi içermez.",
  warning: "Geçmiş dönem verisidir; tercih tavsiyesi veya gelecek dönem puan tahmini değildir.",
  periodPickerLabel: "Dönem",
  tableHeading: "Uzmanlık dalına göre",
  tableCaption: (period: string) => `${period} · GENEL kontenjan · uzmanlık dalına göre, kontenjana göre sıralı`,
  columns: {
    branch: "Uzmanlık dalı",
    quota: "Kontenjan",
    placed: "Yerleşen",
    vacant: "Boş",
    minScore: "En küçük puan",
    medianMinScore: "Medyan en küçük",
    maxScore: "En büyük puan",
    programs: "Program",
  },
  tableNote:
    "En küçük puan: o dalda yerleşen olan programların en küçük puanlarının en düşüğü. Medyan en küçük: aynı programların en küçük puanlarının ortancası. Yerleşen olmayan programlar puan hesabına girmez. Puanlar iki ondalığa yuvarlanmıştır; tam değer kaynak tablodadır.",
  trendHeading: "Son üç dönem · en küçük puan",
  trendNote: "Aynı ölçünün (en küçük puan) seçili dönem ve ondan önceki iki dönemdeki değerleri. Yorum ya da eğilim çıkarımı içermez.",
  noValue: "—",
  sourceHeading: "Kaynak ve yöntem",
  sourceBody:
    "Sayılar ÖSYM'nin \"En Küçük ve En Büyük Puanlar\" yerleştirme tablolarından aktarılmıştır. Toplamlar GENEL kontenjanı kapsar; yabancı uyruklu kontenjan ve ek yerleştirme dahil değildir.",
  sourceLinkLabel: (period: string) => `${period} ÖSYM sayısal bilgiler sayfası (yeni sekme)`,
  cta: {
    body: "Kurum bazında süzgeç, ek yerleştirme ve sınav takvimi Doctorium üyelerine açık.",
    student: "Öğrenci kaydı",
    doctor: "Doktor kaydı",
  },
  join: "Katılın",
  empty: {
    title: "Yerleştirme verisi hazırlanıyor.",
    body: "ÖSYM tabloları doğrulanıp onaylandığında burada görünür.",
  },
  /** JSON-LD Dataset — iddia disiplini görünür metinle aynı. */
  datasetName: "TUS yerleştirme puanları ve kontenjanları (ÖSYM verisi)",
  datasetDescription:
    "Tıpta Uzmanlık Sınavı (TUS) dönemlerinde uzmanlık dallarına göre GENEL kontenjan, yerleşen, boş kalan ve en küçük–en büyük yerleştirme puanları. ÖSYM yerleştirme tablolarından aktarılmıştır.",
} as const;

/** Sayfada görünen veya metadata/JSON-LD'ye giden TÜM düz metinler (test: yasak ifade taraması). */
export function tusPublicAllText(): string {
  const c = TUS_PUBLIC_COPY;
  return [
    c.metaTitle, c.metaDescription, c.ogTitle, c.mastheadLabel, c.h1, c.lead, c.warning, c.periodPickerLabel,
    c.tableHeading, c.tableCaption("2026-TUS 1. Dönem"), ...Object.values(c.columns), c.tableNote, c.trendHeading, c.trendNote,
    c.sourceHeading, c.sourceBody, c.sourceLinkLabel("2026-TUS 1. Dönem"), c.cta.body, c.cta.student, c.cta.doctor, c.join,
    c.empty.title, c.empty.body, c.datasetName, c.datasetDescription,
  ].join("\n");
}
