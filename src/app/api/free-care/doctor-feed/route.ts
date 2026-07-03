import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { matchForDoctor, waitingCount, quotaInfo } from "@/lib/free-care";

// GET /api/free-care/doctor-feed — doktor konsolu poll'u. AVAILABLE'ken eşleşme dener; bekleyen sayısı + kota döner.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const u = await db.user.findUnique({ where: { id: user.id } });
  const doctorId = u?.doctorId;
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });

  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!d) return NextResponse.json({ error: "Doktor bulunamadı." }, { status: 404 });

  let consultationId: string | null = null;
  if (d.freeCareState === "AVAILABLE") {
    // 🔒 verified kapısı MERKEZDE: matchForDoctor doğrulanmamış doktora eşleşme döndürmez (free-care.ts).
    const m = await matchForDoctor(doctorId);
    consultationId = m?.consultationId ?? null;
  } else if (d.freeCareState === "IN_SESSION") {
    // Halen görüşmede → aktif konsültasyona dön
    const consult = await db.consultation.findFirst({
      where: { doctorId, status: "ACTIVE", case: { freeCare: true } },
      orderBy: { startedAt: "desc" },
    });
    consultationId = consult?.id ?? null;
  }

  const count = await waitingCount();
  const fresh = await db.doctor.findUnique({ where: { id: doctorId } }); // eşleşme sonrası durum değişmiş olabilir
  return NextResponse.json({
    state: fresh?.freeCareState ?? "OFFLINE",
    waitingCount: count,
    quota: fresh ? quotaInfo(fresh) : null,
    consultationId,
  });
}
