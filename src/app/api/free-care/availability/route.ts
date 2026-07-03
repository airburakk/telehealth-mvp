import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { setDoctorAvailable, matchForDoctor, quotaInfo, notifyStrandedWaiters } from "@/lib/free-care";

// POST /api/free-care/availability — doktor ücretsiz sağlık hizmeti müsaitliğini aç/kapa (+ops. kota); açınca eşleşme dener.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const u = await db.user.findUnique({ where: { id: user.id } });
  const doctorId = u?.doctorId;
  if (!doctorId) return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  // Opsiyonel kontenjan güncelleme (1-10)
  if (typeof body.quota === "number") {
    const quota = Math.min(10, Math.max(1, Math.round(body.quota)));
    await db.doctor.update({ where: { id: doctorId }, data: { freeCareQuota: quota } });
  }

  const available = body.available === true;
  // 🔒 Doğrulanmamış (verified=false) doktor ücretsiz sağlık hizmeti havuzuna GİREMEZ — AVAILABLE olsaydı hasta-yüzü
  // "müsait doktor" sayacını şişirirdi; eşleşme zaten merkezde (matchForDoctor/pairCaseWithDoctor) kilitli.
  if (available) {
    const doc = await db.doctor.findUnique({ where: { id: doctorId }, select: { verified: true } });
    if (doc?.verified !== true) {
      return NextResponse.json({ error: "Ücretsiz hizmet müsaitliği için doktor doğrulaması (admin onayı) gereklidir." }, { status: 403 });
    }
  }
  await setDoctorAvailable(doctorId, available);

  let consultationId: string | null = null;
  if (available) {
    const m = await matchForDoctor(doctorId);
    consultationId = m?.consultationId ?? null;
  } else {
    // Çevrimdışı olundu → bu son müsait doktorse, havuzda bekleyen hastaları uyar
    await notifyStrandedWaiters();
  }

  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  return NextResponse.json({
    state: d?.freeCareState ?? "OFFLINE",
    quota: d ? quotaInfo(d) : null,
    consultationId,
  });
}
