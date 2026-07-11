// E-posta gönderimi — DORMANT sağlayıcı katmanı (Auth Faz 5, 2026-07-11).
// Sağlayıcı: Resend (https://resend.com). RESEND_API_KEY yokken gönderim SİMÜLE edilir (iz log'a
// düşer, akış bozulmaz) — Google OAuth / lib/messaging.ts "dormant" deseninin aynısı. Anahtar
// eklendiğinde gerçek gönderim kod değişikliği olmadan başlar (Resend çağrısı burada TAMAMDIR).
//
// EMAIL_FROM: doğrulanmış domain'den gönderici (ör. "AURA <no-reply@ornek.com>"). Boşsa Resend'in
// test göndericisi kullanılır ("onboarding@resend.dev") — Resend testte yalnız hesap sahibinin
// e-postasına gönderir; gerçek kullanım için domain DNS doğrulaması şart (aktivasyon adımı).
//
// Fire-safe: gönderim hatası çağıran akışı (kayıt/yeniden-gönder) ASLA bozmaz.
// PHI: doğrulama e-postaları yalnız bağlantı içerir — klinik veri/isim gömülmez.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSendResult {
  sent: boolean;      // gerçek sağlayıcıya gitti mi
  simulated: boolean; // env yok → simülasyon izi
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    // DORMANT: Resend anahtarı yok → simülasyon izi (alıcı maskeli, içerik loglanmaz)
    console.log(`[email] (simülasyon) → ${maskEmail(msg.to)}: ${msg.subject}`);
    return { sent: false, simulated: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "AURA <onboarding@resend.dev>",
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[email] Resend ${res.status} → ${maskEmail(msg.to)} (akış bozulmaz): ${detail.slice(0, 200)}`);
      return { sent: false, simulated: false };
    }
    return { sent: true, simulated: false };
  } catch (e) {
    console.warn("[email] gönderim başarısız (akış bozulmaz):", e instanceof Error ? e.message : e);
    return { sent: false, simulated: false };
  }
}

// Log'a tam adres yazma — kullanıcı adının ilk 2 karakteri + domain açık.
function maskEmail(e: string): string {
  const [user, domain] = e.split("@");
  if (!domain) return "***";
  return `${(user ?? "").slice(0, 2)}***@${domain}`;
}
