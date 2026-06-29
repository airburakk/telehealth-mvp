// Sunucu tarafı auth yardımcıları (Node runtime — cookie + bcrypt)
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, signToken, verifyToken, type SessionUser } from "./session";

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function checkPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signToken(user);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // T5: HTTPS-only (üretim); dev http localhost'ta kapalı
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
