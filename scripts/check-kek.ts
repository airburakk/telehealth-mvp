// Build-time KEK korkuluğu — package.json "build" ÖN ADIMI (2026-09-20, tatbikat #1 A6/B4). Değerlendirme: src/lib/kek-build-guard.
//
// ÜRETİM build'i (VERCEL_ENV=production) DATA_ENCRYPTION_KEK boş ya da 32 byte değilse BAŞLAMAZ → KEK'siz deployment hiç oluşmaz,
// önceki Ready deployment canlı kalır. Preview/yerel/CI build'lerinde atlanır (çıktıda "atlandı" satırı görünür).
//
// Kullanım: tsx scripts/check-kek.ts   (package.json: "build": "tsx scripts/check-kek.ts && prisma generate && next build")
//           VERCEL_ENV=production DATA_ENCRYPTION_KEK="" tsx scripts/check-kek.ts   → çıkış 1 (prova)
// Not: process.exit() DEĞİL process.exitCode (Windows libuv assertion tuzağı; hafıza node-windows-process-exit-fetch).
import { evaluateKekGuard } from "../src/lib/kek-build-guard";

const r = evaluateKekGuard(process.env);
if (r.ok) {
  console.log(`✓ KEK korkuluğu: ${r.reason}`);
} else {
  console.error(
    `⛔ KEK korkuluğu: ${r.reason}\n` +
      "   Üretim build'i DURDURULDU — KEK'siz deployment oluşturulmaz; önceki Ready deployment canlı kalır.\n" +
      "   Çözüm: Vercel → Settings → Environment Variables → DATA_ENCRYPTION_KEK (Production, Sensitive) — İKİ projeye AYRI\n" +
      "   (telehealth-mvp + doctorium). Anahtar kayıpsa: escrow (DEPLOY.md \"Yedekleme / Felaket Kurtarma\") ya da break-glass rotasyon\n" +
      "   (wiki/yonetisim/sir-envanteri.md §3.2). Bu korkuluğun bypass'ı YOKTUR (bilinçli).",
  );
  process.exitCode = 1;
}
