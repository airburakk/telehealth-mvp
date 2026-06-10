// Oturum token mantığı — edge-güvenli (yalnız jose, next/headers YOK)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "air_session";

export type Role = "PATIENT" | "DOCTOR" | "COORDINATOR" | "ETHICS" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || "air-mvp-dev-secret");

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
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
};

export function roleHome(role: Role): string {
  if (role === "COORDINATOR") return "/operasyon"; // S2 operasyon paneli
  if (role === "DOCTOR") return "/doktor";
  if (role === "ETHICS") return "/etik-kurul";
  return "/triyaj";
}
