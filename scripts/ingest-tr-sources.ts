// TR kaynakları YERELDEN besleme — Resmî Gazete + OHSAD + SGK GSS GM (v6.59, 2026-08-03;
// SGK 2026-08-25'te eklendi) — kalıcı araç.
//
// NEDEN: v6.57 teşhis turu kanıtladı — RG'ye Vercel fra1'den TCP bağlantısı hiç kurulamıyor
// (veri-merkezi IP aralığı sessizce DROP ediliyor), OHSAD ise Cloudflare IP-itibar korumasına
// takılıyor (403; gerçekçi tarayıcı başlıkları yetmedi). İkisi de YEREL (TR ev) IP'den 200
// veriyor → içerik, bilgisayar açıkken bu script'le toplanıp prod'a taşınır (kullanıcı kararı,
// 2026-08-03: seçenek a'). TTB'ye GEREK YOK — v6.59 TLS zincir onarımıyla cron kendisi topluyor.
//
// GÜVENLİK TASARIMI (kullanıcı vaadi: AURA_DB_GUARD kalıcı olarak GEVŞETİLMEZ):
//   • Varsayılan DRY-RUN: hiçbir şey yazılmaz; "şunlar yazılırdı" listelenir. Yazma = --yaz.
//   • Varsayılan hedef: DATABASE_URL (yerel .env → Neon DEV branch).
//   • Prod hedefi YALNIZ --prod bayrağıyla ve YALNIZ ayrı PROD_DATABASE_URL env'i varsa.
//     DATABASE_URL'i elle prod'a çevirme akışı DESTEKLENMEZ (aşağıdaki ters-korkuluk durdurur).
//   • --prod modunda db.ts guard'ı process-İÇİ "warn"a çekilir (kalıcı .env'e dokunulmaz;
//     guard mesajı yine yüksek sesle basılır). Yazılan tek tablo NewsArticle — PHI YOK
//     (kamuya açık mevzuat/haber), şifreleme katmanına hiç girmez.
//
// Kullanım:
//   npx tsx scripts/ingest-tr-sources.ts                  → DEV, dry-run, RG son 7 gün + OHSAD + SGK 7 sayfa
//   npx tsx scripts/ingest-tr-sources.ts --gun=30         → RG arşiv derinliği 30 gün
//   npx tsx scripts/ingest-tr-sources.ts --sgk-sayfa=10   → SGK GSS GM geriye 10 sayfa (varsayılan 7)
//   npx tsx scripts/ingest-tr-sources.ts --yaz            → DEV'e gerçekten yaz
//   npx tsx scripts/ingest-tr-sources.ts --prod           → PROD'a karşı dry-run (salt okuma)
//   npx tsx scripts/ingest-tr-sources.ts --prod --yaz     → PROD'a yaz
//
// İdempotent: (source, externalId) benzersiz → yeniden koşuda 0 yeni. Hiçbir şey SİLMEZ.
//
// SGK GSS GM (2026-08-25 eklendi): birim sayfası ?page=N ile geriye sayfalanır, 10 duyuru/sayfa
// (canlı ölçüm 2026-08-25: page=1 Ağustos-Temmuz · page=5 Mart-Şubat sonu · page=6 Şubat-Ocak) →
// varsayılan 7 sayfa ~7-8 ay kapsar (6 aylık istek için güvenlik payı; idempotent olduğundan
// fazlası zarar vermez). `ingestSgkGss` normal cron çağrısında (page verilmez) davranış AYNI.
//
// v6.62 — KAYNAK METNİ DOLDURMA: fihrist yalnız başlık verir; "Doktor özeti"nin zemini olan resmî
// metni tembel üretim (ensureRegulationSummary) kalem açılınca Vercel'den çeker — ama RG/OHSAD'a
// Vercel erişemediği için o adım prod'da DAİMA düşüyordu (özet hiç oluşmuyordu). Bu script artık
// yazım sonrasında boş summary'li RG/OHSAD kayıtlarının metnini YERELDEN çekip doldurur; Vercel'e
// yalnız AI adımı kalır. İdempotent: dolu summary atlanır. PDF kalemler bilinçli doldurulmaz.
import "dotenv/config";

const args = process.argv.slice(2);
const DRY = !args.includes("--yaz");
const PROD = args.includes("--prod");
const DAYS = Math.min(1100, Math.max(0, Number(args.find((a) => a.startsWith("--gun="))?.slice(6)) || 7));
const SGK_PAGES = Math.min(60, Math.max(0, Number(args.find((a) => a.startsWith("--sgk-sayfa="))?.slice(12)) || 7));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GAP_MS = 250; // RG arşivine ~4 istek/sn (kurum sitesini yormamak için)

async function main() {
  if (PROD) {
    const prodUrl = process.env.PROD_DATABASE_URL;
    if (!prodUrl) {
      console.error("⛔ --prod istendi ama PROD_DATABASE_URL tanımlı değil. Bilinçli prod akışı bu env'i ŞART koşar.");
      process.exit(1);
    }
    // db.ts guard'ı block'ta import anında fırlatır; bilinçli --prod akışında process-içi warn'a
    // çekilir (guard mesajı yine basılır). Kalıcı .env değişmez.
    process.env.DATABASE_URL = prodUrl;
    if (process.env.AURA_DB_GUARD === "block") process.env.AURA_DB_GUARD = "warn";
    console.log(`🎯 HEDEF: ÜRETİM ${DRY ? "(dry-run — yazma YOK, yalnız var-mı okuması)" : "(YAZILACAK)"}`);
  } else {
    // Ters-korkuluk: --prod verilmeden DATABASE_URL zaten prod'u gösteriyorsa (yanlış .env) DUR.
    const fp = process.env.PROD_DB_FINGERPRINT;
    if (fp && (process.env.DATABASE_URL ?? "").includes(fp)) {
      console.error("⛔ DATABASE_URL üretime işaret ediyor ama --prod verilmedi; kazara yazımı önlemek için durduruldu.");
      console.error("   Üretim bilinçli hedefse: --prod (+ yazmak için --yaz) kullan.");
      process.exit(1);
    }
    console.log(`🎯 HEDEF: DEV ${DRY ? "(dry-run)" : "(yazılacak)"}`);
  }

  // Dinamik import ŞART: src/lib/db, DATABASE_URL/AURA_DB_GUARD'ı MODÜL YÜKLENİRKEN okur —
  // yukarıdaki env ayarları import'tan önce bitmeliydi (statik import bu sırayı bozar).
  const { fetchGazetteToday, fetchGazetteArchive, ingestGazetteItems, ingestOhsad, ingestSgkGss, describeFetchError, fetchDocumentText, stripGazetteSectionSuffix } =
    await import("../src/lib/doctorium-sources");
  const { db } = await import("../src/lib/db");

  const onItem = (line: string) => console.log(`  ${DRY ? "→ yazılırdı" : "＋ yazıldı "} ${line}`);
  let rgScanned = 0, rgNew = 0, rgEmpty = 0, rgFail = 0;

  // ── Resmî Gazete: bugün + son N gün arşiv ─────────────────────────────────
  console.log(`\n📜 Resmî Gazete (bugün + son ${DAYS} gün arşiv)`);
  try {
    const today = await fetchGazetteToday();
    const [s, c] = await ingestGazetteItems(today, { dryRun: DRY, onItem });
    rgScanned += s; rgNew += c;
  } catch (e) {
    rgFail++;
    console.warn(`  ⚠ bugün: ${describeFetchError(e).slice(0, 160)}`);
  }
  for (let i = 1; i <= DAYS; i++) {
    const d = new Date(Date.now() - i * 86400000);
    if (d.getUTCDay() === 0) continue; // Pazar günü RG yayımlanmaz
    try {
      const items = await fetchGazetteArchive(d);
      if (!items.length) { rgEmpty++; continue; }
      const [s, c] = await ingestGazetteItems(items, { dryRun: DRY, onItem });
      rgScanned += s; rgNew += c;
    } catch (e) {
      rgFail++;
      if (rgFail <= 3) console.warn(`  ⚠ ${d.toISOString().slice(0, 10)}: ${describeFetchError(e).slice(0, 160)}`);
    }
    await sleep(GAP_MS);
  }
  console.log(`  RG: taranan ${rgScanned} · yeni ${rgNew} · boş gün ${rgEmpty} · hata ${rgFail}`);

  // ── RG başlık onarımı (2026-09-02) ─────────────────────────────────────────
  // Ana sayfa ayrıştırıcısı bölüm başlığını ("İLÂN BÖLÜMÜ") ve sayfa altı tanıtım metnini
  // başlığa yapıştırıyordu (sabah bülteninde görüldü); ayrıştırıcı düzeltildi, ESKİ kayıtlar burada
  // onarılır. İdempotent: temiz başlık değişmez, onarılan bir daha eşleşmez. Yalnız RG satırları.
  const suspects = await db.newsArticle.findMany({
    where: {
      source: "resmi-gazete",
      OR: [{ title: { contains: "BÖLÜMÜ" } }, { title: { contains: "kurumsal mobil uygulaması" } }],
    },
    select: { id: true, title: true },
  });
  const repairs = suspects
    .map((r) => ({ id: r.id, before: r.title, after: stripGazetteSectionSuffix(r.title) }))
    .filter((r) => r.after !== r.before && r.after.length >= 15);
  for (const r of repairs) {
    console.log(`  ${DRY ? "→ onarılırdı" : "✎ onarıldı  "} [RG] …${r.before.slice(-70)}  ⇒  …${r.after.slice(-45)}`);
  }
  if (!DRY) {
    for (const r of repairs) await db.newsArticle.update({ where: { id: r.id }, data: { title: r.after } });
  }
  console.log(`  başlık onarımı: şüpheli ${suspects.length} · onarım ${repairs.length}`);

  // ── OHSAD ─────────────────────────────────────────────────────────────────
  console.log("\n🏥 OHSAD");
  let ohsad: [number, number] = [0, 0];
  try {
    ohsad = await ingestOhsad({ dryRun: DRY, onItem });
    console.log(`  OHSAD: taranan ${ohsad[0]} · yeni ${ohsad[1]}`);
  } catch (e) {
    console.warn(`  ⚠ OHSAD: ${describeFetchError(e).slice(0, 160)}`);
  }

  // ── SGK (GSS GM) — geriye dönük sayfalama (backfill, 2026-08-25) ───────────
  // Günlük cron yalnız ilk sayfayı görür (en güncel 10 duyuru); SGK 2026-08-24'te canlıya
  // çıktığı için geçmiş kayıtlar hiç toplanmamıştı. Sayfa 0 kart dönerse (GSS birim sayfası
  // bulunamadı — slug damgası kırıldı ya da site değişti) döngü durur, sessizce boş geçilmez.
  console.log(`\n🏛️ SGK GSS GM (geriye ${SGK_PAGES} sayfa × 10 duyuru)`);
  let sgkScanned = 0, sgkNew = 0, sgkFail = 0;
  for (let p = 1; p <= SGK_PAGES; p++) {
    try {
      const [s, c] = await ingestSgkGss({ page: p, dryRun: DRY, onItem });
      sgkScanned += s;
      sgkNew += c;
      if (s === 0) {
        console.warn(`  ⚠ sayfa ${p}: 0 kart (GSS birim sayfası bulunamadı olabilir) — durduruluyor`);
        break;
      }
    } catch (e) {
      sgkFail++;
      console.warn(`  ⚠ sayfa ${p}: ${describeFetchError(e).slice(0, 160)}`);
    }
    await sleep(GAP_MS);
  }
  console.log(`  SGK: taranan ${sgkScanned} · yeni ${sgkNew} · hata ${sgkFail}`);

  // ── Kaynak metinleri (özet zemini) — v6.62 ─────────────────────────────────
  console.log("\n📄 Kaynak metinleri (boş summary'li RG/OHSAD kayıtları)");
  const TEXT_CAP = 500; // tek koşu tavanı — aşım raporlanır (sessiz kırpma yok), kalan sonraki koşuda
  const emptyRows = await db.newsArticle.findMany({
    where: { source: { in: ["resmi-gazete", "ohsad"] }, summary: "", url: { not: null } },
    select: { id: true, url: true },
    orderBy: { publishedAt: "desc" }, // taze kalemler önce dolsun — doktorun göreceği ilk sayfa
    take: TEXT_CAP + 1,
  });
  const overflowed = emptyRows.length > TEXT_CAP;
  if (overflowed) emptyRows.pop();
  const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);
  if (DRY) {
    const pdfCount = emptyRows.filter((r) => isPdf(r.url as string)).length;
    console.log(`  boş ${emptyRows.length} (${pdfCount} PDF — bilinçli özetlenmez) → --yaz metinleri çekip doldurur`);
  } else {
    let txFilled = 0, txPdf = 0, txFail = 0, txSkip = 0;
    // Art arda 3 hata veren kaynak o koşuda atlanır — asılı site (ör. OHSAD origin'i) kalem
    // başına 15 sn timeout'la tüm koşuyu kilitleyemesin. Sonraki koşu yine dener (idempotent).
    const hostFails = new Map<string, number>();
    for (const r of emptyRows) {
      const url = r.url as string;
      if (isPdf(url)) { txPdf++; continue; }
      const host = new URL(url).hostname;
      if ((hostFails.get(host) ?? 0) >= 3) { txSkip++; continue; }
      const text = await fetchDocumentText(url);
      if (text) {
        await db.newsArticle.update({ where: { id: r.id }, data: { summary: text } });
        txFilled++;
        hostFails.set(host, 0);
      } else {
        txFail++;
        hostFails.set(host, (hostFails.get(host) ?? 0) + 1);
      }
      await sleep(GAP_MS);
    }
    console.log(
      `  metin: dolduruldu ${txFilled} · PDF ${txPdf} · erişilemedi ${txFail} · atlandı ${txSkip}` +
      (overflowed ? ` · ⚠ tavan ${TEXT_CAP} aşıldı — kalanlar sonraki koşuda` : ""),
    );
  }

  // ── Özet ──────────────────────────────────────────────────────────────────
  const [rgTotal, ohsadTotal, sgkTotal] = await Promise.all([
    db.newsArticle.count({ where: { source: "resmi-gazete" } }),
    db.newsArticle.count({ where: { source: "ohsad" } }),
    db.newsArticle.count({ where: { source: "sgk" } }),
  ]);
  console.log(`\n${DRY ? "🔍 DRY-RUN — yazılan yok." : "✅ Yazma tamamlandı."}`);
  console.log(`Hedef DB'de toplam: resmi-gazete=${rgTotal} · ohsad=${ohsadTotal} · sgk=${sgkTotal}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
