import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { sweepTrials } from "@/lib/trial-sweep";
import { sweepBranchReminders, type BranchReminderResult } from "@/lib/branch-reminder";

// GET /api/cron/trial-sweep — Doctorium DENEME süpürmesi (üç katman Faz A4, kullanıcı kararı 2026-09-05).
// 07:20 UTC = 10:20 TR (lib/cron-guard CRON_SCHEDULES ↔ vercel.json sözleşmesi; insanca saat — e-posta gönderir).
//
// İş: bitişe 7/3/1 gün kala hatırlatma · bitişte "süre doldu" · +60. gün imha bildirimi · +90. gün imha (FAIL-CLOSED:
// bildirimsiz/erken silme yok; incelemede belgesi olan atlanır) — mantık lib/trial-sweep + lib/doctorium-tiers.
// Kapı ortak (cronGate: Doctorium deploy'unda no-op, CRON_SECRET Bearer). Koşu izi audit CRON_MAINTENANCE satırında
// (Vercel log saklama kısa — kalıcı iz burası); hata → alarm + 500 (sessiz düşmez).
//
// + Branş uyarısı (2026-10-06, 👤): deneme süpürmesinden SONRA, branşı sınıflandırılmamış üyelere bildirim + e-posta
// (lib/branch-reminder). Ayrı try: branş adımı düşerse deneme işleri yine tamamlanmış sayılır, ayrı alarm gider.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "trial-sweep");
  if (gate) return gate;

  try {
    const r = await sweepTrials();
    let br: BranchReminderResult | null = null;
    try {
      br = await sweepBranchReminders();
    } catch (e) {
      void sendAlert("cron-branch-reminder", "branş uyarısı süpürmesi BAŞARISIZ — deneme süpürmesi tamamlandı", errText(e, "bilinmeyen hata"));
    }
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "trial-sweep",
      subjectUserId: null,
      detail: `bakilan=${r.checked} hatirlatma=${r.reminded} bitti=${r.ended} imha-bildirimi=${r.purgeNoticed} silinen=${r.purged} atlanan-bag=${r.skippedTies} atlanan-belge=${r.skippedDocs} hata=${r.failed} | brans: ${br ? `aday=${br.checked} gonderilen=${br.sent} hata=${br.failed}` : "BASARISIZ"}`,
    });
    return NextResponse.json({ ok: true, ...r, branchReminders: br });
  } catch (e) {
    void sendAlert("cron-trial-sweep", "trial-sweep cron BAŞARISIZ — deneme hatırlatmaları/imha koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "trial-sweep başarısız." }, { status: 500 });
  }
}
