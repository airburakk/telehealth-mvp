// Hukuki metin çeviri ÖNCEDEN ISITMA (Paket 7, v6.285 · 2026-09-20) — ilk hasta beklemesin.
//
// Ne yapar: yayımlı AURA hukuki belgeleri (A01/A02/A05/A07 — lib/aura-legal) + onam kapısı arayüz dizeleri + AI/beyan rıza
// metinlerinin bilgilendirme çevirisini TR/EN dışı arayüz dillerinde (lib/constants LANGUAGES) üretir ve Translation
// önbelleğine yazar (lib/i18n getLegalTranslations / getTranslations — sayfaların kullandığı AYNI kod yolu; idempotent:
// önbellekte olan birim tekrar çevrilmez). Belge sürümü değişince birimler değişir → yeniden koşulur.
//
// Kullanım:   npx tsx scripts/translate-legal.ts              # tüm diller
//             npx tsx scripts/translate-legal.ts --lang=Rusça  # tek dil
// Ortam: .env (DEV DB + ANTHROPIC_API_KEY). ÜRETİM önbelleği için PROD_DATABASE_URL'i AÇIKÇA DATABASE_URL olarak ver
// (DEPLOY.md "Ortam ayrımı"; [[live-verify-hits-prod-neon]]) — betik hedef DB'yi yazmaz, yalnız çeviri sayar.
// ⚠️ fetch sonrası process.exit() KULLANMA (Windows libuv 0xC0000409) → process.exitCode ([[node-windows-process-exit-fetch]]).
import { AURA_LEGAL_DOCS } from "../src/lib/aura-legal";
import { translateLegalMarkdown } from "../src/lib/legal-translate";
import { getTranslations } from "../src/lib/i18n";
import { LANGUAGES } from "../src/lib/constants";
import { CONSENT_GATE_UI_TR_VALUES } from "../src/lib/aura-consent-gate-ui";
import { LEGAL_SHELL_UI_TR_VALUES } from "../src/lib/aura-legal/shell-ui";
import { LEGAL_CANONICAL_LINK_TR, LEGAL_DISPLAY_NOTE_TR, LEGAL_DISPLAY_PARTIAL_TR } from "../src/lib/aura-legal/display";
import { AI_INTERPRET_TEXT, AI_TRIAGE_TEXT, HEALTH_DECLARATION_TEXT } from "../src/lib/ai-consent";
import { plainLegalText } from "../src/lib/consent-lang";

async function main() {
  const only = process.argv.find((a) => a.startsWith("--lang="))?.slice(7);
  const langs = LANGUAGES.filter((l) => l !== "Türkçe" && l !== "İngilizce" && (!only || l === only));
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY yok — çeviri üretilemez."); process.exitCode = 1; return; }
  const docs = AURA_LEGAL_DOCS.filter((d) => d.published);
  const uiTexts = [
    ...CONSENT_GATE_UI_TR_VALUES, ...LEGAL_SHELL_UI_TR_VALUES, LEGAL_DISPLAY_NOTE_TR, LEGAL_DISPLAY_PARTIAL_TR, LEGAL_CANONICAL_LINK_TR,
    ...docs.map((d) => d.title.tr),
    plainLegalText(AI_TRIAGE_TEXT.tr), plainLegalText(AI_INTERPRET_TEXT.tr), plainLegalText(HEALTH_DECLARATION_TEXT.tr),
  ];
  for (const lang of langs) {
    const t0 = Date.now();
    for (const d of docs) {
      const r = await translateLegalMarkdown(d.body.tr, lang);
      console.log(`[${lang}] ${d.slug}: ${r ? `${r.translated}/${r.units} birim${r.complete ? "" : " (EKSİK)"}` : "ÇEVRİLEMEDİ"}`);
    }
    const ui = await getTranslations(lang, uiTexts);
    // Özgünle aynı kalan dize = ya çevrilmedi ya da bilinçli özdeş ("Türkçe", "English", özel adlar) — arayüz hattı ikisini ayırt etmez;
    // sayaç "eksik" DEĞİL "aynı kalan" der (v6.300; eskiden 36/41 gibi görünüp yanlış alarm veriyordu).
    const same = uiTexts.filter((s) => ui[s] === s).length;
    console.log(`[${lang}] arayüz/rıza dizeleri: ${uiTexts.length} dize · özgünle aynı kalan ${same} (dil adları/özel adlar dâhil) · ${Math.round((Date.now() - t0) / 1000)} sn`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
