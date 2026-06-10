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
