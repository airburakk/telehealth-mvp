import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { sweepTrials } from "@/lib/trial-sweep";

// GET /api/cron/trial-sweep — Doctorium DENEME süpürmesi (üç katman Faz A4, kullanıcı kararı 2026-09-05).
// 07:20 UTC = 10:20 TR (lib/cron-guard CRON_SCHEDULES ↔ vercel.json sözleşmesi; insanca saat — e-posta gönderir).
//
// İş: bitişe 7/3/1 gün kala hatırlatma · bitişte "süre doldu" · +60. gün imha bildirimi · +90. gün imha (FAIL-CLOSED:
// bildirimsiz/erken silme yok; incelemede belgesi olan atlanır) — mantık lib/trial-sweep + lib/doctorium-tiers.
// Kapı ortak (cronGate: Doctorium deploy'unda no-op, CRON_SECRET Bearer). Koşu izi audit CRON_MAINTENANCE satırında
// (Vercel log saklama kısa — kalıcı iz burası); hata → alarm + 500 (sessiz düşmez).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "trial-sweep");
  if (gate) return gate;

  try {
    const r = await sweepTrials();
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "trial-sweep",
      subjectUserId: null,
      detail: `bakilan=${r.checked} hatirlatma=${r.reminded} bitti=${r.ended} imha-bildirimi=${r.purgeNoticed} silinen=${r.purged} atlanan-bag=${r.skippedTies} atlanan-belge=${r.skippedDocs} hata=${r.failed}`,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    void sendAlert("cron-trial-sweep", "trial-sweep cron BAŞARISIZ — deneme hatırlatmaları/imha koşmadı", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "trial-sweep başarısız." }, { status: 500 });
  }
}
