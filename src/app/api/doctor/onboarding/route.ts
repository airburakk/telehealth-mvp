import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/doctor/onboarding — M5 ilk-giriş onboarding kapısı + sonradan opt-in güncelleme.
// Hekim, Pro Bono ve Partner Konsültasyon taleplerine katılıp katılmayacağını seçer.
// İlk çağrıda onboardedAt damgalanır (kapı bir daha gösterilmez). Sonraki çağrılar opt-in günceller.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir hekim profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const proBonoOptIn = b.proBonoOptIn === true;
  const consultOptIn = b.consultOptIn === true;

  // İlk onboarding damgası sabit kalsın: yalnız henüz onboard olmamışsa now() yaz (sonraki opt-in
  // güncellemeleri /doktor/profil'den gelir ve damgayı değiştirmez).
  const current = await db.doctor.findUnique({ where: { id: dbUser.doctorId }, select: { onboardedAt: true } });

  await db.doctor.update({
    where: { id: dbUser.doctorId },
    data: { proBonoOptIn, consultOptIn, onboardedAt: current?.onboardedAt ?? new Date() },
  });

  return NextResponse.json({ ok: true });
}
