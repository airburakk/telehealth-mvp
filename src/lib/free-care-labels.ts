// Ücretsiz Sağlık Hizmeti etiketleri — SAF sabitler (sunucu + istemci ortak).
// Hiçbir sunucu-yalnız modül (notify/push/db) import etmez → client bundle'a güvenle girer.

// Ücretsiz sağlık hizmeti vaka durum makinesi (Case.freeCareStatus). Faz 2 etik onayına kadar.
export const FREE_CARE_STATES: Record<string, string> = {
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

// Doktorun anlık müsaitlik durumu (Doctor.freeCareState)
export const DOCTOR_FC_STATES: Record<string, string> = {
  OFFLINE: "Çevrimdışı",
  AVAILABLE: "Müsait",
  IN_SESSION: "Görüşmede",
};
