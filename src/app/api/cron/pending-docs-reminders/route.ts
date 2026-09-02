import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { remindPendingDocs } from "@/lib/pending-docs-reminder";

// GET /api/cron/pending-docs-reminders — DOCS_PENDING hatırlatması (v6.36): belge-bekleyen
// başvurunun hastasına günde 1 dürtü, en fazla 3 (lib/pending-docs-reminder; durum MISSING_DOCS
// bildirim kayıtlarından türetilir, kolonsuz).
//
// v6.205 (2026-09-02): purge-deleted bakım nöbetinden AYRILDI (kullanıcı kararı "bölelim"; plan Pro)
// ve saati DEĞİŞTİ: 07:00 UTC = 10:00 TR — eskiden 06:30 TR'de gidiyordu; hasta bildirimi/e-postayı
// çalışma saatinde görsün (kullanıcı kararı). Hatırlatma kritik değil: hasta panelden her an kendisi
// tamamlayabilir; ama cron sessiz düşemez (alarm + 500).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "pending-docs-reminders");
  if (gate) return gate;

  try {
    const r = await remindPendingDocs();
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "pending-docs-reminders",
      subjectUserId: null,
      detail: `bakilan=${r.checked} gonderilen=${r.reminded} tavan=${r.capped} hata=${r.failed}`,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    void sendAlert("cron-pending-docs", "pending-docs-reminders cron BAŞARISIZ — hatırlatmalar gitmedi", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "pending-docs-reminders başarısız." }, { status: 500 });
  }
}
