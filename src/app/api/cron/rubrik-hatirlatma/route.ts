import { NextResponse } from "next/server";
import { cronGate, errText } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { rubrikHatirlatmasi } from "@/lib/social-calendar/reminder-run";

// GET /api/cron/rubrik-hatirlatma — içerik takvimi rubrik HATIRLATMASI (v6.345, 2026-10-10; 👤 "hatırlatma ile devam et").
// Her gün 09:00 TR: BUGÜN rubrik günüyse ve yuva hazır değilse ACİL (12:00 yayını o gün hiçbir mecraya gitmez), YARIN rubrik günüyse
// ve hazır değilse HAZIRLIK e-postası (lib/social-calendar/reminder — karar SAF; reminder-run — DB + e-posta). Hazır = APPROVED + mühür sağlam.
// Yalnız AURA deploy'unda koşar (cronGate; DB ortak, Doctorium'da no-op). Koşu izi audit CRON_MAINTENANCE (kalıcı — Vercel log'u kısa ömürlü).
// Hatırlatma kritik değil ama sessiz düşemez: istisna ya da Resend reddi → alarm (+ istisnada 500).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = cronGate(req, "rubrik-hatirlatma");
  if (gate) return gate;

  try {
    const r = await rubrikHatirlatmasi();
    const ozet = r.maddeler.map((m) => `${m.seviye}:${m.seriesKey}@${m.slotDay}`).join(",") || "yok";
    await recordAccess({
      actor: null,
      action: "CRON_MAINTENANCE",
      resourceType: "SYSTEM",
      resourceId: "rubrik-hatirlatma",
      subjectUserId: null,
      detail: `gun=${r.bugun} madde=${ozet} gonderildi=${r.gonderildi} atlama=${r.atlama ?? "-"}`,
    });
    if (r.atlama === "gonderim-hatasi") {
      void sendAlert("cron-rubrik-hatirlatma", "rubrik hatırlatması e-postası GİDEMEDİ (Resend reddetti)", ozet);
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    void sendAlert("cron-rubrik-hatirlatma", "rubrik-hatirlatma cron BAŞARISIZ — hatırlatma gitmedi", errText(e, "bilinmeyen hata"));
    return NextResponse.json({ error: "rubrik-hatirlatma başarısız." }, { status: 500 });
  }
}
