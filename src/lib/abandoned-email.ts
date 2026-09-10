// Terk edilmiş hesap bildirimi e-postası (05 madde 3.1b, Paket 2 — 2026-09-09) — SAF modül
// (db/env yok; birim testte doğrudan render edilir). trial-email.ts'teki compose() deseniyle AYNI
// biçim (düğme + yedek bağlantı + küçük gri not) ama AYRI dosya: TRIAL_EMAIL_FOOTER ("deneme =
// yalnız doğrulama, ücretli üyeliğe dönüşmez") bu bağlamda YANLIŞ olurdu — muhatap zaten
// doğrulanmış tam üye, deneme kullanıcısı değil.
export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BTN = "display:inline-block;background:#065f46;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600";
const NOTE = "font-size:12px;color:#64748b";

/** İmhadan 30 gün önce bildirim — son giriş üzerinden 3 yıl dolan doğrulanmış üye. */
export function renderAbandonedNoticeEmail(a: { name: string; purgeDateLabel: string; loginUrl: string }): RenderedEmail {
  const lead = [
    `Doctorium hesabınıza uzun süredir giriş yapılmadığı için, hesabınız ve Doctorium verileriniz ${a.purgeDateLabel} tarihinde silinecek.`,
    "Üyeliğinizi sürdürmek isterseniz o tarihe kadar giriş yapmanız yeterli; hiçbir şey yapmazsanız hesabınız otomatik olarak silinir.",
  ];
  const text = [`Merhaba ${a.name},`, "", ...lead.flatMap((p) => [p, ""]), `Giriş yap: ${a.loginUrl}`].join("\n");
  const html = [
    `<p>Merhaba ${escapeHtml(a.name)},</p>`,
    ...lead.map((p) => `<p>${escapeHtml(p)}</p>`),
    `<p><a href="${escapeHtml(a.loginUrl)}" style="${BTN}">Giriş yap</a></p>`,
    `<p style="${NOTE}">Düğme çalışmazsa: ${escapeHtml(a.loginUrl)}</p>`,
  ].join("");
  return { subject: "Doctorium hesabınız 30 gün içinde silinecek", text, html };
}
