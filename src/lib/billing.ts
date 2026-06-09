// Ön-konsültasyon ücret & sigorta kapısı (Modül 1) — saf yardımcılar
// NOT: Ödeme SİMÜLEdir (gerçek Iyzico/Stripe API anahtarı gerektirir) ve poliçe
// doğrulaması STUB'tır (gerçek sigorta entegrasyonu üretim sürümünde eklenecek).

export const CONSULT_FEE_USD = 60; // Tier 1 ön değerlendirme görüşme ücreti
export const CONSULT_DURATION_TEXT = "15–25 dk"; // ortalama görüşme süresi

export type PayStatus = "PENDING" | "PAID" | "INSURED";
export type PayMethod = "PAYMENT" | "INSURANCE";

export interface Billing {
  status: PayStatus;
  method: PayMethod;
  fee: number;
  policyNo?: string;
  payRef?: string;
  insurer?: string;
}

export interface PolicyCheck {
  covered: boolean;
  insurer?: string;
  message: string;
}

const INSURERS = ["Allianz", "AXA Sigorta", "Anadolu Sigorta", "Mapfre", "Gulf Insurance"];

// Demo poliçe doğrulama: geçerli formatta (≥6 karakter) poliçe kapsamlı kabul edilir.
// Gerçek sürümde sigorta şirketi API'siyle değiştirilecek.
export function verifyPolicy(policyNoRaw: string): PolicyCheck {
  const p = (policyNoRaw || "").replace(/\s+/g, "");
  if (p.length < 6) {
    return { covered: false, message: "Poliçe numarası geçersiz görünüyor (en az 6 karakter olmalı)." };
  }
  const insurer = INSURERS[p.length % INSURERS.length];
  return { covered: true, insurer, message: `${insurer} poliçeniz bu görüşmeyi kapsıyor.` };
}

// Simüle ödeme referansı üretir (gerçek ödeme geçidi yerine)
export function simulatePaymentRef(): string {
  return "SIM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}
