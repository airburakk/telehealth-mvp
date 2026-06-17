// Hasta↔vaka sahipliği — erişim kuralı tek yerde.
// PATIENT yalnız kendi vakasına erişir; doktor/koordinatör/etik/admin serbest (klinik personel).
import { getCurrentUser } from "./auth";
import type { SessionUser } from "./session";

export function ownsCase(user: SessionUser | null, c: { userId: string | null }): boolean {
  if (!user) return false;
  if (user.role !== "PATIENT") return true;
  return c.userId === user.id;
}

export async function canAccessCase(c: { userId: string | null }): Promise<boolean> {
  return ownsCase(await getCurrentUser(), c);
}

// İkinci Görüş vakası sahipliği (spec §8). PATIENT yalnız kendi vakasına; klinik personel
// (koordinatör/doktor/etik/admin) temel düzeyde erişir. NOT: DOCTOR'ın yalnız KENDİSİNE
// atanmış SO vakasını görmesi (§8) Faz 3'te sorgu seviyesinde (assignedDoctorId filtresi)
// uygulanır — bu yardımcı temel sahiplik kuralıdır (ownsCase deseniyle aynı).
export function ownsSecondOpinionCase(user: SessionUser | null, c: { patientId: string }): boolean {
  if (!user) return false;
  if (user.role !== "PATIENT") return true;
  return c.patientId === user.id;
}

export async function canAccessSecondOpinionCase(c: { patientId: string }): Promise<boolean> {
  return ownsSecondOpinionCase(await getCurrentUser(), c);
}
