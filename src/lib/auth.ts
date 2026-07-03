// Sunucu tarafı auth yardımcıları (Node runtime — cookie + bcrypt + DB oturum-sürümü)
import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, signToken, verifyToken, type SessionUser } from "./session";

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function checkPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  // sv (oturum sürümü) MERKEZİ olarak burada DB'den çekilir — 4 mint noktası (login/signup/
  // OAuth callback/onam re-sign) değişmeden doğru sv ile imzalar. Çağırana bırakılsaydı
  // onam re-sign'da unutulan sv=0, bump yapılmış kullanıcıyı login döngüsüne sokardı.
  const rec = await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } });
  const token = await signToken({ ...user, sv: rec?.sessionVersion ?? 0 });
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

// JWT iptal kontrolü (P1): token'daki sv, User.sessionVersion ile karşılaştırılır — uyuşmazsa
// oturum geçersiz (logout-all / gelecekte şifre değişikliği bump'lar). cache() aynı istek içinde
// layout+page+route çağrılarını TEK PK sorgusuna indirir. Proxy bilinçli DB'siz kalır (bkz.
// src/proxy.ts) → iptal edilen token sayfa kabuğuna gelebilir ama veri katmanı burada reddeder.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  const rec = await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } });
  if (!rec) return null; // kullanıcı silinmiş → oturum geçersiz
  if ((user.sv ?? 0) !== rec.sessionVersion) return null; // iptal edilmiş token
  return user;
});
