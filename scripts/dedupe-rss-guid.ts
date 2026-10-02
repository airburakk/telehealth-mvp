// RSS ÇİFT KAYIT temizliği — iki mod (arka plan: src/lib/rss-twins.ts başlıkları).
//
// MOD 1 — kimlik geçişi ikizleri (varsayılan; v6.307, 2026-10-02, 👤 onay)
//   NEDEN: 1438e05 (2026-09-29) ingestRss kimliğini link → guid yaptı, eski satırlar taşınmadı → 30 Eylül gecesi dernek
//   beslemelerinde (klimik / tjod / tatd / tgd-gastro / tgcd) pencere içindeki eski kalemler yeni kimlikle YENİDEN yaratıldı.
//   Kod tarafı v6.307'de kapandı (adoptLegacyRssKey — artık yeni çift oluşmaz); bu mod OLUŞMUŞ ikizleri birleştirir:
//   aynı kaynak + AYNI URL; ESKİ (link-anahtarlı) satır kalır, yeni ikiz silinir, eski satır guid'e anahtarlanır.
//
// MOD 2 — tarihi değişen yazı: `--ayni-baslik` (v6.309, 2026-10-02, 👤 "doğrula ve temizle")
//   NEDEN: WordPress kaynaklarında (KLİMİK) yazının tarihi değişince permalink de değişir; 1438e05 ÖNCESİ kimlik link
//   olduğundan aynı yazı yeni adresle ikinci kez yazılmıştı (aynı başlık, FARKLI URL). Başlık kimlik DEĞİLDİR → her küme
//   CANLI doğrulanır: iki adres de istenir, yönlendirmeler izlenir. Yalnız ÜÇ kanıt sınıfında birleştirilir
//   (lib/rss-twins decideRedated; 👤 karar 2026-10-02):
//     yonlendirme — bayat adres canlı adrese yönleniyor → bayat adresli satır silinir
//     ayni-hedef  — iki adres de aynı üçüncü adrese varıyor (tek yazı defalarca yeniden tarihlenmiş; başlık aynı = aynı sayı)
//                   → ilk görülen satır kalır, sonraki silinir
//     olu-adres   — bir adres 404/410, diğeri canlı → kırık bağlantılı satır silinir
//   Kanıt yoksa (iki ayrı canlı yazı · erişilemedi · adresler farklı yerlere varıyor) DOKUNULMAZ.
//   `--kanit=yonlendirme,ayni-hedef` ile sınıf daraltılır (varsayılan: üçü de).
//
// İKİ MODDA ORTAK (çift başına TEK transaction):
//   1. Silinecek satıra işaret eden `SavedArticle` kayıtları kalan satıra çevrilir (doktor ikisini de kaydettiyse fazlası silinir).
//   2. `DailyDigest.itemsJson` anlık görüntülerindeki id değiştirilir (Post arşiv bağlantısı kopmaz).
//   3. Kalan satırın AI özeti yoksa silinenin özeti taşınır (yeniden üretim maliyeti doğmasın).
// Beklenen kalıba uymayan gruplar (3+ satır vb.) yalnız RAPORLANIR, dokunulmaz.
//
// KULLANIM (dry-run varsayılan — hiçbir şey yazmaz):
//   npx tsx scripts/dedupe-rss-guid.ts [--ayni-baslik]              → dev sayım / doğrulama
//   npx tsx scripts/dedupe-rss-guid.ts [--ayni-baslik] --yaz        → dev'de birleştir
//   npx tsx scripts/dedupe-rss-guid.ts [--ayni-baslik] --prod       → ÜRETİM sayım (PROD_DATABASE_URL açıkça; fallback YOK)
//   npx tsx scripts/dedupe-rss-guid.ts [--ayni-baslik] --prod --yaz
//   npx tsx scripts/dedupe-rss-guid.ts --ayni-baslik --kanit=yonlendirme [--prod] [--yaz]   → yalnız yönlendirme kanıtlılar
// İçerik herkese açık haber başlığıdır (PHI değil) — başlık ve adresler basılır. İdempotent: ikinci koşu 0 çift bulur.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ASSOCIATION_RSS_SOURCES, RSS_SOURCES } from "../src/lib/doctorium-sources";
import { decideRedated, normalizeArticleUrl, scanRssTwins, scanSameTitle, type RedatedEvidence, type UrlResolution } from "../src/lib/rss-twins";

const PROD = process.argv.includes("--prod");
const YAZ = process.argv.includes("--yaz");
const AYNI_BASLIK = process.argv.includes("--ayni-baslik");
const url = PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(PROD ? "✋ PROD_DATABASE_URL tanımsız — üretim işlemi açık niyet ister." : "✋ DATABASE_URL tanımsız.");
  process.exit(1);
}
if (!PROD) {
  const fp = process.env.PROD_DB_FINGERPRINT;
  if (fp && url.includes(fp)) { console.error("⛔ DATABASE_URL üretim parmak izini içeriyor — üretim için --prod kullan."); process.exit(1); }
}
// lib/doctorium-sources kendi `db` istemcisini (yerel .env) İÇE ALIR ama bu betik onu hiç SORGULAMAZ — tüm okuma/yazma aşağıdaki
// açık-URL'li istemciden geçer (hedef karışmasın).
const db = new PrismaClient({ datasourceUrl: url });

const SOURCES = [...RSS_SOURCES, ...ASSOCIATION_RSS_SOURCES].map((s) => s.source);
const kisalt = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const gun = (d: Date) => d.toISOString().slice(0, 10);

const loadRows = () =>
  db.newsArticle.findMany({
    where: { source: { in: SOURCES }, url: { not: null } },
    select: { id: true, source: true, externalId: true, url: true, createdAt: true, publishedAt: true, title: true, aiSummary: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
type Row = Awaited<ReturnType<typeof loadRows>>[number];

/** Bağlı kayıt sayımı (kuru koşuda da görünür — yazımın neye dokunacağı önceden bilinir). */
async function refCounts(dropIds: string[]): Promise<{ saves: number; digests: number }> {
  const saves = await db.savedArticle.count({ where: { articleId: { in: dropIds } } });
  let digests = 0;
  for (const id of dropIds) digests += await db.dailyDigest.count({ where: { itemsJson: { contains: `"${id}"` } } });
  return { saves, digests };
}

/** `drop` satırını `keep`'e katar (tek transaction). `rekeyTo` verilirse kalan satırın externalId'si ona çevrilir (MOD 1). */
async function mergeRows(keep: Row, drop: Row, rekeyTo?: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const saves = await tx.savedArticle.findMany({ where: { articleId: drop.id }, select: { id: true, doctorId: true } });
    for (const s of saves) {
      const mevcut = await tx.savedArticle.findUnique({ where: { doctorId_articleId: { doctorId: s.doctorId, articleId: keep.id } }, select: { id: true } });
      if (mevcut) await tx.savedArticle.delete({ where: { id: s.id } });
      else await tx.savedArticle.update({ where: { id: s.id }, data: { articleId: keep.id } });
    }
    const digests = await tx.dailyDigest.findMany({ where: { itemsJson: { contains: `"${drop.id}"` } }, select: { id: true, itemsJson: true } });
    for (const d of digests) {
      await tx.dailyDigest.update({ where: { id: d.id }, data: { itemsJson: d.itemsJson.split(`"${drop.id}"`).join(`"${keep.id}"`) } });
    }
    await tx.newsArticle.delete({ where: { id: drop.id } });
    const data = { ...(rekeyTo ? { externalId: rekeyTo } : {}), ...(!keep.aiSummary && drop.aiSummary ? { aiSummary: drop.aiSummary } : {}) };
    if (Object.keys(data).length) await tx.newsArticle.update({ where: { id: keep.id }, data });
  });
}

// ── MOD 1: kimlik geçişi ikizleri (aynı URL) ───────────────────────────────────────────────────────────────────────
async function guidTwins(rows: Row[]) {
  const scan = scanRssTwins(rows);
  const perSource = new Map<string, number>();
  for (const p of scan.pairs) perSource.set(p.source, (perSource.get(p.source) ?? 0) + 1);
  console.log(`\nOnarılabilir çift: ${scan.pairs.length}${scan.pairs.length ? ` → ${[...perSource].map(([s, n]) => `${s} ${n}`).join(" · ")}` : ""}`);
  for (const p of scan.pairs) console.log(`  [${p.source}] ${kisalt(p.keep.title)}  (eski ${gun(p.keep.createdAt)} ← ikiz ${gun(p.drop.createdAt)})`);

  if (scan.odd.length) {
    console.log(`\nİnceleme (DOKUNULMAZ — beklenen kalıp dışı): ${scan.odd.length} grup`);
    for (const o of scan.odd) console.log(`  [${o.source}] ${o.reason} · ${kisalt(o.url, 100)}`);
  }

  const sameTitle = scanSameTitle(rows);
  if (sameTitle.length) {
    console.log(`\nBilgi (bu modda DOKUNULMAZ): aynı kaynak + aynı başlık, farklı URL: ${sameTitle.length} küme → doğrulama + birleştirme: --ayni-baslik`);
    for (const c of sameTitle.slice(0, 12)) console.log(`  [${c.source}] ${kisalt(c.title)} · ${c.rows.length} satır`);
  }

  if (scan.pairs.length === 0) { console.log("\n✓ Birleştirilecek çift yok."); return; }

  const refs = await refCounts(scan.pairs.map((p) => p.drop.id));
  const ozetTasinacak = scan.pairs.filter((p) => !p.keep.aiSummary && p.drop.aiSummary).length;
  console.log(`\nİkizlere bağlı kayıt: kaydetme ${refs.saves} · Post baskısı başvurusu ${refs.digests} · taşınacak AI özeti ${ozetTasinacak}`);

  if (!YAZ) { console.log(`\nDRY-RUN: ${scan.pairs.length} çift birleştirilecekti — yazmak için --yaz.`); return; }

  let done = 0;
  for (const p of scan.pairs) { await mergeRows(p.keep, p.drop, p.drop.externalId); done++; }
  console.log(`\n✅ ${done} çift birleştirildi (ikiz silindi, eski satır guid'e anahtarlandı).`);
}

// ── MOD 2: tarihi değişen yazı (aynı başlık, farklı URL — canlı yönlendirme kanıtıyla) ─────────────────────────────
const UA: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.7",
};

const KANIT_ADI: Record<RedatedEvidence, string> = { redirect: "yonlendirme", "same-target": "ayni-hedef", "dead-link": "olu-adres" };
const kanitArg = process.argv.find((a) => a.startsWith("--kanit="))?.slice("--kanit=".length);
const IZINLI_KANIT = new Set(kanitArg ? kanitArg.split(",").map((s) => s.trim()).filter(Boolean) : Object.values(KANIT_ADI));
for (const k of IZINLI_KANIT) {
  if (!Object.values(KANIT_ADI).includes(k)) { console.error(`✋ Bilinmeyen kanıt sınıfı: ${k} (geçerli: ${Object.values(KANIT_ADI).join(", ")})`); process.exit(1); }
}

const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Adresin BUGÜNKÜ durumu: 2xx → canlı (yönlendirmeler izlenmiş son adresle) · 404/410 → ölü · diğer her şey → bilinmiyor (kanıt değil). */
async function resolveUrl(u: string): Promise<{ res: UrlResolution; note: string }> {
  try {
    const r = await fetch(u, { redirect: "follow", headers: UA, signal: AbortSignal.timeout(20_000) });
    await r.arrayBuffer().catch(() => undefined); // gövdeyi tüket — bağlantı açık kalmasın
    const note = `HTTP ${r.status}${r.redirected ? " (yönlendi)" : ""}`;
    if (r.ok) return { res: { kind: "live", final: r.url }, note };
    if (r.status === 404 || r.status === 410) return { res: { kind: "dead" }, note };
    return { res: { kind: "unknown", note }, note };
  } catch (e) {
    const err = e as { cause?: { code?: string }; name?: string };
    const note = `erişilemedi: ${err?.cause?.code ?? err?.name ?? "hata"}`;
    return { res: { kind: "unknown", note }, note };
  }
}

async function sameTitle(rows: Row[]) {
  const clusters = scanSameTitle(rows);
  console.log(`\nAynı kaynak + aynı başlık, farklı URL: ${clusters.length} küme — her adres CANLI istenir · izinli kanıt: ${[...IZINLI_KANIT].join(", ")}`);
  const merges: { keep: Row; drop: Row; evidence: RedatedEvidence }[] = [];
  for (const c of clusters) {
    console.log(`\n[${c.source}] ${kisalt(c.title, 120)}`);
    if (c.rows.length !== 2) { console.log(`  ⏭ DOKUNULMAZ: ${c.rows.length} satır (beklenen 2)`); continue; }
    const [a, b] = c.rows;
    const resolved = new Map<string, UrlResolution>();
    for (const r of [a, b]) {
      const adres = r.url as string;
      let { res, note } = await resolveUrl(adres);
      // 🪤 2026-10-02: art arda koşularda klimik.org.tr istekleri bir süre zaman aşımına düştü (kaynak sıkıştı / sınırladı).
      // "Erişilemedi" kanıt DEĞİLDİR → küme dokunulmadan geçilir (o koşuda 0 satır silindi — doğru davranış). Geçici takılmaya
      // karşı TEK yeniden deneme + istekler arası bekleme; yine erişilemezse küme sonraki koşuya kalır.
      if (res.kind === "unknown") {
        await bekle(4000);
        const ikinci = await resolveUrl(adres);
        res = ikinci.res;
        note = `${note} → 2. deneme: ${ikinci.note}`;
      }
      resolved.set(adres, res);
      const varis = res.kind !== "live" ? "" : normalizeArticleUrl(res.final) === normalizeArticleUrl(adres) ? " · kendine çözülüyor" : ` → ${res.final}`;
      console.log(`  ${gun(r.publishedAt)} · ${adres}\n      ${note}${varis}`);
      await bekle(1500); // kaynağa nazik: ardışık istekler arası bekleme
    }
    const d = decideRedated(a, b, (u) => resolved.get(u) ?? { kind: "unknown", note: "istenmedi" });
    if ("reason" in d) { console.log(`  ⏭ DOKUNULMAZ: ${d.reason}`); continue; }
    if (!IZINLI_KANIT.has(KANIT_ADI[d.evidence])) { console.log(`  ⏭ DOKUNULMAZ: kanıt "${KANIT_ADI[d.evidence]}" bu koşuda izinli değil (--kanit)`); continue; }
    console.log(`  ✔ KANIT (${KANIT_ADI[d.evidence]}): ${gun(d.drop.publishedAt)} tarihli satır silinir; ${gun(d.keep.publishedAt)} tarihli satır kalır`);
    merges.push(d);
  }

  const sinif = new Map<string, number>();
  for (const m of merges) sinif.set(KANIT_ADI[m.evidence], (sinif.get(KANIT_ADI[m.evidence]) ?? 0) + 1);
  console.log(`\nKanıtlı birleştirme: ${merges.length} / ${clusters.length} küme${merges.length ? ` → ${[...sinif].map(([k, n]) => `${k} ${n}`).join(" · ")}` : ""}`);
  if (merges.length === 0) { console.log("✓ Birleştirilecek küme yok."); return; }

  const refs = await refCounts(merges.map((m) => m.drop.id));
  const ozetTasinacak = merges.filter((m) => !m.keep.aiSummary && m.drop.aiSummary).length;
  console.log(`Silinecek satırlara bağlı kayıt: kaydetme ${refs.saves} · Post baskısı başvurusu ${refs.digests} · taşınacak AI özeti ${ozetTasinacak}`);

  if (!YAZ) { console.log(`\nDRY-RUN: ${merges.length} satır silinecekti — yazmak için --yaz.`); return; }

  let done = 0;
  for (const m of merges) { await mergeRows(m.keep, m.drop); done++; }
  console.log(`\n✅ ${done} küme birleştirildi (kanıtlı çift satır silindi).`);
}

async function main() {
  console.log(`🧹 RSS çift kayıt temizliği — ${AYNI_BASLIK ? "MOD 2: tarihi değişen yazı (aynı başlık, farklı URL)" : "MOD 1: kimlik geçişi ikizleri (aynı URL)"} · hedef: ${PROD ? "ÜRETİM" : "dev"} · mod: ${YAZ ? "YAZ" : "DRY-RUN"}`);
  const rows = await loadRows();
  console.log(`Taranan: ${rows.length} satır · ${SOURCES.length} kaynak (${SOURCES.join(", ")})`);
  if (AYNI_BASLIK) await sameTitle(rows);
  else await guidTwins(rows);
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
