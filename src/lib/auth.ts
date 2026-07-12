// Sunucu tarafı auth yardımcıları (Node runtime — cookie + bcrypt + DB oturum-sürümü)
import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, signToken, verifyToken, type SessionUser, type Role } from "./session";

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function checkPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function createSession(user: SessionUser, opts?: { preserveSv?: boolean }): Promise<void> {
  // sv (oturum sürümü) VARSAYILAN olarak burada DB'den TAZE çekilir — taze-kimlik mint noktaları
  // (login/signup/OAuth callback) güncel sv ile imzalamalı (çağırana bırakılsaydı unutulan sv=0,
  // bump yapılmış kullanıcıyı login döngüsüne sokardı).
  //
  // preserveSv: onam re-sign yolu (consent) — getCurrentUser'ın ZATEN doğruladığı `user.sv` KORUNUR,
  // DB'den ikinci okuma YAPILMAZ. Aksi halde consent'in kimlik-doğrulama (ToC: getCurrentUser sv'yi
  // doğrular) ile bu DB-okuması (ToU) arasına eşzamanlı logout-all düşerse iptal edilen oturum taze
  // token'a "yükseltilir" (TOCTOU iptal-kaçışı). sv korunursa: bump ToC sonrası olursa yeni token eski
  // sv taşır → sonraki istekte getCurrentUser reddeder (oturum iptalli kalır); ToC öncesi olursa
  // getCurrentUser zaten 401 verir, mint hiç olmaz. Yarış-dışı "diriltme" kusurunu da kapatır.
  const sv = opts?.preserveSv
    ? user.sv ?? 0
    : (await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true } }))?.sessionVersion ?? 0;
  const token = await signToken({ ...user, sv });
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

// Oturum iptali primitifi ("session tablosu" ilkesi, tek nokta): User.sessionVersion'ı artırır →
// bu kullanıcının dolaşımdaki TÜM token'larının sv claim'i bayatlar, getCurrentUser hepsini reddeder.
// logout-all bunu çağırır; gelecekteki rol düşürme / parola değişikliği akışları da buradan iptal
// etmeli (rol düşürünce token'ı zorla tazele — kullanıcı yeniden giriş yapıp güncel rolle imzalanır).
export async function revokeUserSessions(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

// JWT iptal kontrolü (P1) + rol kaynağı DB (rol bayatlığı kapatma, 2026-07-12): token'daki sv,
// User.sessionVersion ile karşılaştırılır — uyuşmazsa oturum geçersiz (logout-all bump'lar). AYNI
// PK sorgusunda ROL de çekilir ve DB rolü otoriter kabul edilir: rol token'dan okunsaydı DB'de
// değişse bile token TTL'i (7 gün) kadar bayat kalırdı; artık her istekte taze. cache() aynı istek
// içinde layout+page+route çağrılarını TEK sorguya indirir. Proxy bilinçli DB'siz kalır (bkz.
// src/proxy.ts) → iptal/rol-değişmiş token sayfa KABUĞUNA gelebilir ama veri katmanı burada reddeder.
// (Onam `cv`: proxy token cv'siyle CONSENT_VERSION'ı karşılar; sürüm artınca eski token /onam'a
// düşer → yeniden onam → taze token. Bu ileri-yön yeterli olduğundan her isteğe ConsentRecord
// sorgusu EKLENMEZ; onam sayfası zaten hasCurrentConsent ile DB-taze doğrular.)
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  const rec = await db.user.findUnique({ where: { id: user.id }, select: { sessionVersion: true, role: true } });
  if (!rec) return null; // kullanıcı silinmiş → oturum geçersiz
  if ((user.sv ?? 0) !== rec.sessionVersion) return null; // iptal edilmiş token
  return { ...user, role: rec.role as Role }; // DB rolü otoriter (token rolü yalnız imza taşıyıcısı)
});
