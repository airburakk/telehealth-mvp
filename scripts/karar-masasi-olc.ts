// Karar masası — aday havuzu ÖLÇÜM aracı (v6.328, 2026-10-06; SALT-OKUR). İçtihat ingest biçimi ya da ayrıştırıcı değiştiğinde havuzu yeniden ölçmek için:
//   npx tsx scripts/karar-masasi-olc.ts            (DEV; DATABASE_URL .env'den)
// Çıktı: uygunluk sayısı + eleme nedenleri · tema dağılımı · gerekçe kesit kalitesi (uzunluk, baş/son biçimi, alternatif sayısı, kimlik taraması,
// birebir alıntı doğrulaması) · önerilen ilk 3 aday. Üretime işaret ederse DURUR (PROD_DB_FINGERPRINT).
// Not: `summary` DB'de ≤ 20.000 karakterdir; kesik metin KARAR bölümü içermez → aday olmaz ("iskelet" nedeni).
import "dotenv/config";
import { scanIdentity } from "../src/lib/social-calendar/identity";
import { REJECT_LABEL, analyzeKarar, buildKararDraft, pickKararCandidates, type RejectCode } from "../src/lib/social-calendar/karar";
import { verifyQuote } from "../src/lib/social-calendar/text";

async function main() {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
    console.error("üretime işaret ediyor; durduruldu");
    process.exit(1);
  }
  const { db } = await import("../src/lib/db");
  const rows = await db.newsArticle.findMany({
    where: { category: "ictihat", source: "yargitay" },
    select: { id: true, externalId: true, title: true, summary: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });
  const now = new Date();

  const rejected: Partial<Record<RejectCode, number>> = {};
  const eligible = rows.filter((r) => {
    const a = analyzeKarar(r, undefined, now);
    if (!a.eligible) for (const w of a.why) rejected[w] = (rejected[w] ?? 0) + 1;
    return a.eligible;
  });
  console.log(`içtihat satırı: ${rows.length} · uygun: ${eligible.length}`);
  console.log("elenme nedenleri (bir karar birden çok neden alabilir):");
  for (const [k, n] of Object.entries(rejected).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) console.log(`  ${String(n).padStart(4)} × ${REJECT_LABEL[k as RejectCode]}`);

  const themes: Record<string, number> = {};
  const lens: number[] = [];
  let altSayisi = 0, dogrulamaHata = 0, kimlikBulgu = 0, kucukBasla = 0;
  for (const r of eligible) {
    const d = buildKararDraft(r, now);
    if (!d) continue;
    themes[d.meta?.theme ?? "?"] = (themes[d.meta?.theme ?? "?"] ?? 0) + 1;
    altSayisi += d.meta?.gerekceAlts?.length ?? 1;
    const all = `${d.slides.map((s) => `${s.title}\n${s.body}\n${(s.bullets ?? []).join("\n")}`).join("\n")}\n${d.caption}`;
    if (scanIdentity(all).length) kimlikBulgu++;
    for (const s of d.slides.filter((x) => x.quote)) {
      if (!verifyQuote(s.body, r.summary).ok) dogrulamaHata++;
      if (s.role === "gerekce") {
        lens.push(s.body.length);
        if (/^[a-zçğıöşü]/.test(s.body)) kucukBasla++;
      }
    }
  }
  lens.sort((a, b) => a - b);
  const q = (p: number) => lens[Math.min(lens.length - 1, Math.floor(lens.length * p))] ?? 0;
  console.log("tema dağılımı:", JSON.stringify(themes));
  console.log(`gerekçe kesiti: min ${lens[0] ?? 0} · medyan ${q(0.5)} · p90 ${q(0.9)} · maks ${lens[lens.length - 1] ?? 0} kr · ortalama ${(altSayisi / Math.max(1, eligible.length)).toFixed(1)} alternatif`);
  console.log(`kalite kapıları: kimlik bulgusu ${kimlikBulgu} · alıntı doğrulama hatası ${dogrulamaHata} · küçük harfle başlayan ${kucukBasla}   (üçü de 0 olmalı)`);

  const res = pickKararCandidates(rows, undefined, now, 3);
  console.log("\nönerilen ilk 3 aday:");
  for (const c of res.candidates) console.log(`  [${c.score}] ${c.title} · ${c.tarih} · ${c.themeLabel} · ${c.outcomeLabel}\n      ${c.reasons.join(" | ")}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("HATA:", e?.message ?? e);
  process.exit(1);
});
