// M5 — Doktor Ana Sayfası pencere görünürlük kararı (tek kaynak).
// Ana Sayfa UI'si ve onboarding kapısı bu yardımcıları ortak kullanır ki kurallar tek yerde dursun.
//
// 5 pencere:
//   1) Klinik Nöbet      — HER doktorda (her zaman)
//   2) İkinci Görüş (SO)  — yalnız Prof./Doç. ünvanlı doktorda (opt-in YOK, ünvan kapısı)
//   3) Pro Bono          — yalnız proBonoOptIn=true (onboarding'de seçilir; sonra /doktor/profil'den açılabilir)
//   4) Konsültasyon Tal. — yalnız consultOptIn=true (Partner doktordan gelen anonim talepler; yanıt başına ödeme)
//   5) Haberler          — HER doktorda (her zaman)

// İkinci Görüş ünvan kapısı: yalnız doçent/profesör.
// Doctor.title değerleri: "Prof. Dr." | "Doç. Dr." | "Op. Dr." | "Uzm. Dr."
export function soEligible(title: string | null | undefined): boolean {
  if (!title) return false;
  return /^(prof\.|doç\.|doc\.)/i.test(title.trim());
}

export interface DoctorPanelFields {
  title: string | null;
  proBonoOptIn: boolean;
  consultOptIn: boolean;
}

export interface PanelVisibility {
  duty: true; // her zaman
  so: boolean; // ünvan kapısı
  proBono: boolean; // opt-in
  consult: boolean; // opt-in
  news: true; // her zaman
}

// Doktorun Ana Sayfa pencerelerinin görünürlüğü. duty + news her zaman; so ünvana, proBono/consult opt-in'e bağlı.
export function panelVisibility(doc: DoctorPanelFields): PanelVisibility {
  return {
    duty: true,
    so: soEligible(doc.title),
    proBono: !!doc.proBonoOptIn,
    consult: !!doc.consultOptIn,
    news: true,
  };
}
