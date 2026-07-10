import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyDoctorById, notifyDoctorsByBranch } from "@/lib/notify";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/cases/:id/discharge-request — hasta, post-op ekranından AI Epikriz / Taburcu Raporu ister
// (FAZ 3, 2026-07-10). Video görüşme talebi deseni: talep damgalanır + doktora bildirim düşer;
// raporu doktor /takip/[caseId] personel görünümünden üretir, hastaya "hazır" bildirimi gider.
// HASTA-ONLY + kendi vakası (BOLA): personel bu ucu kullanmaz (raporu doğrudan üretir).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const rl = await rateLimit(`discharge-req:${user.id}`, 5, 60_000); // bildirim spam freni
  if (!rl.ok) return tooMany(rl.retryAfter);

  const c = await db.case.findUnique({
    where: { id },
    select: { id: true, userId: true, doctorId: true, branch: true, dischargeRequestedAt: true },
  });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  await db.case.update({ where: { id: c.id }, data: { dischargeRequestedAt: new Date() } });

  // Atanmış doktora kişisel bildirim; atama yoksa branş doktorlarına (isim gömülmez — E2EE inc.2c)
  const n = {
    type: "DISCHARGE_REQUEST" as const,
    title: "📄 Epikriz / taburcu raporu talebi",
    body: `${c.branch} vakasında hasta epikriz istedi — post-op ekranından oluşturabilirsiniz`,
    href: `/takip/${c.id}`,
  };
  if (c.doctorId) await notifyDoctorById(c.doctorId, n);
  else await notifyDoctorsByBranch(c.branch, n);

  await recordAccess({
    actor: user, action: "DISCHARGE_REQUEST", resourceType: "CASE", resourceId: c.id, subjectUserId: c.userId,
    detail: "Hasta epikriz/taburcu raporu talep etti", ...reqMeta(req),
  });

  return NextResponse.json({ ok: true, requestedAt: new Date().toISOString() });
}
