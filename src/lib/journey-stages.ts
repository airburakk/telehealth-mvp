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
// - HEALTH_TOURISM / FREE_CARE: ödeme kapısı yok (klinik-önce / gönüllü) — sahne N/A
//   olarak kalır ki rail "ödeme yok" mesajını soluk + üstü çizili verebilsin.
export const JOURNEY_STAGES: Record<JourneyKey, readonly string[]> = {
  GENERAL: ["Onay & Ödeme", "Ön Bilgi", "Eşleşme", "Görüşme", "Sonuç & Takip"],
  SECOND_OPINION: ["Başvuru & Ödeme", "Eşleşme", "Görüşme", "Sonuç & Takip"],
  HEALTH_TOURISM: ["Ön Bilgi", "Onay & Ödeme", "Eşleşme", "Görüşme", "Sonuç & Takip"],
  FREE_CARE: ["Ön Bilgi", "Onay & Ödeme", "Eşleşme", "Görüşme", "Sonuç & Takip"],
};

// Yola göre geçerli OLMAYAN (N/A) sahne indeksleri — rail soluk + üstü çizili gösterir.
export const JOURNEY_SKIP_STAGES: Record<JourneyKey, readonly number[]> = {
  GENERAL: [],
  SECOND_OPINION: [],
  HEALTH_TOURISM: [1],
  FREE_CARE: [1],
};
