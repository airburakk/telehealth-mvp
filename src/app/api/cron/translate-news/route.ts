import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { translateSummaryBacklog } from "@/lib/translate-summaries";

// GET /api/cron/translate-news — özet GİRİŞİ çevirisi (v6.206, 2026-09-02 gece): akademik / ilaç /
// İngilizce sektörel kayıtların özeti Türkçeleşir (summary = Türkçe giriş, summaryOriginal = özgün) —
// gövde lib/translate-summaries, kapsam lib/news-language. Yeni→eski; birikmişi gecelik bütçeyle kendisi
// kapatır (PROD backfill script'i gerekmez).
// 02:40 UTC = 05:40 TR: ingest-doctorium (02:00, 300 sn) bitmiş olur; Post baskısı (03:30 UTC) Türkçe özeti görür.
// Elle tetikleme: `?budget=<sn>` (5–240) küçük prova için; varsayılan 240 sn (maxDuration 300 — sayım + audit payı).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DEFAULT_BUDGET_S = 240;

/** Düşen parça nedenleri (PHI yok): " neden=stop:refusal×2,api:429×1" — boşsa "". */
function nedenler(fr: Record<string, number>): string {
  const e = Object.entries(fr);
  return e.length ? ` neden=${e.map(([k, v]) => `${k}×${v}`).join(",")}` : "";
}

export async function GET(req: Request) {
  const gate = cronGate(req, "translate-news");
  if (gate) return gate;

  const q = Number(new URL(req.url).searchParams.get("budget"));
  const budgetS = Number.isFinite(q) && q > 0 ? Math.min(Math.max(q, 5), DEFAULT_BUDGET_S) : DEFAULT_BUDGET_S;

  try {
    const r = await translateSummaryBacklog({ budgetMs: budgetS * 1000 });
    // Kalıcı koşu izi: PHI YOK (yalnız adetler) — "çeviri koştu mu, kaç satır kaldı" kalıcı kayıttan okunur.
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "translate-news",
      subjectUserId: null,
      detail: r.skipped ?? `ozet=${r.translated}/${r.scanned} ayni=${r.identical} hata=${r.failed} kalan=${r.remaining}${nedenler(r.failReasons)}`,
    });
    // Anahtar var, satır var, HİÇBİRİ çevrilemedi → alarm (satırlar sonraki koşuya kalır; 500 değil — fail-open).
    if (r.failed > 0 && r.translated === 0 && r.identical === 0) {
      void sendAlert("cron-translate-news", "translate-news cron: hiçbir özet çevrilemedi", `hata=${r.failed} kalan=${r.remaining}${nedenler(r.failReasons)}`);
    }
    return NextResponse.json({ ok: true, budgetS, ...r });
  } catch (e) {
    // Ray C: cron sessiz düşemez — alarm + 500 (Vercel cron log'unda görünür). Akış İngilizce özetle sürer.
    void sendAlert("cron-translate-news", "translate-news cron BAŞARISIZ — özet çevirisi koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "translate-news başarısız." }, { status: 500 });
  }
}
