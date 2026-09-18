// AURA pasiflik bildirimi e-postası (A06 madde 3.1b · A01 madde 8, kod Paket C — 2026-09-18) — SAF modül
// (db/env yok; birim testte doğrudan render edilir). lib/abandoned-email.ts'in (Doctorium) AURA eşleniği, AYRI
// dosya: marka adı, giriş bağlantısı ve hukuki dayanak satırı farklı; ayrıca hasta kitlesi çok dilli olduğu için
// TR (kanonik) + EN (ikinci kanonik — S4) iki metin taşır. Diğer arayüz dillerinde EN gönderilir (consent-lang deseni:
// Türkçe → TR, aksi hâlde EN); hasta yüzündeki diğer 7 dil için ayrı çeviri YOK (bilinçli — e-posta hash'lenmez ama
// hukuki bir bildirimdir, makine çevirisiyle gönderilmez).
import type { ConsentLang } from "./consent-lang";
import type { RenderedEmail } from "./abandoned-email";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BTN = "display:inline-block;background:#0f766e;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600";
const NOTE = "font-size:12px;color:#64748b";

/** EN tarih etiketi — abandoned-sweep formatDateTr'nin eşleniği ("18 September 2029"). */
export function formatDateEn(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const COPY: Record<
  ConsentLang,
  { subject: string; greeting: (name: string) => string; lead: (purgeDateLabel: string) => string[]; button: string; fallback: string; basis: string }
> = {
  tr: {
    subject: "AURA hesabınız 30 gün içinde silinecek",
    greeting: (name) => `Merhaba ${name},`,
    lead: (d) => [
      `AURA hesabınıza uzun süredir giriş yapılmadığı için hesabınız ve profil bilgileriniz ${d} tarihinde silinecek.`,
      "Hesabınızı sürdürmek isterseniz o tarihe kadar giriş yapmanız yeterli; hiçbir şey yapmazsanız hesabınız otomatik olarak silinir.",
    ],
    button: "Giriş yap",
    fallback: "Düğme çalışmazsa",
    basis: "Bu bildirim, AURA Aydınlatma Metni'nin saklama süreleri bölümünde yazılı üç yıl kuralı gereği gönderilmiştir.",
  },
  en: {
    subject: "Your AURA account will be deleted in 30 days",
    greeting: (name) => `Hello ${name},`,
    lead: (d) => [
      `Because your AURA account has not been signed in to for a long time, your account and profile details will be deleted on ${d}.`,
      "To keep your account, simply sign in before that date; if you do nothing, your account will be deleted automatically.",
    ],
    button: "Sign in",
    fallback: "If the button does not work",
    basis: "This notice is sent under the three-year rule set out in the retention periods section of the AURA Privacy Notice.",
  },
};

/** İmhadan 30 gün önce bildirim — son girişten (hiç giriş yoksa kayıttan) 3 yıl dolan hesap-yalnız hasta/personel. */
export function renderAuraAbandonedNoticeEmail(a: {
  name: string;
  purgeDateLabel: string;
  loginUrl: string;
  lang: ConsentLang;
}): RenderedEmail {
  const c = COPY[a.lang];
  const lead = c.lead(a.purgeDateLabel);
  const text = [c.greeting(a.name), "", ...lead.flatMap((p) => [p, ""]), `${c.button}: ${a.loginUrl}`, "", c.basis].join("\n");
  const html = [
    `<p>${escapeHtml(c.greeting(a.name))}</p>`,
    ...lead.map((p) => `<p>${escapeHtml(p)}</p>`),
    `<p><a href="${escapeHtml(a.loginUrl)}" style="${BTN}">${escapeHtml(c.button)}</a></p>`,
    `<p style="${NOTE}">${escapeHtml(c.fallback)}: ${escapeHtml(a.loginUrl)}</p>`,
    `<p style="${NOTE}">${escapeHtml(c.basis)}</p>`,
  ].join("");
  return { subject: c.subject, text, html };
}
