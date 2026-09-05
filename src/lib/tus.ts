// TUS modülü — DÖNEM TABLOSU (üç katman Faz B1 iskeleti → T1 verisi 2026-09-05; rapor "Öğrenci Modülü ve Büyüme Yol
// Haritası" §3; plan output/doctorium-veri-fazlari-plani-2026-09-05.md A.1). SAF modül (db/React yok).
//
// İDDİA DÜRÜSTLÜĞÜ (vitrin kuralının iç yüzey karşılığı): sahte dashboard / uydurma tarih / temsilî sayı YOK. Her satır
// ÖSYM'nin KENDİ duyurusundan (sourceUrl) alınır ve doğrulama günü (verifiedAt) taşır — kaynaksız tarih girilmez.
// Kontenjan / taban puan / grafik / simülatör T2–T3'tedir (Prisma modelleri + insan onayı; approvedAt olmayan satır gösterilmez).
//
// KAYNAK NOTU (2026-09-05): ÖSYM sitesi eski `/TR,<id>/…html` adreslerini 404'a düşürdü; kalıcı adres biçimi slug'dır
// (`osym.gov.tr/2025tus-1-donem-…`). Sınav Takvimi sayfası (`/Sayfa/SinavTakvimi`) yılın tüm dönemlerini tek tabloda verir.
export interface TusExamPeriod {
  year: number;
  /** 1 = ilkbahar (Mart), 2 = sonbahar (Ağustos) dönemi. */
  term: 1 | 2;
  /** Başvuru penceresi (ISO gün; geç başvuru günü dâhil DEĞİL) — eski dönemlerde null (duyurudan çekilmedi). */
  applicationStart: string | null;
  applicationEnd: string | null;
  /** ISO gün ("2026-03-15") — ÖSYM duyurusu/takviminden birebir; bilinmiyorsa null. */
  examDate: string | null;
  resultDate: string | null;
  sourceUrl: string;
  /** Satırı kaynaktan doğrulayan kişinin işaretlediği gün (ISO). */
  verifiedAt: string;
}

const TAKVIM = "https://www.osym.gov.tr/Sayfa/SinavTakvimi";

/** İnsan girişli dönem tablosu — KRONOLOJİK (eski → yeni); görünüm yeniden sıralar. 2026/2 sonucu takvimdeki planlanan gün. */
export const TUS_EXAM_PERIODS: readonly TusExamPeriod[] = [
  { year: 2024, term: 1, applicationStart: null, applicationEnd: null, examDate: "2024-03-17", resultDate: "2024-04-17",
    sourceUrl: "https://www.osym.gov.tr/2024tus-1-donem-ve-2024sts-tip-doktorlugu-1-donem-sinav-sonuclari-aciklandi", verifiedAt: "2026-09-05" },
  { year: 2024, term: 2, applicationStart: null, applicationEnd: null, examDate: "2024-08-18", resultDate: "2024-09-12",
    sourceUrl: "https://www.osym.gov.tr/2024tus-2-donem-ve-2024sts-tip-doktorlugu-2-donem-sinav-sonuclari-aciklandi", verifiedAt: "2026-09-05" },
  { year: 2025, term: 1, applicationStart: null, applicationEnd: null, examDate: "2025-03-23", resultDate: "2025-04-18",
    sourceUrl: "https://www.osym.gov.tr/2025tus-1-donem-ve-2025sts-tip-doktorlugu-1-donem-sinav-sonuclari-aciklandi", verifiedAt: "2026-09-05" },
  { year: 2025, term: 2, applicationStart: null, applicationEnd: null, examDate: "2025-08-17", resultDate: "2025-09-12",
    sourceUrl: "https://www.osym.gov.tr/2025tus-2-donem-ve-2025sts-tip-doktorlugu-2-donem-sinav-sonuclari-aciklandi", verifiedAt: "2026-09-05" },
  { year: 2026, term: 1, applicationStart: "2026-01-28", applicationEnd: "2026-02-05", examDate: "2026-03-15", resultDate: "2026-04-15",
    sourceUrl: TAKVIM, verifiedAt: "2026-09-05" },
  { year: 2026, term: 2, applicationStart: "2026-07-08", applicationEnd: "2026-07-16", examDate: "2026-08-23", resultDate: "2026-09-17",
    sourceUrl: TAKVIM, verifiedAt: "2026-09-05" },
];

/** Resmî kaynaklar — yalnız kurumun kendi kök adresleri (derin bağlantı uydurulmaz; sayfa yapısı değişebilir). */
export const TUS_OFFICIAL_LINKS: readonly { label: string; href: string; note: string }[] = [
  { label: "ÖSYM", href: "https://www.osym.gov.tr", note: "Sınav takvimi, kılavuzlar, çıkmış sorular ve yerleştirme sonuçlarının resmî kaynağı." },
  { label: "ÖSYM Aday İşlemleri Sistemi", href: "https://ais.osym.gov.tr", note: "Başvuru, tercih ve sonuç işlemleri." },
];

/** Takvim öğesi (lib/calendar CalendarItem ile yapısal uyumlu; kind "tus"). Döngüsel import olmasın diye tip burada. */
export interface TusCalendarItem { key: string; kind: "tus"; title: string; href: string; start: string; end: string }

export const TUS_HREF = "/doktor/doctorium/tus";

/** [startKey, endKey) ISO gün penceresiyle kesişen TUS başvuru/sınav/sonuç öğeleri (Takvim: öğrencide daima, doktorda showTus). */
export function tusCalendarItems(startKey: string, endKey: string): TusCalendarItem[] {
  const out: TusCalendarItem[] = [];
  const hit = (a: string, b: string) => a < endKey && b >= startKey;
  for (const p of TUS_EXAM_PERIODS) {
    const label = `${p.year}-TUS ${p.term}. Dönem`;
    if (p.applicationStart && p.applicationEnd && hit(p.applicationStart, p.applicationEnd))
      out.push({ key: `tus-${p.year}-${p.term}-basvuru`, kind: "tus", title: `${label} başvuru`, href: TUS_HREF, start: p.applicationStart, end: p.applicationEnd });
    if (p.examDate && hit(p.examDate, p.examDate))
      out.push({ key: `tus-${p.year}-${p.term}-sinav`, kind: "tus", title: `${label} sınavı`, href: TUS_HREF, start: p.examDate, end: p.examDate });
    if (p.resultDate && hit(p.resultDate, p.resultDate))
      out.push({ key: `tus-${p.year}-${p.term}-sonuc`, kind: "tus", title: `${label} sonuç`, href: TUS_HREF, start: p.resultDate, end: p.resultDate });
  }
  return out;
}
