import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsSecondOpinionCase } from "@/lib/ownership";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyRoles, notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/fulfill — hasta bekleyen talebi karşıladı (belge/tetkik yükledi).
// AWAITING_DOCUMENTS → PENDING_REVIEW (koordinatöre) · AWAITING_ADDITIONAL_TESTS → ASSIGNED (doktora).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsSecondOpinionCase(user, c)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  let nextStatus: "PENDING_REVIEW" | "ASSIGNED";
  if (c.status === "AWAITING_DOCUMENTS") nextStatus = "PENDING_REVIEW";
  else if (c.status === "AWAITING_ADDITIONAL_TESTS") nextStatus = "ASSIGNED";
  else return NextResponse.json({ error: "Şu an karşılanacak bir talep yok." }, { status: 409 });

  await db.secondOpinionRequest.updateMany({
    where: { caseId: id, status: "PENDING" },
    data: { status: "FULFILLED", fulfilledAt: new Date() },
  });
  try {
    await transitionSoCase(id, nextStatus, { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "REQUEST_FULFILL", detail: `→${nextStatus}` });

  if (nextStatus === "PENDING_REVIEW") {
    await notifyRoles(["COORDINATOR"], {
      type: "SO_REVIEW",
      title: "📄 Belgeler tamamlandı",
      body: "Eksik belge talebi karşılandı — yeniden inceleme bekliyor.",
      href: `/operasyon/ikinci-gorus/${id}`,
    });
  } else if (c.assignedDoctorId) {
    const docUser = await db.user.findFirst({ where: { doctorId: c.assignedDoctorId } });
    const n = { type: "SO_REQUEST" as const, title: "🧪 Ek tetkik yüklendi", body: "Hasta ek tetkikleri ekledi — inceleme bekliyor.", href: `/doktor/ikinci-gorus/${id}` };
    if (docUser) await notifyUser(docUser.id, n);
    else await notifyRoles(["DOCTOR"], n);
  }
  return NextResponse.json({ ok: true, status: nextStatus });
}
