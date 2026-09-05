// TUS modülü — VERİ İSKELETİ (üç katman Faz B1, kullanıcı kararı 2026-09-05; rapor "Öğrenci Modülü ve Büyüme Yol
// Haritası" §3). SAF modül.
//
// İDDİA DÜRÜSTLÜĞÜ (vitrin kuralının iç yüzey karşılığı): sahte dashboard / uydurma tarih / temsilî sayı YOK. Bu dosya
// yalnız TİP + BOŞ veri + resmî kaynak bağlantıları taşır; sayfa (app/doktor/doctorium/tus) veri yokken açıkça
// "hazırlanıyor" der. Gerçek veri hattı (ÖSYM toplayıcı → ayrıştırıcı → doğrulama + insan onayı → dönem-bazlı snapshot
// → grafikler) AYRI plandır (plan "Sonraki planlar"); o gün TusExamPeriod/TusQuota/TusPlacementStat Prisma modelleri gelir
// ve `approvedAt` olmayan satır asla gösterilmez.
//
// Bu diziye satır eklerken KAYNAK (sourceUrl) ve doğrulama günü (verifiedAt) ZORUNLUDUR — kaynaksız tarih girilmez.
export interface TusExamPeriod {
  year: number;
  /** 1 = ilkbahar (Mart), 2 = sonbahar (Ağustos) dönemi. */
  term: 1 | 2;
  /** ISO gün ("2026-03-15") — ÖSYM takviminden birebir; bilinmiyorsa null. */
  examDate: string | null;
  resultDate: string | null;
  sourceUrl: string;
  /** Satırı kaynaktan doğrulayan kişinin işaretlediği gün (ISO). */
  verifiedAt: string;
}

/** İnsan girişli dönem tablosu — BOŞ başlar (sahte tarih yok). */
export const TUS_EXAM_PERIODS: readonly TusExamPeriod[] = [];

/** Resmî kaynaklar — yalnız kurumun kendi kök adresleri (derin bağlantı uydurulmaz; sayfa yapısı değişebilir). */
export const TUS_OFFICIAL_LINKS: readonly { label: string; href: string; note: string }[] = [
  { label: "ÖSYM", href: "https://www.osym.gov.tr", note: "Sınav takvimi, kılavuzlar, çıkmış sorular ve yerleştirme sonuçlarının resmî kaynağı." },
  { label: "ÖSYM Aday İşlemleri Sistemi", href: "https://ais.osym.gov.tr", note: "Başvuru, tercih ve sonuç işlemleri." },
];
