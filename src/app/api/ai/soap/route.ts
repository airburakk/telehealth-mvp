import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { summarizeSOAP } from "@/lib/ai-clinical";

// POST /api/ai/soap — doktorun görüşme notunu SOAP formatına çevirir (Claude)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const notes = String(b.notes ?? "").trim();
  const caseId = String(b.caseId ?? "");
  const source = b.source === "transcript" ? "transcript" as const : "notes" as const;
  if (!notes) return NextResponse.json({ error: "Önce görüşme notu girin." }, { status: 400 });

  const c = caseId ? await db.case.findUnique({ where: { id: caseId } }) : null;

  try {
    const { soap, structured } = await summarizeSOAP(notes, {
      patientName: c?.patientName ?? "—",
      branch: c?.branch ?? "—",
      symptoms: c?.symptoms ?? "—",
    }, source);
    return NextResponse.json({ soap, structured });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
