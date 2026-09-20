// Kulvara göre hasta sahne dizileri — v5.8 basitleştirme sonrası (detay: vault
// output/hasta-akisi-basitlestirme-plani-2026-07-12.md; 6-sahne öncülü:
// output/hasta-akisi-yeknesak-diyagram.md). "Seçim" sahnesi kaldırıldı: /basla yol
// seçimi v5.8'de gitti, giriş hunisi doğrudan /triyaj'a iner. Etiketler TR kanonik;
// JourneyStageRail bunları useT ile hasta diline çevirir.
export type JourneyKey = "GENERAL" | "SECOND_OPINION" | "HEALTH_TOURISM" | "FREE_CARE";

// Sıralar ekran gerçeğini izler:
// - GENERAL: ödeme kapısı (PreConsultGate, tek ekran) sihirbazdan ÖNCE gelir →
//   kapı ekranı stage=0, sihirbaz stage=1 (ödeme ✓ görünür, "ücret alındı" bandıyla tutarlı).
// - SECOND_OPINION: belgeler + ödeme başvuruyla aynı oturumda (Faz 3) → tek birleşik sahne.
// - HEALTH_TOURISM: ödeme YOK (klinik-önce; teklif onayı ödemesizdir — 2026-07-23 kullanıcı
//   kararı, escrow katmanı bu kulvardan kaldırıldı) → sahne düz "Onay" olarak GERÇEK adımdır.
// - FREE_CARE: ödeme YOK (gönüllü hizmet) — kontrol raporu H09 (v6.283): eskiden sahne "Onay & Ödeme" adıyla
//   üstü çizili duruyordu ve "tamamen ücretsiz" cümlesiyle çelişiyordu; sahne artık GERÇEK adımdır: başvuru +
//   gönüllü doktor/koordinatör onayı (bekleme sayfası). Kulvara özgü sözlükte "ödeme" kelimesi GEÇMEZ (test kilidi).
export const JOURNEY_STAGES: Record<JourneyKey, readonly string[]> = {
  GENERAL: ["Onay & Ödeme", "Ön Bilgi", "Eşleşme", "Görüşme", "Sonuç & Takip"],
  SECOND_OPINION: ["Başvuru & Ödeme", "Eşleşme", "Görüşme", "Sonuç & Takip"],
  HEALTH_TOURISM: ["Ön Bilgi", "Onay", "Eşleşme", "Görüşme", "Sonuç & Takip"],
  FREE_CARE: ["Ön Bilgi", "Başvuru & Onay", "Eşleşme", "Görüşme", "Sonuç & Takip"],
};

// Yola göre geçerli OLMAYAN (N/A) sahne indeksleri — rail soluk + üstü çizili gösterir. (v6.283: hiçbir kulvarda
// N/A sahne kalmadı; mekanizma ileride gerekirse dursun.)
export const JOURNEY_SKIP_STAGES: Record<JourneyKey, readonly number[]> = {
  GENERAL: [],
  SECOND_OPINION: [],
  HEALTH_TOURISM: [],
  FREE_CARE: [],
};
