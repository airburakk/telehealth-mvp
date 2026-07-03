import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { releaseDoctor } from "@/lib/free-care";
import { notifyRoles } from "@/lib/notify";

// POST /api/free-care/outcome — doktor görüşme sonucu: CONSULT_DONE (kapat) | TREATMENT_NEEDED (→ etik kurul).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const caseId = String(body.caseId ?? "");
  const outcome = String(body.outcome ?? "");
  if (!caseId || !["CONSULT_DONE", "TREATMENT_NEEDED"].includes(outcome)) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || !c.freeCare) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  // DOCTOR yalnız kendi vakasının sonucunu işleyebilir; koordinatör/admin serbest (klinik personel)
  if (user.role === "DOCTOR") {
    const u = await db.user.findUnique({ where: { id: user.id } });
    if (!u?.doctorId || u.doctorId !== c.doctorId) {
      return NextResponse.json({ error: "Bu vaka size atanmadı." }, { status: 403 });
    }
  }

  // Aktif konsültasyonu bitir
  await db.consultation.updateMany({
    where: { caseId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: new Date() },
  });

  const newStatus = outcome === "TREATMENT_NEEDED" ? "TREATMENT_NEEDED" : "CONSULT_DONE";
  await db.case.update({ where: { id: caseId }, data: { status: "DONE", freeCareStatus: newStatus } });

  // Doktoru serbest bırak (IN_SESSION → OFFLINE); sonraki hasta için tekrar "Müsait ol"
  if (c.doctorId) await releaseDoctor(c.doctorId);

  // Tedavi gerekiyorsa etik kurula uygunluk değerlendirmesi için bildir (Faz 2 — Increment 2)
  if (outcome === "TREATMENT_NEEDED") {
    await notifyRoles(["ETHICS", "COORDINATOR"], {
      type: "FREECARE_TREATMENT",
      title: `🤝 Ücretsiz Sağlık Hizmeti tedavi onayı bekliyor`, // isim bildirime gömülmez (E2EE inc.2c)
      body: `${c.branch} · etik kurul uygunluk değerlendirmesi`,
      href: "/etik-kurul",
    });
  }

  return NextResponse.json({ ok: true, freeCareStatus: newStatus });
}
