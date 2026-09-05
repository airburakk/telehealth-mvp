// Kariyer EDU — staj / değişim / burs FIRSAT TAKVİMİ veri iskeleti (üç katman Faz B1, 2026-09-05; rapor §7). SAF modül.
//
// Ürün formu Etkinlik (kongre) modülünün öğrenci karşılığıdır: takvim + son başvuru geri sayımı + süzgeç (yurt içi/dışı ·
// sınıf · dil şartı · ücretli/burslu) + hatırlatma + resmî kaynağa bağlantı. ⚖️ İLAN DEĞİL, SÜREÇ BİLGİSİ: başvur düğmesi,
// CV gönderimi, işveren eşleştirmesi YOK (İŞKUR özel istihdam bürosu izni sınırı — CareerPathway ile aynı dil).
//
// Veri gerçeği (rapor): ÖSYM gibi tek merkez yok; ilk sürüm ELLE derlenir (TurkMSIC/IFMSA, Erasmus+/Farabi/Mevlana, VSLO,
// fakülteye özel programlar, burslar). Kalıcı model (EduOpportunity + EduOpportunityFollow, calendar.ts kind "edu-son-tarih",
// congress-reminder aynası) AYRI plandır. Bu dosya bugün yalnız TİP + BOŞ dizi taşır — sayfa dürüst "hazırlanıyor" der.
export type EduOpportunityKind = "staj" | "degisim" | "burs";

export const EDU_KIND_LABEL: Record<EduOpportunityKind, string> = {
  staj: "Staj / gözlemcilik",
  degisim: "Değişim programı",
  burs: "Burs",
};

export interface EduOpportunity {
  id: string;
  kind: EduOpportunityKind;
  title: string;
  organizer: string;
  /** ISO ülke kodu ya da "TR"; çok ülkeli programda null. */
  country: string | null;
  /** ISO gün — son başvuru. */
  deadline: string;
  startsAt: string | null;
  /** Şartların KISA özeti (not ortalaması eşiği, dil belgesi, sınıf) — kaynak metin kopyalanmaz. */
  eligibility: string;
  sourceUrl: string;
  /** Doğrulayan kişinin işaretlediği gün (ISO) — kaynaksız/doğrulanmamış satır gösterilmez. */
  verifiedAt: string;
}

/** İnsan derlemeli fırsatlar — BOŞ başlar. */
export const EDU_OPPORTUNITIES: readonly EduOpportunity[] = [];
