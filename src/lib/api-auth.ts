// Hafif API auth yardımcıları (T1) — route-içi auth tek-satır kapı.
// proxy/middleware /api'yi KORUMAZ → her /api route'u kendi auth'unu yapmalı ([[api-routes-need-self-auth]]).
// Kullanım:
//   const { user, error } = await requireUser();  if (error) return error;
//   const { error } = await requireStaff();        if (error) return error;
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { Role, SessionUser } from "./session";

// Klinik personel = hasta verisi kuyruğuna erişebilen roller. PATIENT + PARTNER HARİÇ
// (hasta yalnız kendi vakası; PARTNER'ın hasta DB erişimi yok).
export const STAFF_ROLES: Role[] = ["DOCTOR", "COORDINATOR", "ETHICS", "ADMIN"];

type Ok = { user: SessionUser; error: null };
type Err = { user: null; error: NextResponse };

// Kimlik şart: oturum yoksa 401.
export async function requireUser(): Promise<Ok | Err> {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }) };
  return { user, error: null };
}

// Kimlik + klinik personel rolü şart: oturum yoksa 401, personel değilse 403.
export async function requireStaff(): Promise<Ok | Err> {
  const r = await requireUser();
  if (r.error) return r;
  if (!STAFF_ROLES.includes(r.user.role)) {
    return { user: null, error: NextResponse.json({ error: "Bu kaynağa erişim yetkiniz yok." }, { status: 403 }) };
  }
  return r;
}
