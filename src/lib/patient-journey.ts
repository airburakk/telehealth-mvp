import { db } from "@/lib/db";
import { encryptField } from "@/lib/crypto";

// /basla 4'lü seçim ekranı kaldırıldı (2026-07-12): User.patientJourney artık hastanın fiilen
// başvurduğu akışta damgalanır (daha doğru sinyal — seçim beyanı değil, gerçek başvuru).
// Nav bileşimi (lib/nav.ts) bu değere bakar.
//
// Profil hafızası (basitleştirme Faz 0): intake'te girilen ülke/dil/telefon/iletişim tercihi de
// aynı damgada User'a yaz-geri edilir ("bir kez sor, her yerde kullan"; son değer kazanır) —
// sonraki intake'ler prefill eder. Telefon KİMLİK verisi → at-rest ŞİFRELİ yazılır.
// Yalnız hasta hesabında yazılır; hata yutulur — damga vaka oluşturmayı asla düşürmez.
export type PatientJourney = "GENERAL" | "SECOND_OPINION" | "FREE_CARE" | "HEALTH_TOURISM";

export interface PatientProfileStamp {
  journey: PatientJourney;
  country?: string | null; // ISO kodu (DZ, TR, ...)
  language?: string | null; // dil ADI (air_lang sözlüğü)
  phone?: string | null; // DÜZ metin gelir — burada şifrelenir
  contactPref?: string | null; // APP | SMS | EMAIL
}

// Dönen hasta iniş noktası (basitleştirme Faz 5, 2026-07-12): başvurusu OLAN hasta girişte vaka
// merkezine iner (SO-yolculuğundaysa SO listesine — nav bileşimiyle aynı eşleme); hiç başvurusu
// olmayan doğrudan Branş Doktoru akışına (/triyaj). roleHome'un PATIENT dalının dinamik hali —
// sync çağıranlar (statik fallback) roleHome'da kalır.
export async function patientHome(userId: string): Promise<string> {
  try {
    const [u, caseCount, soCount] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { patientJourney: true } }),
      db.case.count({ where: { userId } }),
      db.secondOpinionCase.count({ where: { patientId: userId } }),
    ]);
    if (u?.patientJourney === "SECOND_OPINION" && soCount > 0) return "/second-opinion/vakalarim";
    if (caseCount > 0 || soCount > 0) return "/vakalarim";
  } catch {
    /* sorgu düşerse güvenli varsayılan */
  }
  return "/triyaj";
}

export async function stampPatientProfile(userId: string, role: string, stamp: PatientProfileStamp): Promise<void> {
  if (role !== "PATIENT") return;
  const data: Record<string, string> = { patientJourney: stamp.journey };
  if (stamp.country?.trim()) data.patientCountry = stamp.country.trim();
  if (stamp.language?.trim()) data.patientLanguage = stamp.language.trim();
  if (stamp.phone?.trim()) data.patientPhone = encryptField(stamp.phone.trim());
  if (stamp.contactPref?.trim()) data.patientContactPref = stamp.contactPref.trim();
  try {
    await db.user.update({ where: { id: userId }, data });
  } catch {
    /* sessiz — profil/nav bir sonraki başvuruda düzelir */
  }
}
