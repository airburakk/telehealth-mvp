import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestDoctorium } from "@/lib/doctorium-ingest";

// GET /api/cron/ingest-doctorium — Doctorium içerik toplama: akademik (PubMed/Europe PMC/DOAJ) +
// haber/sektörel/ilaç kaynakları → NewsArticle (lib/doctorium-ingest).
//
// v6.204 (2026-09-02): purge-deleted bakım nöbetinden AYRILDI (kullanıcı kararı "bölelim" — Vercel
// planı Pro, cron kısıtı kalktı). Kendi 300 sn bütçesi var; eskiden on iş tek bütçeyi paylaşıyordu.
// 02:00 UTC = 05:00 TR: Post baskısı (daily-digest, 06:30 TR) bu koşunun içeriğini görsün diye ÖNCE.
// ⚠️ RG/OHSAD/SGK Vercel fra1'den erişilemez (v6.57 teşhisi) — o kaynaklar elle senkronla gelir
// (scripts/ingest-tr-sources.ts); bu cron'da hata sayacına düşer, koşuyu düşürmez.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "ingest-doctorium");
  if (gate) return gate;

  try {
    const r = await ingestDoctorium();
    // Kalıcı koşu izi: PHI YOK (yalnız adetler) — "cron koştu mu, kaç kayıt geldi" kalıcı kayıttan okunur.
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "ingest-doctorium",
      subjectUserId: null,
      detail: `pubmed=${r.pubmedNew}/${r.pubmedFetched} rg=${r.gazetteNew}/${r.gazetteFetched}${r.errors.length ? ` sorun=${r.errors.length}` : ""}`,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // Ray C: cron sessiz düşemez — alarm + 500 (Vercel cron log'unda görünür). Portal bir gün bayat
    // kalır, imha akışı ETKİLENMEZ (ayrı cron — bölmenin gerekçelerinden biri).
    void sendAlert("cron-ingest-doctorium", "ingest-doctorium cron BAŞARISIZ — içerik toplama koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "ingest-doctorium başarısız." }, { status: 500 });
  }
}
