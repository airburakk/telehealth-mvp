// M5 — Doktor Ana Sayfası pencere görünürlük kararı (tek kaynak).
// Ana Sayfa UI'si ve onboarding kapısı bu yardımcıları ortak kullanır ki kurallar tek yerde dursun.
//
// 5 pencere (Haberler 2026-07-31'de pencerelikten çıktı → üst bant linki + /doktor/haberler sayfası):
//   1) Klinik Nöbet      — HER doktorda (her zaman; onboarding'de "Uzaktan Sağlık Paneli" adıyla anlatılır)
//   2) İkinci Görüş (SO)  — Prof./Doç. ünvanı VE soOptIn (v6.105: ünvan kapısına tercih EKLENDİ)
//   3) Ücretsiz Sağlık Hizmeti          — yalnız freeCareOptIn=true (onboarding'de seçilir; sonra /doktor/profil'den açılabilir)
//   4) Konsültasyon Tal. — yalnız consultOptIn=true (Partner doktordan gelen anonim talepler; yanıt başına ödeme)
//   5) Sağlık Turizmi    — yalnız tourismOptIn=true (v6.105: önce KOŞULSUZ açıktı — kullanıcı kararı
//                          2026-08-17 ile tercihe bağlandı; migration mevcut doktorları true damgalar):
//                          kendi branş havuzuna düşen sağlık turizmi talepleri; doktor tanıtım mesajı +
//                          video randevu teklifi gönderir (2026-07-14)

// İkinci Görüş ünvan kapısı: yalnız doçent/profesör.
// Doctor.title değerleri: "Prof. Dr." | "Doç. Dr." | "Op. Dr." | "Uzm. Dr."
export function soEligible(title: string | null | undefined): boolean {
  if (!title) return false;
  return /^(prof\.|doç\.|doc\.)/i.test(title.trim());
}

export interface DoctorPanelFields {
  title: string | null;
  freeCareOptIn: boolean;
  consultOptIn: boolean;
  // v6.105 — ZORUNLU alanlar (deletionLockedAt/CaseRef deseni, kasıtlı): çağıran select'ine
  // eklemeyi unutursa DERLEME kırılır. Aksi hâlde kapı sessizce "kapalı" karar verip doktorun
  // havuzunu düşürürdü — panel görünürlüğü sessiz yanlışa tahammül etmez.
  soOptIn: boolean;
  tourismOptIn: boolean;
}

export interface PanelVisibility {
  duty: true; // her zaman — Uzaktan Sağlık doktorun ana kulvarıdır, kapatılamaz
  so: boolean; // ünvan kapısı VE opt-in (ikisi birlikte)
  freeCare: boolean; // opt-in
  consult: boolean; // opt-in
  tourism: boolean; // opt-in (v6.105 öncesi koşulsuz açıktı)
}

// Doktorun Ana Sayfa pencerelerinin görünürlüğü. duty daima açık; diğer dördü tercihe bağlı.
// ⚠️ so'da İKİ şart BİRLİKTE aranır: ünvanı uygun olmayan doktorun soOptIn'i true olsa bile panel
// AÇILMAZ. Migration mevcut satırların hepsini true damgaladığı için gerçek kapı soEligible'dır.
export function panelVisibility(doc: DoctorPanelFields): PanelVisibility {
  return {
    duty: true,
    so: soEligible(doc.title) && !!doc.soOptIn,
    freeCare: !!doc.freeCareOptIn,
    consult: !!doc.consultOptIn,
    tourism: !!doc.tourismOptIn,
  };
}
