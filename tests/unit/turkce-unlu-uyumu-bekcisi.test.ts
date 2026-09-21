import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Toplu "hekim → doktor" değişiminin (2026-08-17) ünlü uyumu kalıntıları (hekimimiz→"doktorumiz", hekimlerimiz→"doktorlarımiz")
// v6.291'de elle düzeltildi (triyaj · ucretsiz-saglik/basvur · FreeCareContent); bu bekçi geri gelmesini engeller.
// "doktor" gövdesi kalın ünlülü → iyelik ekleri -umuz / -ımız / -unuz / -ınız olur; "-miz" / "-niz" ASLA gelmez.
const KOK = join(__dirname, "..", "..", "src");
const DESEN = /doktor[a-zçğıöşü]*(?:miz|niz)\b/g;

function dosyalar(d: string, out: string[] = []): string[] {
  for (const ad of readdirSync(d)) {
    const p = join(d, ad);
    if (statSync(p).isDirectory()) dosyalar(p, out);
    else if (/\.(ts|tsx)$/.test(ad)) out.push(p);
  }
  return out;
}

describe("Türkçe ünlü uyumu bekçisi (doktor + iyelik ekleri)", () => {
  it("src altında 'doktor…miz' / 'doktor…niz' biçimi yok", () => {
    const bulgular: string[] = [];
    for (const p of dosyalar(KOK)) {
      const m = readFileSync(p, "utf8").match(DESEN);
      if (m) bulgular.push(`${p}: ${m.join(", ")}`);
    }
    expect(bulgular).toEqual([]);
  });
});
