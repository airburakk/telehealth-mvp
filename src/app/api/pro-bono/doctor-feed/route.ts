import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { matchForDoctor, waitingCount, quotaInfo } from "@/lib/pro-bono";

// GET /api/pro-bono/doctor-feed — hekim konsolu poll'u. AVAILABLE'ken eşleşme dener; bekleyen sayısı + kota döner.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const u = await db.user.findUnique({ where: { id: user.id } });
  const doctorId = u?.doctorId;
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir hekim profiline bağlı değil." }, { status: 400 });

  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!d) return NextResponse.json({ error: "Hekim bulunamadı." }, { status: 404 });

  let consultationId: string | null = null;
  if (d.proBonoState === "AVAILABLE") {
    const m = await matchForDoctor(doctorId);
    consultationId = m?.consultationId ?? null;
  } else if (d.proBonoState === "IN_SESSION") {
    // Halen görüşmede → aktif konsültasyona dön
    const consult = await db.consultation.findFirst({
      where: { doctorId, status: "ACTIVE", case: { proBono: true } },
      orderBy: { startedAt: "desc" },
    });
    consultationId = consult?.id ?? null;
  }

  const count = await waitingCount();
  const fresh = await db.doctor.findUnique({ where: { id: doctorId } }); // eşleşme sonrası durum değişmiş olabilir
  return NextResponse.json({
    state: fresh?.proBonoState ?? "OFFLINE",
    waitingCount: count,
    quota: fresh ? quotaInfo(fresh) : null,
    consultationId,
  });
}
