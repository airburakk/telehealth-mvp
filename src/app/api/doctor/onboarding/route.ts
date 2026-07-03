import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCompleteOnboarding, missingOnboardingSteps } from "@/lib/doctor-activation";

// POST /api/doctor/onboarding — M5 ilk-giriş onboarding kapısı + sonradan opt-in güncelleme.
// Doktor, Ücretsiz Sağlık Hizmeti ve Partner Konsültasyon taleplerine katılıp katılmayacağını seçer.
// İlk çağrıda onboardedAt damgalanır (kapı bir daha gösterilmez). Sonraki çağrılar opt-in günceller.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir doktor profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const freeCareOptIn = b.freeCareOptIn === true;
  const consultOptIn = b.consultOptIn === true;

  // Zorunlu mesleki belgeler (diploma + MMSS) ve MMSS metadata tamamlanmadan onboarding bitirilemez
  // → hesap aktifleşmez. (Sonradan /doktor/profil'den gelen opt-in güncellemeleri bu kapıdan geçmez:
  // yalnız ilk onboarding'de, onboardedAt henüz yokken zorunlu.)
  const current = await db.doctor.findUnique({
    where: { id: dbUser.doctorId },
    select: {
      onboardedAt: true, mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true,
      procedures: true, licenseNo: true, specBoard: true,
    },
  });
  if (!current?.onboardedAt) {
    const docs = await db.doctorDocument.findMany({ where: { doctorId: dbUser.doctorId }, select: { type: true } });
    const data = current ?? { mmssInsurer: null, mmssPolicyNo: null, mmssCoverageLimit: null, procedures: null, licenseNo: null, specBoard: null };
    // Zorunlu belgeler (diploma + MMSS) + MMSS metadata + ≥1 işlem/ücret + FHIR qualification
    // (diploma/tescil no + uzmanlık belgesi) tamamlanmadan onboarding bitirilemez → hesap aktifleşmez.
    if (!canCompleteOnboarding(docs, data)) {
      return NextResponse.json(
        { error: "Hesabınızı aktifleştirmek için zorunlu adımları tamamlayın.", missing: missingOnboardingSteps(docs, data) },
        { status: 409 },
      );
    }
  }

  // İlk onboarding damgası sabit kalsın: yalnız henüz onboard olmamışsa now() yaz (sonraki opt-in
  // güncellemeleri /doktor/profil'den gelir ve damgayı değiştirmez).
  await db.doctor.update({
    where: { id: dbUser.doctorId },
    data: {
      freeCareOptIn,
      consultOptIn,
      onboardedAt: current?.onboardedAt ?? new Date(),
      // Belgeler tamsa aktivasyon damgasını da garanti et (refreshActivation belge API'lerinde de çalışır).
      activatedAt: current?.onboardedAt ? undefined : new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
