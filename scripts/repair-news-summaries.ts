// Haber özeti ONARIMI — 2026-10-02 kök neden düzeltmelerinin ESKİ satırlara uygulanması (karar mantığı: lib/summary-repair).
//
// ARKA PLAN: Günlük Seçki özetleri ölçülürken iki veri kusuru bulundu; kod tarafı düzeltildi (lib/abstract-text · lib/document-text)
// ama düzeltme yalnız YENİ satırları kapsar. Bu betik eskileri onarır:
//   ADIM 1 · etiket (ağ YOK) — akademik europepmc/doaj satırlarında yapışık bölüm etiketleri ("BackgroundGas flaring…").
//            Çevrilmiş satırda YALNIZ özgün metin (`summaryOriginal`) onarılır; Türkçe giriş korunur.
//   ADIM 2 · sayfa (ağ VAR) — sektörel satırlarda `summary` 500 karakterden uzunsa (ingest hiçbir kaynakta 500'den fazla yazmaz →
//            bu, eski fetchDocumentText'in sayfa-metni yazımıdır: <title> + gezinme menüsü + alt bilgi) kaynak sayfa YENİ
//            çıkarıcıyla yeniden okunur. Fark varsa özet güncellenir; gövde yoksa ("Yeni Sayı İçin Tıklayınız") özet BOŞALTILIR;
//            sayfaya ERİŞİLEMEZSE DOKUNULMAZ (ağ hatası "içerik yok" sayılmaz). Çevrilmiş (İngilizce kaynak) satır yeniden kuyruğa
//            girer — translate-news yeniden çevirir.
//   `aiSummary`'ye varsayılan olarak DOKUNULMAZ (kirli girdiden üretilmiş olabilir; ADIM 2 raporu kaçının AI özeti olduğunu söyler).
//   `--ai-sifirla` ile ADIM 2'de değişen satırların aiSummary'si null'lanır → generate-ai-summaries (02:56) yeniden üretir.
//
// KULLANIM (dry-run varsayılan — hiçbir şey yazmaz):
//   npx tsx scripts/repair-news-summaries.ts [--sadece=etiket|sayfa] [--limit=300]
//   npx tsx scripts/repair-news-summaries.ts ... --yaz                         → dev'de uygula
//   npx tsx scripts/repair-news-summaries.ts ... --prod                        → ÜRETİM sayım (PROD_DATABASE_URL açıkça; fallback YOK)
//   npx tsx scripts/repair-news-summaries.ts ... --prod --yaz [--ai-sifirla]   → ÜRETİM yazma (yalnız açık onayla)
// İçerik herkese açık haber/literatür metnidir (PHI değil) — başlık ve metin başları basılır. İdempotent: ikinci koşu 0 satır bulur.
// ⚠️ ADIM 2 her adaya TEK sayfa isteği atar (aralarında 1,2 sn bekleme; bir kaynak art arda 3 kez düşerse o koşuda atlanır —
//    klimik.org.tr art arda isteklerde sınırlamıştı, bkz. dedupe-rss-guid.ts). `--limit` bir koşudaki aday sayısını sınırlar.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { extractDocumentText } from "../src/lib/document-text";
import { fetchDocumentHtml } from "../src/lib/doctorium-sources";
import { INGEST_SUMMARY_MAX, planLabelRepair, planPageTextRepair, type SummaryPatch } from "../src/lib/summary-repair";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const PROD = process.argv.includes("--prod");
const YAZ = process.argv.includes("--yaz");
const AI_SIFIRLA = process.argv.includes("--ai-sifirla");
const SADECE = arg("--sadece");
const LIMIT = Number(arg("--limit") ?? 300);
if (SADECE && SADECE !== "etiket" && SADECE !== "sayfa") { console.error("✋ --sadece=etiket|sayfa olmalı."); process.exit(1); }
if (!Number.isInteger(LIMIT) || LIMIT < 1) { console.error("✋ --limit pozitif tamsayı olmalı."); process.exit(1); }

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

const kisalt = (s: string, n = 90) => { const flat = s.replace(/\s+/g, " "); return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat; };
const bekle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const GAP_MS = 1200; // kaynaklara nazik: ardışık sayfa istekleri arası bekleme
const count = (keys: string[]) => {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([k, n]) => `${k} ${n}`).join(" · ");
};

// ── ADIM 1 · etiket ────────────────────────────────────────────────────────────────────────────────────────────────
async function etiketAdimi() {
  console.log("\n── ADIM 1 · etiket — akademik europepmc/doaj satırlarında yapışık bölüm etiketleri (ağ yok)");
  const rows = await db.newsArticle.findMany({
    where: { module: "akademik", source: { in: ["europepmc", "doaj"] }, summary: { not: "" } },
    select: { id: true, source: true, summary: true, summaryOriginal: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const plans = rows.flatMap((r) => { const patch = planLabelRepair(r); return patch ? [{ r, patch }] : []; });
  const translated = plans.filter((p) => p.r.summaryOriginal !== null).length;
  console.log(
    `taranan ${rows.length} satır · onarılacak ${plans.length}` +
      (plans.length ? ` → ${count(plans.map((p) => p.r.source))} · çevrilmiş (yalnız özgün onarılır) ${translated}` : ""),
  );
  for (const p of plans.slice(0, 3)) {
    const before = p.r.summaryOriginal ?? p.r.summary;
    const after = (p.patch.summaryOriginal ?? p.patch.summary) as string;
    console.log(`  [${p.r.source}] ${kisalt(before, 80)}\n      → ${kisalt(after, 80)}`);
  }
  if (plans.length === 0) { console.log("✓ Onarılacak satır yok."); return; }
  if (!YAZ) { console.log(`DRY-RUN: ${plans.length} satır onarılacaktı — yazmak için --yaz.`); return; }
  for (const p of plans) await db.newsArticle.update({ where: { id: p.r.id }, data: p.patch });
  console.log(`✅ ${plans.length} satır onarıldı.`);
}

// ── ADIM 2 · sayfa ─────────────────────────────────────────────────────────────────────────────────────────────────
async function sayfaAdimi() {
  console.log("\n── ADIM 2 · sayfa — sektörel satırlarda sayfa-metni yazımı (eski fetchDocumentText: başlık + gezinme menüsü + alt bilgi; ağ VAR)");
  const all = await db.newsArticle.findMany({
    where: { module: "sektorel", url: { not: null }, summary: { not: "" } },
    select: { id: true, source: true, url: true, title: true, summary: true, summaryOriginal: true, aiSummary: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const adaylar = all.filter((r) => (r.summaryOriginal ?? r.summary).length > INGEST_SUMMARY_MAX && !/\.pdf($|\?)/i.test(r.url as string));
  const batch = adaylar.slice(0, LIMIT);
  console.log(
    `sektörel özetli ${all.length} satır · sayfa-metni imzalı (> ${INGEST_SUMMARY_MAX} kar.) ${adaylar.length}` +
      (adaylar.length > batch.length ? ` · ⚠ tavan ${LIMIT} aşıldı — ${adaylar.length - batch.length} satır sonraki koşuya (--limit ile artır)` : ""),
  );

  const hostFails = new Map<string, number>();
  const plans: { r: (typeof batch)[number]; patch: SummaryPatch; fresh: string | null }[] = [];
  let unreachable = 0;
  let skipped = 0;
  let unchanged = 0;
  for (const r of batch) {
    const host = new URL(r.url as string).hostname;
    if ((hostFails.get(host) ?? 0) >= 3) { skipped++; continue; } // art arda 3 hata: o kaynak bu koşuda atlanır, sonraki koşu yine dener
    const html = await fetchDocumentHtml(r.url as string);
    await bekle(GAP_MS);
    if (html === null) { unreachable++; hostFails.set(host, (hostFails.get(host) ?? 0) + 1); continue; } // erişilemedi ≠ içerik yok → DOKUNMA
    hostFails.set(host, 0);
    const fresh = extractDocumentText(html);
    const patch = planPageTextRepair(r, fresh);
    if (!patch) { unchanged++; continue; }
    plans.push({ r, patch, fresh });
  }

  const cleared = plans.filter((p) => p.fresh === null).length;
  console.log(
    `işlenen ${batch.length - skipped} · değişecek ${plans.length} (yeni gövde ${plans.length - cleared} · gövde yok → boşalt ${cleared})` +
      (plans.length ? ` → ${count(plans.map((p) => p.r.source))}` : "") +
      ` · değişmez ${unchanged} · erişilemedi ${unreachable} (DOKUNULMAZ) · atlandı ${skipped}`,
  );
  const withAi = plans.filter((p) => p.r.aiSummary).length;
  if (plans.length) {
    console.log(
      `değişecek satırların AI özeti: ${withAi} var (kirli girdiden üretilmiş olabilir; ` +
        `${AI_SIFIRLA ? "--ai-sifirla → null'lanacak, gece cron'u yeniden üretir" : "dokunulmaz — sıfırlamak için --ai-sifirla"})`,
    );
  }
  for (const p of plans.slice(0, 12)) {
    console.log(
      `  [${p.r.source}] ${kisalt(p.r.title, 60)} · ${(p.r.summaryOriginal ?? p.r.summary).length} → ${p.fresh ? p.fresh.length : 0} kar.\n` +
        `      yeni: ${p.fresh ? kisalt(p.fresh, 100) : "(gövde yok → boş)"}`,
    );
  }
  if (plans.length === 0) { console.log("✓ Onarılacak satır yok."); return; }
  if (!YAZ) { console.log(`DRY-RUN: ${plans.length} satır onarılacaktı — yazmak için --yaz.`); return; }
  for (const p of plans) {
    await db.newsArticle.update({ where: { id: p.r.id }, data: { ...p.patch, ...(AI_SIFIRLA ? { aiSummary: null } : {}) } });
  }
  console.log(`✅ ${plans.length} satır onarıldı${AI_SIFIRLA ? " (aiSummary sıfırlandı)" : ""}.`);
}

async function main() {
  console.log(
    `🩹 Haber özeti onarımı — hedef: ${PROD ? "ÜRETİM (PROD_DATABASE_URL)" : "yerel DATABASE_URL"} · ${YAZ ? "YAZMA" : "DRY-RUN"}` +
      `${SADECE ? ` · yalnız ${SADECE}` : ""}`,
  );
  if (SADECE !== "sayfa") await etiketAdimi();
  if (SADECE !== "etiket") await sayfaAdimi();
}

main().catch((e) => { console.error("❌", e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => db.$disconnect());
