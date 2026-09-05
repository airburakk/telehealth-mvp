import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestDoajAll } from "@/lib/doctorium-academic-sources";

// GET /api/cron/ingest-doaj — DOAJ (Directory of Open Access Journals) → NewsArticle.
//
// 2026-09-05: `ingest-doctorium`'dan AYRILDI (dernek ayrışması TEK BAŞINA yetmemişti — 5 Eylül'de
// ana route yine 300 sn'de kesildi). DEV ölçümü: 35 branş × DOAJ sorgusu ~466 sn (istek başına
// ortalama ~13 sn — kaynağın kendi API'si yavaş, sıralamayla ilgisi yok). Bu, TEK BAŞINA Vercel'in
// eski 300 sn sınırını aşıyordu → maxDuration=800 (Pro/Enterprise'da GA, beta değil) ŞART.
export const maxDuration = 800;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "ingest-doaj");
  if (gate) return gate;

  try {
    const [scanned, created] = await ingestDoajAll();
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "ingest-doaj",
      subjectUserId: null,
      detail: `doaj=${created}/${scanned}`,
    });
    return NextResponse.json({ ok: true, scanned, created });
  } catch (e) {
    void sendAlert("cron-ingest-doaj", "ingest-doaj cron BAŞARISIZ — DOAJ içeriği koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "ingest-doaj başarısız." }, { status: 500 });
  }
}
