// E-posta doğrulama akışı (Auth Faz 5, v5.6) — token üretimi/doğrulaması + doğrulama e-postası.
// Kural (kullanıcı kararı 2026-07-11): YENİ e-posta kayıtlarına zorunlu; mevcut hesaplar (demo dahil)
// migration'da damgalandı; Google girişleri doğrulanmış sayılır; RESEND_API_KEY yokken DORMANT
// (kayıt anında damgalanır → bugünkü davranış birebir sürer, kimse kilitlenmez).
//
// Token modeli: 32-byte rastgele hex, DB'de yalnız sha256 hash'i (User.emailVerifyTokenHash);
// bağlantı `/api/auth/verify-email?uid=<id>&token=<ham>`. TTL 24 saat (emailVerifySentAt tabanlı).
// Fire-safe: e-posta gönderilemezse kayıt akışı bozulmaz — kullanıcı girişte "yeniden gönder" ile kurtulur.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { sendEmail } from "./email";

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
export const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // yeniden-gönder soğuması: 2 dk

export function hashVerifyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Sabit-zamanlı hash karşılaştırması (token tahmini yan-kanalını kapatır).
export function verifyTokenMatches(row: { emailVerifyTokenHash: string | null; emailVerifySentAt: Date | null }, token: string, now = new Date()): boolean {
  if (!row.emailVerifyTokenHash || !row.emailVerifySentAt) return false;
  if (now.getTime() - row.emailVerifySentAt.getTime() > VERIFY_TOKEN_TTL_MS) return false; // süresi dolmuş
  const a = Buffer.from(hashVerifyToken(token), "hex");
  const b = Buffer.from(row.emailVerifyTokenHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Yeni token üret + kaydet + doğrulama e-postasını gönder. Fire-safe (hata akışı bozmaz).
export async function issueVerificationEmail(
  user: { id: string; email: string; name: string },
  origin: string,
): Promise<void> {
  try {
    const token = randomBytes(32).toString("hex");
    await db.user.update({
      where: { id: user.id },
      data: { emailVerifyTokenHash: hashVerifyToken(token), emailVerifySentAt: new Date() },
    });
    const link = `${origin}/api/auth/verify-email?uid=${encodeURIComponent(user.id)}&token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "E-posta adresinizi doğrulayın — AURA",
      text:
        `Merhaba ${user.name},\n\n` +
        `AURA hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın:\n${link}\n\n` +
        `Bağlantı 24 saat geçerlidir. Bu kaydı siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.`,
      html:
        `<p>Merhaba ${escapeHtml(user.name)},</p>` +
        `<p>AURA hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın:</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#14C3D0;color:#101010;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">E-postamı doğrula</a></p>` +
        `<p style="font-size:12px;color:#64748b">Bağlantı 24 saat geçerlidir. Düğme çalışmazsa: <br>${link}</p>` +
        `<p style="font-size:12px;color:#64748b">Bu kaydı siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
    });
  } catch (e) {
    console.warn("[email-verification] doğrulama e-postası kurulamadı (akış bozulmaz):", e instanceof Error ? e.message : e);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
