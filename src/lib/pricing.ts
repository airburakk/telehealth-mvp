// Sağlık Turizmi Paketi — dinamik fiyatlandırma (Modül 3)
// İstemci ve sunucu tarafında ortak kullanılır (saf TS, yan etki yok).

export type Tier = "Ekonomik" | "Standart" | "Premium";
export type HospitalType = "Özel" | "Üniversite";
// Sigorta seviyesi (kümülatif): 1 = yalnız zorunlu · 2 = + operasyon teminatı · 3 = + malpraktis/komplikasyon
export type InsuranceLevel = 1 | 2 | 3;

export interface PackageSelection {
  branch: string;
  country: string;
  tier: Tier;
  hotelStars: 4 | 5;
  hospitalType: HospitalType;
  nights: number;
  translator: boolean;
  // Sigorta seçimi — kademeli (Seviye 1 zorunlu · 2 operasyon teminatı · 3 + malpraktis/komplikasyon).
  // insuranceLevel verilirse o esastır (3-kademeli UI); verilmezse eski booleanlardan türetilir (AI/geriye uyum).
  insuranceLevel?: InsuranceLevel;
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
const PLATFORM_FEE_RATE = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// Sigorta hesaplama (Modül 3) — 3 kademeli, parametrik. ⚠️ ENDİKATİF/TAHMİNİ: bağlayıcı poliçe
// primini sigortacı belirler. Oranlar sigorta şirketiyle netleşince YALNIZ buradan ayarlanır.
//   Katman 1 (base)   : Zorunlu sağlık turizmi sigortası — sabit.
//   Katman 2 (r2)     : Operasyon teminat poliçesi — prim = toplam paket faturası × r2 × branş riski.
//   Katman 3 (r3)     : Malpraktis & komplikasyon ek teminatı — doktorun mevcut MMSS'inin bıraktığı
//                       boşluğu doldurur: boşluk = max(0, operasyon×targetMultiple − doktor MMSS limiti).
//                       prim = boşluk × r3 × branş riski. (Doktor MMSS'i hedefi karşılıyorsa boşluk 0 → ek prim 0.)
// ─────────────────────────────────────────────────────────────────────────────
export interface InsuranceConfig {
  base: number;          // Katman 1 — zorunlu (USD, sabit)
  r2: number;            // Katman 2 — operasyon teminat prim oranı (placeholder)
  r3: number;            // Katman 3 — malpraktis prim oranı (placeholder)
  targetMultiple: number; // Katman 3 — hedef teminat = operasyon tutarı × bu kat
  branchRisk: Record<string, number>; // branş etiketi substring → cerrahi risk çarpanı (eşleşmeyen = 1.0)
  healthRisk: Record<string, number>; // hasta sağlık-beyanı kalemi → risk çarpanı (çarpımsal birleşir)
  healthRiskCap: number; // birleşik sağlık çarpanı tavanı
}
export const INSURANCE_CONFIG: InsuranceConfig = {
  base: 120,
  r2: 0.025,
  r3: 0.04,
  targetMultiple: 2,
  branchRisk: {
    "Saç": 0.7, "Diş": 0.7,
    "Estetik": 0.9, "Göz": 0.9,
    "Ortopedi": 1.2, "Genel Cerrahi": 1.2,
    "Kardiyoloji": 1.6, "Nöroşirürji": 1.6, "Nöroşirurji": 1.6,
    "Onkoloji": 1.8, "Organ": 1.8, "Nakil": 1.8,
  },
  // Hasta sağlık beyanı çarpanları (sigorta risk formu, 2026-07-20 — kullanıcı onaylı tablo).
  // Anahtarlar: kronik listesi triage-questions "chronic" sözlüğüyle AYNI + beyan boolean'ları
  // (meds/smoking/majorSurgery). Çarpımsal birleşir, healthRiskCap ile tavanlanır; yalnız Katman 2/3
  // primlerine uygulanır (Katman 1 zorunlu taban sabit). Beyansız vaka = 1.0.
  healthRisk: {
    "Tiroid": 1.05, "Tansiyon": 1.10, "Diyabet": 1.15, "Astım/KOAH": 1.15,
    "Böbrek": 1.25, "Karaciğer": 1.25, "Kalp hastalığı": 1.35, "Kanser öyküsü": 1.50,
    meds: 1.05, smoking: 1.10, majorSurgery: 1.10,
  },
  healthRiskCap: 2.0,
};

// Beyan formundaki kronik hastalık seçenekleri — triage-questions.ts "chronic" sorusuyla AYNI sözlük
// ("Yok" hariç; beyanda "yok" = boş dizi). Yeni kalem eklerken İKİSİNİ ve healthRisk tablosunu birlikte güncelle.
export const HEALTH_CHRONIC_OPTIONS = [
  "Diyabet", "Tansiyon", "Kalp hastalığı", "Astım/KOAH", "Tiroid", "Böbrek", "Karaciğer", "Kanser öyküsü",
] as const;

// Hastanın paket ekranındaki sağlık beyanı (Case.healthDeclaration şifreli JSON'unun şekli).
export interface HealthDeclaration {
  chronic: string[];      // triage-questions "chronic" sözlüğünden seçimler ("Yok" = boş kabul)
  meds: boolean;          // düzenli ilaç kullanımı
  smoking: boolean;       // sigara
  majorSurgery: boolean;  // son 5 yılda büyük ameliyat
}

// Çözülmüş (decrypt SONRASI) beyan JSON'unu güvenle ayıkla — tek doğrulama noktası (API + sayfa + booking).
// Sözlük-dışı kronik etiketler ("Yok" dahil, eski/serbest veri) düşer; bozuk JSON = beyansız (null).
export function parseHealthDeclaration(raw: string | null | undefined): HealthDeclaration | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<HealthDeclaration>;
    return {
      chronic: (Array.isArray(p.chronic) ? p.chronic : []).filter((x): x is string => typeof x === "string" && (HEALTH_CHRONIC_OPTIONS as readonly string[]).includes(x)),
      meds: !!p.meds, smoking: !!p.smoking, majorSurgery: !!p.majorSurgery,
    };
  } catch { return null; }
}

// Beyandan birleşik sağlık risk çarpanı — çarpımsal, INSURANCE_CONFIG.healthRiskCap ile tavanlı.
// null/beyansız = 1.0. Sözlükte olmayan kronik etiketi (eski/serbest veri) 1.0 sayılır.
export function computeHealthRiskMult(decl: HealthDeclaration | null | undefined): number {
  if (!decl) return 1.0;
  const { healthRisk, healthRiskCap } = INSURANCE_CONFIG;
  let m = 1.0;
  for (const c of decl.chronic ?? []) m *= healthRisk[c] ?? 1.0;
  if (decl.meds) m *= healthRisk.meds ?? 1.0;
  if (decl.smoking) m *= healthRisk.smoking ?? 1.0;
  if (decl.majorSurgery) m *= healthRisk.majorSurgery ?? 1.0;
  return Math.min(healthRiskCap, Math.round(m * 100) / 100);
}

export function branchRiskMult(branch: string): number {
  const key = Object.keys(INSURANCE_CONFIG.branchRisk).find((k) => branch.includes(k));
  return key ? INSURANCE_CONFIG.branchRisk[key] : 1.0;
}

// insuranceLevel verilmişse o; yoksa eski booleanlardan türet (AI/geriye uyum: malpraktis→3, genişletilmiş→2, yoksa 1).
export function effectiveInsuranceLevel(s: { insuranceLevel?: InsuranceLevel; insuranceExtended?: boolean; insuranceMalpractice?: boolean }): InsuranceLevel {
  if (s.insuranceLevel === 1 || s.insuranceLevel === 2 || s.insuranceLevel === 3) return s.insuranceLevel;
  if (s.insuranceMalpractice) return 3;
  if (s.insuranceExtended) return 2;
  return 1;
}

export interface InsuranceQuote {
  level: InsuranceLevel;
  p1: number; p2: number; p3: number; total: number;
  coverageBase: number;    // Katman 2 teminat tabanı (toplam paket faturası, sigorta hariç)
  targetCoverage: number;  // Katman 3 hedef teminat (operasyon × targetMultiple)
  doctorCoverage: number;  // doktor MMSS limiti (USD'ye normalize)
  gap: number;             // doktorun karşılamadığı malpraktis teminat boşluğu
  riskMult: number;        // branş risk çarpanı
  healthMult: number;      // hasta sağlık-beyanı çarpanı (beyansız = 1.0)
}

// Saf, yan-etkisiz. coverageBaseUsd = sigorta hariç paket toplamı; treatmentTotalUsd = operasyon tutarı.
// healthRiskMult: hastanın sağlık beyanından (computeHealthRiskMult); verilmezse 1.0 (geriye uyum).
export function computeInsurance(opts: {
  level: InsuranceLevel;
  coverageBaseUsd: number;
  treatmentTotalUsd: number;
  branch: string;
  doctorMmssLimitUsd?: number;
  healthRiskMult?: number;
}): InsuranceQuote {
  const { base, r2, r3, targetMultiple } = INSURANCE_CONFIG;
  const risk = branchRiskMult(opts.branch);
  const health = opts.healthRiskMult ?? 1.0;
  const p1 = base;
  const p2 = opts.level >= 2 ? Math.round(opts.coverageBaseUsd * r2 * risk * health) : 0;
  const targetCoverage = Math.round(opts.treatmentTotalUsd * targetMultiple);
  const doctorCoverage = Math.max(0, Math.round(opts.doctorMmssLimitUsd ?? 0));
  const gap = Math.max(0, targetCoverage - doctorCoverage);
  const p3 = opts.level >= 3 ? Math.round(gap * r3 * risk * health) : 0;
  return { level: opts.level, p1, p2, p3, total: p1 + p2 + p3, coverageBase: Math.round(opts.coverageBaseUsd), targetCoverage, doctorCoverage, gap, riskMult: risk, healthMult: health };
}

// ₺ (KSHFT tarifesi / doktorun M5 fiyatı) → $ dönüşümü. Güncel kura göre ayarlayın (ileride env/API).
export const TRY_PER_USD = 40; // varsayılan/fallback kur — canlı kur lib/fxrate.ts'ten gelir, buraya parametre olarak geçilir
export function tryToUsd(tl: number, rate: number = TRY_PER_USD): number { return Math.round(tl / (rate || TRY_PER_USD)); }
export function formatTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

// Doktorun M2 görüşmesinde tavsiye ettiği tedavi (KSHFT) — fiyat ₺ (doktorun M5 fiyatı)
export interface RecommendedTreatment { code: string; name: string; priceTRY: number; }

export const TIER_PRESETS: Record<Tier, Partial<PackageSelection>> = {
  Ekonomik: { hotelStars: 4, hospitalType: "Özel", translator: false, insuranceLevel: 1, insuranceExtended: false, insuranceMalpractice: false },
  Standart: { hotelStars: 4, hospitalType: "Özel", translator: false, insuranceLevel: 2, insuranceExtended: true, insuranceMalpractice: false },
  Premium: { hotelStars: 5, hospitalType: "Üniversite", translator: true, insuranceLevel: 3, insuranceExtended: true, insuranceMalpractice: true },
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
  insurance: InsuranceQuote; // sigorta seviyesi + katman primleri + teminat/boşluk detayı
}

const INSURANCE_LEVEL_LABEL: Record<InsuranceLevel, string> = {
  1: "Zorunlu sağlık turizmi sigortası",
  2: "+ Operasyon teminat poliçesi",
  3: "+ Malpraktis & komplikasyon teminatı",
};

export function computePackage(s: PackageSelection, treatments?: RecommendedTreatment[], rate: number = TRY_PER_USD, doctorMmssLimitUsd?: number, healthRiskMult?: number): PackageQuote {
  const hasTx = !!treatments && treatments.length > 0;
  // Tedavi kalemleri: doktorun M2'de tavsiye ettiği işlemler (₺→$, doktorun fiyatıyla, canlı kur) varsa onlar; yoksa branş taban fiyatı
  const treatmentItems: LineItem[] = hasTx
    ? treatments!.map((t) => ({ key: `tx-${t.code}`, label: `Tedavi · ${t.name}`, amount: tryToUsd(t.priceTRY, rate), note: `Doktor fiyatı ${formatTRY(t.priceTRY)}` }))
    : [{ key: "treatment", label: `Tedavi · ${s.branch}`, amount: Math.round(treatmentBase(s.branch) * (HOSPITAL_MULT[s.hospitalType] ?? 1)), note: `${s.hospitalType} hastane` }];
  const treatment = treatmentItems.reduce((a, b) => a + b.amount, 0);

  const hotel = (HOTEL_PER_NIGHT[s.hotelStars] ?? 80) * s.nights;
  const flight = FLIGHT_BY_COUNTRY[s.country] ?? 400;
  const transfer = TRANSFER_BY_TIER[s.tier] ?? 0;
  const translator = s.translator ? TRANSLATOR_PRICE : 0;
  // Sigorta — 3 kademeli motor. Teminat tabanı = sigorta hariç paket toplamı; Katman 3 boşluğu doktor MMSS'inden.
  const level = effectiveInsuranceLevel(s);
  const ins = computeInsurance({
    level,
    coverageBaseUsd: treatment + hotel + flight + transfer + translator,
    treatmentTotalUsd: treatment,
    branch: s.branch,
    doctorMmssLimitUsd,
    healthRiskMult,
  });
  const insurance = ins.total;

  const items: LineItem[] = [
    ...treatmentItems,
    { key: "hotel", label: `Konaklama · ${s.hotelStars}★ otel`, amount: hotel, note: `${s.nights} gece` },
    { key: "flight", label: "Uçak bileti (gidiş-dönüş)", amount: flight },
    { key: "transfer", label: "Şehir içi transfer", amount: transfer, note: s.tier },
  ];
  if (translator) items.push({ key: "translator", label: "Tıbbi tercüman", amount: translator });
  items.push({
    key: "insurance",
    label: `Sigorta · Seviye ${level}`,
    amount: insurance,
    note: INSURANCE_LEVEL_LABEL[level],
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

  return { items, subtotal, platformFee, total, currency: "USD", split, insurance: ins };
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
