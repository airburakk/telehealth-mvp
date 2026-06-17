import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { matchForCase, queuePosition, availableDoctorCount } from "@/lib/pro-bono";

// GET /api/pro-bono/waiting?caseId= — hasta bekleme ekranı poll'u. Tekrar eşleşme dener; eşleşince consultationId döner.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const caseId = searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ error: "caseId gerekli." }, { status: 400 });

  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || !c.proBono) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsCase(user, c)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  if (c.proBonoStatus === "WAITING") {
    const m = await matchForCase(caseId);
    if (m) return NextResponse.json({ status: "MATCHED", consultationId: m.consultationId });
    const pos = await queuePosition(caseId, c.createdAt);
    const online = await availableDoctorCount();
    return NextResponse.json({ status: "WAITING", queuePos: pos, online });
  }

  // Zaten eşleşmiş/görüşmede → aktif konsültasyona yönlendir
  if (c.proBonoStatus === "IN_CONSULT" || c.proBonoStatus === "MATCHED") {
    const consult = await db.consultation.findFirst({
      where: { caseId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
    });
    if (consult) return NextResponse.json({ status: "MATCHED", consultationId: consult.id });
  }

  return NextResponse.json({ status: c.proBonoStatus ?? "UNKNOWN" });
}
