import { NextResponse } from "next/server";
import { cronGate } from "@/lib/cron-guard";
import { recordAccess } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { ingestStudentClubEvents } from "@/lib/student-club-store";

export const maxDuration = 120;
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const gate = cronGate(req, "ingest-student-clubs");
  if (gate) return gate;
  try {
    const result = await ingestStudentClubEvents();
    await recordAccess({ actor: null, action: "CRON_MAINTENANCE", resourceType: "SYSTEM", resourceId: "ingest-student-clubs", subjectUserId: null, detail: JSON.stringify(result) });
    if ("complete" in result && !result.complete) {
      void sendAlert("cron-student-clubs", "Öğrenci kulübü taraması kısmi kaldı", "student-source-check-incomplete");
      return NextResponse.json({ ok: false, ...result }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch {
    void sendAlert("cron-student-clubs", "Öğrenci kulübü taraması başarısız", "student-ingest-failed");
    return NextResponse.json({ error: "Öğrenci etkinlikleri güncellenemedi." }, { status: 500 });
  }
}
