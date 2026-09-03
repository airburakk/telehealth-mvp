// Özet GİRİŞİ çeviri işi (v6.206, 2026-09-02 gece) — api/cron/translate-news'in gövdesi.
//
// Neden ingest'in dışında: abstract çıktısı başlığın ~20 katı; 30 branş × ek istek ingest-doctorium'un
// 300 sn bütçesini taşırır, o günün kalan branşları sessizce düşerdi. Bu iş kendi bütçesiyle (cron 240 sn)
// koşar; ingest 02:00'de başlar, bu 02:40'ta — Post baskısı (03:30) Türkçe özeti görür.
//
// Seçim: lib/news-language.summaryTranslationWhere — summaryOriginal IS NULL (henüz geçmedi) + özet dolu +
// (akademik | ilaç | İngilizce sektörel). Türkçe doğan kaynaklar (RG/TTB/Yargıtay/dernek…) HİÇ seçilmez.
// YENİ→ESKİ sırada: bugünün kayıtları önce Türkçeleşir (Post 06:30 TR, bülten 07:45 TR onları görür);
// birikmiş (çeviri hattından önceki kayıtlar) her gece bütçe kaldığınca erir — ayrı backfill script'i ve
// PROD'a yerelden bağlanma (AURA_DB_GUARD) sorunu YOK: iş gerçek prod runtime'ında koşar. Daha hızlı
// eritmek istenirse cron elle tekrar tetiklenir (DEPLOY.md "Cron düzeni").
//
// İşaretleme sözleşmesi (summaryOriginal = "işlendi" damgası — news-language.summaryTranslationWhere ile birlikte):
//   çeviri geldi (string)     → summary = Türkçe giriş, summaryOriginal = özgün TAM metin
//   tekil düşüş (null)        → summaryOriginal = summary (model aynı metni döndürdü = zaten Türkçe; tekrar seçilmesin)
//   düştü (undefined)         → DOKUNULMAZ (API hatası / red = parça; v6.209 kimlikli hizalamada eksik n = yalnız
//                               o öğe; sonraki koşuda yeniden) — fail-open
import { db } from "./db";
import { summaryTranslationWhere } from "./news-language";
import { summaryLead, translateSummariesTr } from "./translate-news";

export interface SummaryTranslationResult {
  /** Bu koşuda ele alınan satır. */
  scanned: number;
  /** Türkçe giriş yazıldı. */
  translated: number;
  /** Model aynı metni döndürdü (zaten Türkçe) → işlendi damgası, metin değişmedi. */
  identical: number;
  /** Parça düştü → dokunulmadı, sonraki koşuya kaldı. */
  failed: number;
  /** Koşu sonunda hâlâ bekleyen satır (birikmiş göstergesi — audit satırına yazılır). */
  remaining: number;
  /** Düşen parçaların neden sayacı — "stop:refusal" / "hiza:N/M" / "api:429" … (PHI yok; audit `neden=`). */
  failReasons: Record<string, number>;
  /** Dormant sebebi (anahtar yok) — hata DEĞİL. */
  skipped?: string;
}

const BATCH = 8; // translate-news SUMMARY_CHUNK ile aynı — bir parça = bir istek = bütçe kontrol noktası
const TAKE_PER_RUN = 400; // sorgu üst sınırı; bütçe zaten çok daha önce durdurur (~30 sn/parça)

export async function translateSummaryBacklog(opts: { budgetMs: number; now?: () => number }): Promise<SummaryTranslationResult> {
  const now = opts.now ?? Date.now;
  const started = now();
  const where = summaryTranslationWhere();
  const res: SummaryTranslationResult = { scanned: 0, translated: 0, identical: 0, failed: 0, remaining: 0, failReasons: {} };
  if (!process.env.ANTHROPIC_API_KEY) {
    res.skipped = "ANTHROPIC_API_KEY yok — özet çevirisi dormant";
    res.remaining = await db.newsArticle.count({ where });
    return res;
  }
  const rows = await db.newsArticle.findMany({
    where,
    select: { id: true, summary: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], // ikincil id: tek-alanlı sıra deterministik değil
    take: TAKE_PER_RUN,
  });
  for (let i = 0; i < rows.length; i += BATCH) {
    if (now() - started > opts.budgetMs) break; // bütçe: parça sınırında durulur, yarım parça yazılmaz
    const grup = rows.slice(i, i + BATCH);
    const out = await translateSummariesTr(
      grup.map((r) => summaryLead(r.summary)),
      (neden) => { res.failReasons[neden] = (res.failReasons[neden] ?? 0) + 1; },
    );
    for (let k = 0; k < grup.length; k++) {
      res.scanned++;
      const tr = out[k];
      if (tr === undefined) { res.failed++; continue; }
      if (tr === null) {
        await db.newsArticle.update({ where: { id: grup[k].id }, data: { summaryOriginal: grup[k].summary } });
        res.identical++;
        continue;
      }
      await db.newsArticle.update({
        where: { id: grup[k].id },
        data: { summary: tr, summaryOriginal: grup[k].summary },
      });
      res.translated++;
    }
  }
  res.remaining = await db.newsArticle.count({ where });
  return res;
}
