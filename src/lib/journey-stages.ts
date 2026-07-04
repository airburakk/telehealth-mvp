// Yeknesak 6-sahne modeli — 4 hasta yolunun ortak iskeleti.
// Detay: vault output/hasta-akisi-yeknesak-diyagram.md. Etiketler TR kanonik; JourneyStageRail
// bunları useT ile hasta diline çevirir. İntake ekranları "Ön Bilgi" (index 1) sahnesindedir.
export type JourneyKey = "GENERAL" | "SECOND_OPINION" | "HEALTH_TOURISM" | "FREE_CARE";

export const JOURNEY_STAGES = [
  "Seçim", "Ön Bilgi", "Onay & Ödeme", "Eşleşme", "Görüşme", "Sonuç & Takip",
] as const;

// Yola göre geçerli OLMAYAN (N/A) sahneler — turizm & ücretsiz ayrı ödeme kapısı içermez
// (klinik-önce / gönüllü). Rail bunları soluk + üstü çizili gösterir.
export const JOURNEY_SKIP_STAGES: Record<JourneyKey, readonly number[]> = {
  GENERAL: [],
  SECOND_OPINION: [],
  HEALTH_TOURISM: [2],
  FREE_CARE: [2],
};

// İntake ekranlarının bulunduğu sahne (0-index: Seçim=0, Ön Bilgi=1).
export const INTAKE_STAGE = 1;
