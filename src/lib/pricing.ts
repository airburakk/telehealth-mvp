// Sağlık Turizmi Paketi — dinamik fiyatlandırma (Modül 3)
// İstemci ve sunucu tarafında ortak kullanılır (saf TS, yan etki yok).

export type Tier = "Ekonomik" | "Standart" | "Premium";
export type HospitalType = "Özel" | "Üniversite";

export interface PackageSelection {
  branch: string;
  country: string;
  tier: Tier;
  hotelStars: 4 | 5;
  hospitalType: HospitalType;
  nights: number;
  translator: boolean;
  insuranceExtended: boolean;
  insuranceMalpractice: boolean;
}

// Tedavi taban fiyatları (USD) — branş etiketine göre
const TREATMENT_BASE: Record<string, number> = {
  "Onkoloji": 12000,
  "Kardiyoloji": 9000,
  "Nöroşirürji": 11000,
  "Ortopedi": 8000,
  "Genel Cerrahi": 6000,
  "Tüp Bebek": 5000,
  "Estetik": 4000,
  "Diş": 3000,
  "Göz": 2500,
  "Saç Ekimi": 2000,
  "Dahiliye": 1500,
};

const HOSPITAL_MULT: Record<HospitalType, number> = { "Özel": 1.0, "Üniversite": 1.15 };
const HOTEL_PER_NIGHT: Record<number, number> = { 4: 80, 5: 150 };
const TRANSFER_BY_TIER: Record<Tier, number> = { Ekonomik: 0, Standart: 90, Premium: 220 };
const FLIGHT_BY_COUNTRY: Record<string, number> = { DZ: 480, LY: 520, RU: 260, AZ: 240, KZ: 420, KG: 460, TR: 90 };
const TRANSLATOR_PRICE = 250;
const INSURANCE_BASE = 120; // zorunlu
const INSURANCE_EXTENDED = 320;
const INSURANCE_MALPRACTICE = 480;
const PLATFORM_FEE_RATE = 0.15;

export const TIER_PRESETS: Record<Tier, Partial<PackageSelection>> = {
  Ekonomik: { hotelStars: 4, hospitalType: "Özel", translator: false, insuranceExtended: false, insuranceMalpractice: false },
  Standart: { hotelStars: 4, hospitalType: "Özel", translator: false, insuranceExtended: true, insuranceMalpractice: false },
  Premium: { hotelStars: 5, hospitalType: "Üniversite", translator: true, insuranceExtended: true, insuranceMalpractice: true },
};

function treatmentBase(branch: string): number {
  const key = Object.keys(TREATMENT_BASE).find((k) => branch.includes(k));
  return key ? TREATMENT_BASE[key] : 4000;
}

export interface LineItem { key: string; label: string; amount: number; note?: string }
export interface PackageQuote {
  items: LineItem[];
  subtotal: number;
  platformFee: number;
  total: number;
  currency: "USD";
  split: LineItem[];
}

export function computePackage(s: PackageSelection): PackageQuote {
  const treatment = Math.round(treatmentBase(s.branch) * (HOSPITAL_MULT[s.hospitalType] ?? 1));
  const hotel = (HOTEL_PER_NIGHT[s.hotelStars] ?? 80) * s.nights;
  const flight = FLIGHT_BY_COUNTRY[s.country] ?? 400;
  const transfer = TRANSFER_BY_TIER[s.tier] ?? 0;
  const translator = s.translator ? TRANSLATOR_PRICE : 0;
  const insurance = INSURANCE_BASE + (s.insuranceExtended ? INSURANCE_EXTENDED : 0) + (s.insuranceMalpractice ? INSURANCE_MALPRACTICE : 0);

  const items: LineItem[] = [
    { key: "treatment", label: `Tedavi · ${s.branch}`, amount: treatment, note: `${s.hospitalType} hastane` },
    { key: "hotel", label: `Konaklama · ${s.hotelStars}★ otel`, amount: hotel, note: `${s.nights} gece` },
    { key: "flight", label: "Uçak bileti (gidiş-dönüş)", amount: flight },
    { key: "transfer", label: "Şehir içi transfer", amount: transfer, note: s.tier },
  ];
  if (translator) items.push({ key: "translator", label: "Tıbbi tercüman", amount: translator });
  items.push({
    key: "insurance",
    label: "Sigorta",
    amount: insurance,
    note: ["Zorunlu", s.insuranceExtended ? "Genişletilmiş" : null, s.insuranceMalpractice ? "Malpraktis" : null].filter(Boolean).join(" + "),
  });

  const subtotal = items.reduce((a, b) => a + b.amount, 0);
  const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE);
  const total = subtotal + platformFee;

  const split: LineItem[] = [
    { key: "hospital", label: "Hastane / klinik", amount: treatment },
    { key: "hotel", label: "Otel", amount: hotel },
    { key: "airline", label: "Havayolu", amount: flight },
    { key: "transfer", label: "Transfer firması", amount: transfer },
    ...(translator ? [{ key: "translator", label: "Tercüman", amount: translator }] : []),
    { key: "insurer", label: "Sigorta şirketi", amount: insurance },
    { key: "platform", label: "Platform komisyonu (Escrow)", amount: platformFee },
  ].filter((x) => x.amount > 0);

  return { items, subtotal, platformFee, total, currency: "USD", split };
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
