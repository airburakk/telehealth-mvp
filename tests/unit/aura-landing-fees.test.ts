import { describe, it, expect } from "vitest";
import { fillFees, platformFees, FEE_PLACEHOLDERS } from "@/lib/aura-landing/fees";
import { CONSULT_FEE_USD } from "@/lib/billing";
import { SO_FEE_USD } from "@/lib/second-opinion";

// V04 (v6.294): vitrin ücret yer tutucuları — sözlükte tutar yazılmaz, render'da tek kaynaktan dolar.
describe("fillFees (V04)", () => {
  it("yer tutucuları verilen sayılarla doldurur, kalan metne dokunmaz", () => {
    expect(fillFees("Ücret {consultFee} USD · paket {soFee} USD.", { consultFee: 60, soFee: 600 })).toBe("Ücret 60 USD · paket 600 USD.");
    expect(fillFees("Yer tutucusuz metin.", { consultFee: 1, soFee: 2 })).toBe("Yer tutucusuz metin.");
  });
  it("varsayılan değerler platform sabitleridir (lib/billing · lib/second-opinion)", () => {
    expect(platformFees()).toEqual({ consultFee: CONSULT_FEE_USD, soFee: SO_FEE_USD });
    expect(fillFees(`${FEE_PLACEHOLDERS.consultFee}/${FEE_PLACEHOLDERS.soFee}`)).toBe(`${CONSULT_FEE_USD}/${SO_FEE_USD}`);
  });
  it("aynı yer tutucu birden çok geçse de hepsi dolar", () => {
    expect(fillFees("{soFee} {soFee}", { consultFee: 0, soFee: 7 })).toBe("7 7");
  });
});
