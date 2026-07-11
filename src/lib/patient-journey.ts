import { db } from "@/lib/db";

// /basla 4'lü seçim ekranı kaldırıldı (2026-07-12): User.patientJourney artık hastanın fiilen
// başvurduğu akışta damgalanır (daha doğru sinyal — seçim beyanı değil, gerçek başvuru).
// Nav bileşimi (lib/nav.ts) bu değere bakar. Yalnız hasta hesabında yazılır; hata yutulur —
// journey damgası vaka oluşturmayı asla düşürmez.
export type PatientJourney = "GENERAL" | "SECOND_OPINION" | "FREE_CARE" | "HEALTH_TOURISM";

export async function stampPatientJourney(userId: string, role: string, journey: PatientJourney): Promise<void> {
  if (role !== "PATIENT") return;
  try {
    await db.user.update({ where: { id: userId }, data: { patientJourney: journey } });
  } catch {
    /* sessiz — nav bileşimi bir sonraki başvuruda düzelir */
  }
}
