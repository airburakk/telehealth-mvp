// Oturum token mantığı — edge-güvenli (yalnız jose, next/headers YOK)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "air_session";

export type Role = "PATIENT" | "DOCTOR" | "COORDINATOR" | "ETHICS" | "ADMIN" | "PARTNER";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  cv?: number; // onaylanan KVKK onam sürümü (consented version); 0/undefined = onam yok
}

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "air-mvp-dev-secret");

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role, cv: user.cv ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      cv: Number(payload.cv ?? 0),
    };
  } catch {
    return null;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
};

export function roleHome(role: Role): string {
  if (role === "COORDINATOR") return "/operasyon"; // S2 operasyon paneli
  if (role === "DOCTOR") return "/doktor";
  if (role === "ETHICS") return "/etik-kurul";
  if (role === "PARTNER") return "/partner"; // M5 Faz 3 — Partner Doktor alanı
  return "/vakalarim"; // hasta: kendi vakaları
}
