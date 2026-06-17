// Güncel USD/₺ kuru — TCMB (resmi) günlük kuru. Sunucu tarafında çekilir + cache'lenir;
// istemci bileşenlerine değer prop olarak geçilir. Hata/erişimsizlik → son-bilinen → sabit fallback.
// Kaynak: TCMB Günlük Döviz Kurları (today.xml), USD ForexSelling (döviz satış).
import { TRY_PER_USD } from "./pricing";

export interface FxRate {
  rate: number; // 1 USD kaç ₺
  source: string; // "TCMB" | "varsayılan" | "son-bilinen"
  at: number; // çekilme zamanı (epoch ms)
}

const TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 saat — kur gün içinde çok oynamaz, kaynağı yormayalım
let cache: FxRate | null = null;

function parseUsdSelling(xml: string): number | null {
  const block = xml.match(/<Currency\b[^>]*\bCurrencyCode="USD"[^>]*>([\s\S]*?)<\/Currency>/i);
  if (!block) return null;
  const m =
    block[1].match(/<ForexSelling>\s*([\d.,]+)\s*<\/ForexSelling>/i) ||
    block[1].match(/<BanknoteSelling>\s*([\d.,]+)\s*<\/BanknoteSelling>/i);
  if (!m) return null;
  const v = parseFloat(m[1].trim().replace(",", ".")); // TCMB nokta ondalık kullanır; virgül gelirse de çevir
  return Number.isFinite(v) && v > 0 ? v : null;
}

export async function getTryPerUsd(): Promise<FxRate> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  try {
    const r = await fetch(TCMB_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (AURA FX)" },
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
    });
    if (!r.ok) throw new Error("TCMB HTTP " + r.status);
    const rate = parseUsdSelling(await r.text());
    if (!rate) throw new Error("USD kuru ayrıştırılamadı");
    cache = { rate, source: "TCMB", at: Date.now() };
    return cache;
  } catch (e) {
    console.warn("[fx] TCMB kuru alınamadı:", e instanceof Error ? e.message : e);
    if (cache) return { ...cache, source: "son-bilinen" }; // TTL geçse de eldeki en iyi değer
    return { rate: TRY_PER_USD, source: "varsayılan", at: Date.now() };
  }
}
