// Parolasız GİRİŞ BAĞLANTISI (Doctorium deneme üyeliği, 2026-09-05 — plan Faz A3).
//
// NEDEN VAR: deneme doktoru yalnız ad soyad + e-posta + branş + şehir ile kaydolur (👤 karar: parola
// yok). Kimlik = posta kutusu; bağlantı tıklanınca oturum açılır (Google/Apple ile aynı güven modeli).
//
// Token modeli password-reset.ts ile BİREBİR: 32 baytlık rastgele hex, DB'de yalnız sha256 hash'i
// (User.loginTokenHash), ham token yalnız e-postadaki bağlantıda; kullanımda hash NULL'lanır (tek
// kullanımlık, consume tarafında ATOMİK updateMany). Kolonlar AYRI (aynı desen, ayrı çift kuralı —
// doğrulama 24 s · sıfırlama 1 s · giriş bağlantısı 20 dk: TTL ve anlam farklı).
//
// 🔑 GÜVENLİK SINIRI: bağlantı YALNIZ parolası olmayan DOCTOR hesabına oturum açar (canUseLoginLink).
// Parolalı hesaba "posta kutusu = anında erişim" verilmez — reset-password'ün 2026-08-31 kararıyla
// tutarlı; o hesaplara token'sız bilgilendirme e-postası gider (giriş + parola sıfırlama yolu).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { sendEmail, isEmailConfigured } from "./email";
import { renderExistingAccountEmail, renderLoginLinkEmail } from "./trial-email";

export const LOGIN_LINK_TTL_MS = 20 * 60 * 1000; // 20 dk — sıfırlamadan (1 s) KISA: bağlantı oturum açar
export const LOGIN_LINK_COOLDOWN_MS = 2 * 60 * 1000; // yeniden-gönder soğuması: 2 dk

export function hashLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Sabit-zamanlı hash karşılaştırması + TTL denetimi. Hash/tarih yoksa DAİMA false. */
export function loginTokenMatches(
  row: { loginTokenHash: string | null; loginTokenSentAt: Date | null },
  token: string,
  now = new Date(),
): boolean {
  if (!row.loginTokenHash || !row.loginTokenSentAt) return false;
  if (!token || token.length < 32) return false;
  if (now.getTime() - row.loginTokenSentAt.getTime() > LOGIN_LINK_TTL_MS) return false;
  const a = Buffer.from(hashLoginToken(token), "hex");
  const b = Buffer.from(row.loginTokenHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function loginLinkCooldownActive(sentAt: Date | null, now = new Date()): boolean {
  return !!sentAt && now.getTime() - sentAt.getTime() < LOGIN_LINK_COOLDOWN_MS;
}

/** Bağlantı bu hesaba OTURUM AÇABİLİR mi: yalnız parolasız (gölge hash'li) DOCTOR, silinmemiş. */
export function canUseLoginLink(u: { role: string; passwordSetAt: Date | null; deletedAt: Date | null }): boolean {
  return u.role === "DOCTOR" && u.passwordSetAt === null && !u.deletedAt;
}

export function loginLinkChannelReady(): boolean {
  return isEmailConfigured();
}

/**
 * Token üret + kaydet + giriş bağlantısı e-postasını gönder. FIRE-SAFE ve SESSİZ: çağıran uç hesap
 * bulunsa da bulunmasa da AYNI yanıtı döndürür (hesap keşfi kapalı); hata yüzeye çıkmaz.
 */
export async function issueLoginLinkEmail(
  user: { id: string; email: string; name: string },
  origin: string,
): Promise<void> {
  try {
    const token = randomBytes(32).toString("hex");
    await db.user.update({
      where: { id: user.id },
      data: { loginTokenHash: hashLoginToken(token), loginTokenSentAt: new Date() },
    });
    const link = `${origin}/api/auth/verify-login-link?uid=${encodeURIComponent(user.id)}&token=${token}`;
    await sendEmail({ to: user.email, ...renderLoginLinkEmail({ name: user.name, link, ttlMinutes: LOGIN_LINK_TTL_MS / 60_000 }) });
  } catch (e) {
    console.warn("[login-link] giriş bağlantısı kurulamadı:", e instanceof Error ? e.message : e);
  }
}

/**
 * Adres parolalı ya da doktor-dışı bir hesaba ait: TOKEN ÜRETİLMEZ, yalnız yol gösteren e-posta.
 * loginTokenSentAt soğuma işareti olarak damgalanır (hash yazılmadığından oturum açma gücü yok).
 */
export async function issueExistingAccountEmail(
  user: { id: string; email: string; name: string },
  origin: string,
): Promise<void> {
  try {
    await db.user.update({ where: { id: user.id }, data: { loginTokenSentAt: new Date() } });
    await sendEmail({
      to: user.email,
      ...renderExistingAccountEmail({
        name: user.name,
        loginUrl: `${origin}/doctorium/giris`,
        resetUrl: `${origin}/sifremi-unuttum`,
      }),
    });
  } catch (e) {
    console.warn("[login-link] mevcut-hesap e-postası kurulamadı:", e instanceof Error ? e.message : e);
  }
}
