// Vitrin ücret yer tutucuları (V04, v6.294 — kontrol raporu: fiyat/demo sınırları hizmet bazında).
// Sözlükte (copy.ts hiw.guides) TUTAR YAZILMAZ: "{consultFee}" / "{soFee}" render anında platformun tek kaynak sabitlerinden dolar
// (lib/billing CONSULT_FEE_USD · lib/second-opinion SO_FEE_USD) → sabit değişince 9 dilin vitrini kendiliğinden doğru kalır.
// Saf modül: React/DB yok; birim testte açık `fees` parametresiyle çağrılır.
import { CONSULT_FEE_USD } from "@/lib/billing";
import { SO_FEE_USD } from "@/lib/second-opinion";

export const FEE_PLACEHOLDERS = { consultFee: "{consultFee}", soFee: "{soFee}" } as const;

export type FeeValues = { consultFee: number; soFee: number };

export function platformFees(): FeeValues {
  return { consultFee: CONSULT_FEE_USD, soFee: SO_FEE_USD };
}

/** Metindeki {consultFee} / {soFee} yer tutucularını sayıyla doldurur; yer tutucu yoksa metin aynen döner. */
export function fillFees(text: string, fees: FeeValues = platformFees()): string {
  return text
    .replaceAll(FEE_PLACEHOLDERS.consultFee, String(fees.consultFee))
    .replaceAll(FEE_PLACEHOLDERS.soFee, String(fees.soFee));
}
