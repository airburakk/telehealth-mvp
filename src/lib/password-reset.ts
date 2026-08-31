// Parola sıfırlama akışı ("şifremi unuttum", v6.194) — token üretimi/doğrulaması + e-posta.
//
// NEDEN VAR: v6.187 parola DEĞİŞTİRME'yi getirdi ama o oturum açmayı gerektirir. Parolasını
// unutan üye giriş yapamıyor ve kendini kurtaramıyordu — destek kanalı da olmadığı için gerçek
// bir kilitlenme. Bu modül o boşluğu kapatır.
//
// Token modeli (kullanıcı kararı 2026-08-31: DB kolonu, imzalı/stateless token DEĞİL):
// e-posta doğrulamasıyla (lib/email-verification.ts) BİREBİR aynı desen — 32 baytlık rastgele
// hex, DB'de yalnız sha256 hash'i (`User.passwordResetTokenHash`), ham token yalnız e-postadaki
// bağlantıda. Kullanımda hash NULL'lanır → TEK KULLANIMLIK.
//
// ⚠️ TTL doğrulamadan KISA (24 saat değil 1 saat): sıfırlama bağlantısı hesabı devralmaya yeter,
// doğrulama bağlantısı yetmez. Bu yüzden alanlar da AYRI (bkz. migration notu) — paylaşılsalardı
// doğrulama e-postası bekleyen sıfırlamayı sessizce geçersizleştirirdi.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { sendEmail, isEmailConfigured } from "./email";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 saat
export const RESET_COOLDOWN_MS = 2 * 60 * 1000; // yeniden-gönder soğuması: 2 dk

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Sabit-zamanlı hash karşılaştırması + TTL denetimi (token tahmini yan-kanalını kapatır).
 * Hash yoksa (token kullanılmış ya da hiç istenmemiş) DAİMA false.
 */
export function resetTokenMatches(
  row: { passwordResetTokenHash: string | null; passwordResetSentAt: Date | null },
  token: string,
  now = new Date(),
): boolean {
  if (!row.passwordResetTokenHash || !row.passwordResetSentAt) return false;
  if (now.getTime() - row.passwordResetSentAt.getTime() > RESET_TOKEN_TTL_MS) return false;
  const a = Buffer.from(hashResetToken(token), "hex");
  const b = Buffer.from(row.passwordResetTokenHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Soğuma penceresi: aynı hesap için arka arkaya e-posta yağmuru olmasın. */
export function resetCooldownActive(sentAt: Date | null, now = new Date()): boolean {
  return !!sentAt && now.getTime() - sentAt.getTime() < RESET_COOLDOWN_MS;
}

/**
 * Token üret + kaydet + sıfırlama e-postasını gönder.
 *
 * ⚠️ ÇAĞIRAN SÖZLEŞMESİ: bu fonksiyon "kullanıcı var mı" bilgisini DIŞARI SIZDIRMAZ — çağıran uç
 * hesap bulunsa da bulunmasa da AYNI yanıtı döndürmelidir (hesap sayımı/keşfi engellenir).
 * Fire-safe: e-posta gönderilemezse istisna fırlatmaz (yine sızıntı olurdu).
 */
export async function issuePasswordResetEmail(
  user: { id: string; email: string; name: string },
  origin: string,
): Promise<void> {
  try {
    const token = randomBytes(32).toString("hex");
    await db.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: hashResetToken(token), passwordResetSentAt: new Date() },
    });
    const link = `${origin}/sifre-sifirla?uid=${encodeURIComponent(user.id)}&token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Parolanızı sıfırlayın",
      text:
        `Merhaba ${user.name},\n\n` +
        `Parolanızı sıfırlamak için aşağıdaki bağlantıyı açın:\n${link}\n\n` +
        `Bağlantı 1 saat geçerlidir ve yalnız bir kez kullanılabilir.\n` +
        `Bu isteği siz yapmadıysanız hiçbir şey yapmanıza gerek yok — parolanız değişmez.`,
      html:
        `<p>Merhaba ${escapeHtml(user.name)},</p>` +
        `<p>Parolanızı sıfırlamak için aşağıdaki bağlantıyı açın:</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#065f46;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Parolamı sıfırla</a></p>` +
        `<p style="font-size:12px;color:#64748b">Bağlantı 1 saat geçerlidir ve yalnız bir kez kullanılabilir. Düğme çalışmazsa:<br>${link}</p>` +
        `<p style="font-size:12px;color:#64748b">Bu isteği siz yapmadıysanız hiçbir şey yapmanıza gerek yok — parolanız değişmez.</p>`,
    });
  } catch (e) {
    // Sessiz kalmak ZORUNLU: hata yüzeye çıksaydı "bu e-posta kayıtlı" bilgisini sızdırırdı.
    console.warn("[password-reset] sıfırlama e-postası kurulamadı:", e instanceof Error ? e.message : e);
  }
}

/**
 * E-posta kanalı kapalıyken akış ÇALIŞAMAZ (bağlantı teslim edilemez). Kullanıcı kararı
 * 2026-08-31: bu durumda "gönderildi" DEME — dürüst uyarı göster. Kanal durumu SİSTEM
 * bilgisidir, hesaba özgü değil; söylemek hesap keşfine yaramaz.
 */
export function passwordResetChannelReady(): boolean {
  return isEmailConfigured();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
