import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  issuePasswordResetEmail,
  passwordResetChannelReady,
  resetCooldownActive,
} from "@/lib/password-reset";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/auth/forgot-password — "şifremi unuttum" isteği (v6.194). Oturum GEREKMEZ.
//
// 🔒 HESAP KEŞFİ (enumeration) KAPALI: hesap bulunsa da bulunmasa da AYNI yanıt döner. Bu yüzden
// aşağıda "kullanıcı yok" için ERKEN DÖNÜŞ YOK, hata da yüzeye çıkmaz — issuePasswordResetEmail
// kendi içinde fire-safe. Yanıt gövdesi de, HTTP durumu da, gecikme sınıfı da ayrışmamalı.
//
// ⚠️ TEK İSTİSNA — e-posta kanalı dormant: bağlantı teslim EDİLEMEZ, "gönderildi" demek yalan
// olurdu (vitrin iddia dürüstlüğü kuralı). Kanal durumu SİSTEM bilgisidir, hesaba özgü değil →
// söylemek keşfe yaramaz. Kullanıcı kararı 2026-08-31: dürüst uyarı göster.
export async function POST(req: Request) {
  // Kötüye kullanım freni ÖNCE: IP başına 5/15dk. E-posta gönderimi pahalı ve dışa dönüktür;
  // ayrıca hesap-keşfi denemesi de bu frene takılır.
  const rl = await rateLimit(`forgot-password:${clientIp(req)}`, 5, 15 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 160);

  if (!passwordResetChannelReady()) {
    return NextResponse.json({ ok: false, channelDormant: true }, { status: 503 });
  }

  if (email.includes("@")) {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, deletedAt: true, passwordResetSentAt: true },
    });
    // Silinmiş hesap (KVKK kabuğu) sıfırlama ALMAZ — kabuğun parolası yeniden kurulamamalı.
    // Soğuma: aynı adrese 2 dakikada birden fazla bağlantı gitmez (posta kutusu yağmuru).
    if (user && !user.deletedAt && !resetCooldownActive(user.passwordResetSentAt)) {
      const origin = new URL(req.url).origin;
      await issuePasswordResetEmail({ id: user.id, email: user.email, name: user.name }, origin);
    }
  }

  // DAİMA aynı yanıt (yukarıdaki dallardan hangisi koştuğuna bakılmaz).
  return NextResponse.json({ ok: true });
}
