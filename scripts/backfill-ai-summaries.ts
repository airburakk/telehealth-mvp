// AI özeti (klinik/mevzuat) TOPLU üretimi — 2026-09-03, kullanıcı isteği: "akıştaki diğer makalelere de
// bak, gerekirse tam kapsamlı backfill yap; AI özetleri ile ilaç sektöründeki özetler ve sektörel haberdeki
// şeyler çok önemli."
//
// KÖK BAĞLAM: aiSummary TEMBEL üretilir (yalnız doktor bir yayını AÇTIĞINDA — [id]/page.tsx). Bu script o
// tembel-üretim tasarımını İHLAL ETMEZ, yalnız "önceden ısıtma" yapar: GERÇEK ensureClinicalSummary /
// ensureRegulationSummary fonksiyonlarını (page.tsx ile AYNI kod yolu — kod tekrarı yok) her aday kayıt için
// çağırır. İdempotent: aiSummary zaten doluysa fonksiyonlar cache'ten döner, script'i tekrar çalıştırmak
// güvenlidir (yarıda kesilirse kaldığı yerden devam eder — WHERE zaten aiSummary:null filtreler).
//
// KAPSAM (page.tsx'teki [id] sayfasının mantığıyla BİREBİR): akademik (ensureClinicalSummary) + ilac/sektorel
// (ensureRegulationSummary) + mevzuat AMA category İÇTİHAT/DOKTRİN HARİÇ (Yargıtay/TR-Dizin kayıtları o
// sayfada ensureRegulationSummary'ye hiç gitmiyor — ayrı gösterim biçimleri var, tasarım gereği AI özeti YOK).
//
// ⚠️ ensureRegulationSummary bazı kayıtlarda (summary < 120 kar.) kaynağın URL'ini ÇEKMEYE ÇALIŞIR — bilinen
// kısıt: RG/OHSAD gibi TR kaynakları Vercel fra1'den erişilemeyebilir (ayrı ölçüm). O satırlar "unavailable"
// döner, hata SAYILMAZ (sonraki koşuda tekrar denenir — sayfaça URL çekilebilir hâle gelirse ilerler).
//
// Korkuluklar (create-admin.ts deseni): prod YALNIZ --prod + PROD_DATABASE_URL. Varsayılan SAYIM; --yaz üretir.
// Kullanım:
//   npx tsx scripts/backfill-ai-summaries.ts                          → DEV, yalnız sayım
//   npx tsx scripts/backfill-ai-summaries.ts --yaz                    → DEV, üretim
//   npx tsx scripts/backfill-ai-summaries.ts --yaz --limit 10         → küçük örnekle prova
//   npx tsx scripts/backfill-ai-summaries.ts --prod --yaz             → ÜRETİM (ayrı kullanıcı onayıyla)
//   --concurrency N (varsayılan 3) — aynı anda kaç AI çağrısı; yüksek tutma (rate limit).
import "dotenv/config";

const args = process.argv.slice(2);
const PROD = args.includes("--prod");
const WRITE = args.includes("--yaz");
const limitIx = args.indexOf("--limit");
const LIMIT = limitIx > -1 ? Number(args[limitIx + 1]) : Infinity;
const concIx = args.indexOf("--concurrency");
const CONCURRENCY = concIx > -1 ? Number(args[concIx + 1]) : 3;

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil.");
      process.exit(1);
    }
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log("🎯 HEDEF: ÜRETİM");
  } else {
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor; --prod olmadan durduruldu.");
      process.exit(1);
    }
    console.log("🎯 HEDEF: DEV");
  }
  // db/doctorium importu DATABASE_URL ayarından SONRA (guard + Prisma client modül yüklenirken env okur).
  const { db } = await import("../src/lib/db");
  const { generatePendingAiSummaries } = await import("../src/lib/doctorium");

  if (!WRITE) {
    // Dry-run: bu script'e özel — yalnız modül dağılımını gösterir, AI çağrısı yapmaz.
    const rows = await db.newsArticle.findMany({
      where: {
        aiSummary: null,
        OR: [
          { module: "akademik" },
          { module: "ilac" },
          { module: "sektorel" },
          { module: "mevzuat", category: { notIn: ["ictihat", "doktrin"] } },
        ],
      },
      select: { module: true },
      take: Number.isFinite(LIMIT) ? LIMIT : undefined,
    });
    console.log(
      `${PROD ? "PROD" : "dev"} DB · aday: ${rows.length}${Number.isFinite(LIMIT) ? ` (limit ${LIMIT})` : ""} · ` +
        `mod: DRY-RUN · eşzamanlılık: ${CONCURRENCY}`,
    );
    if (!rows.length) {
      console.log("aday yok — kapsamdaki tüm kayıtlarda aiSummary zaten dolu.");
    } else {
      const byModule = new Map<string, number>();
      for (const r of rows) byModule.set(r.module, (byModule.get(r.module) ?? 0) + 1);
      console.log("modül dağılımı:", Object.fromEntries(byModule));
      console.log("(dry-run: hiçbir AI çağrısı yapılmadı; --yaz ile üretilir)");
    }
    await db.$disconnect();
    return;
  }

  console.log(`${PROD ? "PROD" : "dev"} DB · mod: ÜRETİM · eşzamanlılık: ${CONCURRENCY}`);
  const basla = Date.now();
  // Ortak gövde: generatePendingAiSummaries (lib/doctorium.ts) — cron `generate-ai-summaries`
  // İLE PAYLAŞILIR (2026-09-05'ten beri bu iş her sabah otomatik de koşuyor; script elle
  // prova/limit/eşzamanlılık ayarlamak istendiğinde kullanılır).
  const sonuc = await generatePendingAiSummaries({
    concurrency: CONCURRENCY,
    limit: Number.isFinite(LIMIT) ? LIMIT : undefined,
    onProgress: (islenen, toplam, basarili, hata) => {
      if (islenen % 25 === 0 || islenen === toplam) {
        const sn = Math.round((Date.now() - basla) / 1000);
        console.log(`  ${islenen}/${toplam} işlendi — ${basarili} başarılı · ${hata} atlandı/hata · ${sn} sn`);
      }
    },
  });
  const toplamSn = Math.round((Date.now() - basla) / 1000);
  if (!sonuc.toplam) {
    console.log("aday yok — kapsamdaki tüm kayıtlarda aiSummary zaten dolu.");
  } else {
    console.log(`\nbitti — toplam ${sonuc.toplam} · başarılı ${sonuc.basarili} · atlandı/hata ${sonuc.hata} · süre ${toplamSn} sn`);
  }
  await db.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
