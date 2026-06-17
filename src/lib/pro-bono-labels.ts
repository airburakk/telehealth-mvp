// Pro Bono etiketleri — SAF sabitler (sunucu + istemci ortak).
// Hiçbir sunucu-yalnız modül (notify/push/db) import etmez → client bundle'a güvenle girer.

// Pro bono vaka durum makinesi (Case.proBonoStatus). Faz 2 etik onayına kadar.
export const PRO_BONO_STATES: Record<string, string> = {
  WAITING: "Eşleşme bekliyor",
  MATCHED: "Eşleşti",
  IN_CONSULT: "Görüşmede",
  CONSULT_DONE: "Görüşme tamamlandı",
  TREATMENT_NEEDED: "Tedavi gerekiyor",
  ETHICS_REVIEW: "Etik kurul incelemesinde",
  ETHICS_REJECTED: "Etik kurul reddetti",
  ETHICS_APPROVED: "Tedaviye uygun bulundu",
  COMPLETED: "Tamamlandı",
};

// Hekimin anlık müsaitlik durumu (Doctor.proBonoState)
export const DOCTOR_PB_STATES: Record<string, string> = {
  OFFLINE: "Çevrimdışı",
  AVAILABLE: "Müsait",
  IN_SESSION: "Görüşmede",
};
