// Ön-konsültasyon ücret kapısı (Modül 1) — saf yardımcılar
// NOT: Ödeme SİMÜLEdir (gerçek Iyzico/Stripe API anahtarı gerektirir).
// Sigortayla ödeme yolu 2026-08-05'te kaldırıldı (anlaşmalı sigorta şirketi yok) — DB'de
// tarihsel INSURED/policyNo kayıtları durabilir; okuma yolları düz string karşılaştırır.

export const CONSULT_FEE_USD = 60; // Tier 1 ön değerlendirme görüşme ücreti
export const CONSULT_DURATION_TEXT = "15–25 dk"; // ortalama görüşme süresi

export type PayStatus = "PENDING" | "PAID";
export type PayMethod = "PAYMENT";

export interface Billing {
  status: PayStatus;
  method: PayMethod;
  fee: number;
  payRef?: string;
}

// Simüle ödeme referansı üretir (gerçek ödeme geçidi yerine)
export function simulatePaymentRef(): string {
  return "SIM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}
