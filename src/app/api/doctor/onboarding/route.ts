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
  // v6.105 — İkinci Görüş + Sağlık Turizmi tercihleri (kullanıcı kararı 2026-08-17).
  // ⚠️ soOptIn ünvan kapısını AŞMAZ: burada yalnız DİLEK kaydedilir; panelin açılıp açılmadığına
  // panelVisibility'deki soEligible(title) && soOptIn karar verir. Ünvansız doktor bu alanı true
  // gönderse bile (arayüz kartı devre dışı olsa da API'ye doğrudan istek atılabilir) panel açılmaz
  // — kapı tek yerde, veri katmanında değil karar katmanında.
  const soOptIn = b.soOptIn === true;
  const tourismOptIn = b.tourismOptIn === true;

  // Zorunlu mesleki belge (v6.105'ten beri yalnız diploma; MMSS ihtiyari) tamamlanmadan onboarding
  // bitirilemez → hesap aktifleşmez. (Sonradan /doktor/profil'den gelen opt-in güncellemeleri bu
  // kapıdan geçmez: yalnız ilk onboarding'de, onboardedAt henüz yokken zorunlu.)
  const current = await db.doctor.findUnique({
    where: { id: dbUser.doctorId },
    select: {
      onboardedAt: true, mmssInsurer: true, mmssPolicyNo: true, mmssCoverageLimit: true,
      procedures: true, licenseNo: true, specBoard: true,
      branch: true, city: true, // v6.87: OAuth hesabı boş açılır — finish kimlik olmadan bitirilemez
    },
  });
  if (!current?.onboardedAt) {
    const docs = await db.doctorDocument.findMany({ where: { doctorId: dbUser.doctorId }, select: { type: true } });
    const data = current ?? {
      mmssInsurer: null, mmssPolicyNo: null, mmssCoverageLimit: null,
      procedures: null, licenseNo: null, specBoard: null, branch: "", city: "",
    };
    // Zorunlu belgeler (v6.105: yalnız diploma) + ≥1 işlem + FHIR qualification
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
      soOptIn,
      tourismOptIn,
      onboardedAt: current?.onboardedAt ?? new Date(),
      // Belgeler tamsa aktivasyon damgasını da garanti et (refreshActivation belge API'lerinde de çalışır).
      activatedAt: current?.onboardedAt ? undefined : new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
