import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestEuropePmcAll } from "@/lib/doctorium-academic-sources";

// GET /api/cron/ingest-europepmc — Europe PMC (hakemli açık erişim akademik) → NewsArticle.
//
// 2026-09-05: `ingest-doctorium`'dan AYRILDI (dernek ayrışması TEK BAŞINA yetmemişti — 5 Eylül'de
// ana route yine 300 sn'de kesildi). DEV ölçümü: 35 branş × Europe PMC sorgusu ~112 sn. Küçük ama
// ana route'un bütçesinden tasarruf için ayrı — DOAJ'ın (bkz. ingest-doaj, ~466 sn) yanında
// kendi bütçesiyle her zaman tamamlanır.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "ingest-europepmc");
  if (gate) return gate;

  try {
    const [scanned, created] = await ingestEuropePmcAll();
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "ingest-europepmc",
      subjectUserId: null,
      detail: `europepmc=${created}/${scanned}`,
    });
    return NextResponse.json({ ok: true, scanned, created });
  } catch (e) {
    void sendAlert("cron-ingest-europepmc", "ingest-europepmc cron BAŞARISIZ — Europe PMC içeriği koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "ingest-europepmc başarısız." }, { status: 500 });
  }
}
