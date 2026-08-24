// e-Devlet barkodlu belge ayrıştırma provası (v6.119) — YEREL KALİBRASYON ARACI.
//
// Kullanım:
//   npx tsx scripts/edevlet-parse-dene.ts "C:\yol\mezun-belgesi.pdf" "Ayşe Yılmaz"
//                                          ^ e-Devlet'ten indirdiğin belge   ^ profildeki ad (ihtiyari)
//
// NİÇİN VAR: lib/edevlet-belge.ts'teki barkod/ad desenleri gerçek bir e-Devlet belgesi görülmeden
// yazıldı. Bu betik desenlerin TUTUP TUTMADIĞINI gösterir; tutmuyorsa çıktıdaki "metin önizleme"
// bölümüne bakıp BARCODE_PATTERNS / NAME_PATTERNS düzeltilir.
//
// 🔒 GİZLİLİK: dosya yalnız BU MAKİNEDE okunur — hiçbir yere gönderilmez, repoya girmez, DB'ye
// yazılmaz. TC kimlik no ekrana MASKELİ basılır (son 4 hane gizli). Belgeyi repo dizinine KOPYALAMA.

import { readFileSync } from "node:fs";
import { parseEdevletBelge, degerlendir, isValidTckn, normalizeTrName } from "../src/lib/edevlet-belge";

const [, , dosya, profilAdi] = process.argv;

if (!dosya) {
  console.error("Kullanım: npx tsx scripts/edevlet-parse-dene.ts <belge.pdf> [profil adı]");
  process.exit(1);
}

function maskele(tc: string | null): string {
  return tc ? `${tc.slice(0, 3)}****${"*".repeat(4)} (geçerli: ${isValidTckn(tc) ? "evet" : "hayır"})` : "—";
}

async function main() {
  const buf = readFileSync(dosya);
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    console.error("✕ Bu bir PDF değil. e-Devlet belgesini PDF olarak indirip yeniden dene.");
    process.exit(2);
  }

  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const metin = typeof text === "string" ? text : (text as string[]).join("\n");

  if (!metin.trim()) {
    console.error("✕ PDF'te metin katmanı YOK (taranmış görsel olabilir) → otomatik doğrulama çalışmaz.");
    process.exit(3);
  }

  const belge = parseEdevletBelge(metin);
  const sonuc = degerlendir(belge, profilAdi ?? belge.name);

  console.log("\n── Ayrıştırma sonucu ─────────────────────────────");
  console.log(`  e-Devlet işareti : ${belge.isEdevlet ? "✓ bulundu" : "✕ YOK"}`);
  console.log(`  Barkod           : ${belge.barcode ?? "✕ OKUNAMADI"}`);
  console.log(`  Ad-soyad         : ${belge.name ?? "✕ OKUNAMADI"}`);
  console.log(`  TC (maskeli)     : ${maskele(belge.tckn)}`);
  if (profilAdi) {
    console.log(`  Profil adı       : ${profilAdi}`);
    console.log(`  Normalize        : "${normalizeTrName(belge.name ?? "")}" ↔ "${normalizeTrName(profilAdi)}"`);
  }
  console.log("\n── Karar ─────────────────────────────────────────");
  console.log(`  ${sonuc.ok ? "✓ OTOMATİK GEÇER" : "⏳ İNSAN İNCELEMESİNE DÜŞER"} — ${sonuc.reason}`);

  if (!sonuc.ok) {
    console.log("\n── Metin önizleme (ilk 1200 karakter) ────────────");
    console.log("  ⚠️ Aşağıda kişisel veri olabilir — ekran görüntüsünü paylaşmadan önce maskele.\n");
    console.log(metin.slice(0, 1200).replace(/^/gm, "  "));
    console.log("\n  → Barkod/ad bu metinde hangi kalıpla geçiyorsa lib/edevlet-belge.ts'teki");
    console.log("    BARCODE_PATTERNS / NAME_PATTERNS dizisine o kalıbı ekle.");
  }
  console.log("");
}

main().catch((e) => {
  console.error("✕ Hata:", e instanceof Error ? e.message : e);
  process.exit(1);
});
