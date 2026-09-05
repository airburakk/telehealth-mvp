// Deneme üyeliği e-posta şablonları — SAF modül (db/env yok; birim testte doğrudan render edilir).
// Gönderim lib/login-link.ts (giriş bağlantısı · mevcut hesap) ve lib/trial-sweep.ts (hatırlatma ·
// süre doldu · imha bildirimi) tarafından yapılır; bu dosya yalnız {subject, text, html} üretir.
//
// Biçim password-reset.ts e-postasıyla aynı dilde (düğme + yedek bağlantı + küçük gri not); görsel
// yok, inline CSS. Her şablon §2b altbilgisini (TRIAL_EMAIL_FOOTER) taşır — "deneme = yalnız doğrulama,
// ücretli üyeliğe dönüşmez" cümlesi hiçbir e-postada eksik kalmaz. Terim: "doktor" (hekim YAZILMAZ).
import { TRIAL_EMAIL_FOOTER } from "./doctorium-trial-copy";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BTN = "display:inline-block;background:#065f46;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600";
const NOTE = "font-size:12px;color:#64748b";

function compose(a: {
  subject: string;
  name: string;
  lead: string[]; // düz paragraflar (düğme öncesi)
  cta?: { label: string; url: string };
  tail?: string[]; // düğme sonrası paragraflar
}): RenderedEmail {
  const textParts = [`Merhaba ${a.name},`, "", ...a.lead.flatMap((p) => [p, ""])];
  if (a.cta) textParts.push(`${a.cta.label}: ${a.cta.url}`, "");
  for (const p of a.tail ?? []) textParts.push(p, "");
  textParts.push(TRIAL_EMAIL_FOOTER);

  const htmlParts = [`<p>Merhaba ${escapeHtml(a.name)},</p>`, ...a.lead.map((p) => `<p>${escapeHtml(p)}</p>`)];
  if (a.cta) {
    htmlParts.push(
      `<p><a href="${escapeHtml(a.cta.url)}" style="${BTN}">${escapeHtml(a.cta.label)}</a></p>`,
      `<p style="${NOTE}">Düğme çalışmazsa: ${escapeHtml(a.cta.url)}</p>`,
    );
  }
  for (const p of a.tail ?? []) htmlParts.push(`<p style="${NOTE}">${escapeHtml(p)}</p>`);
  htmlParts.push(`<p style="${NOTE}">${escapeHtml(TRIAL_EMAIL_FOOTER)}</p>`);

  return { subject: a.subject, text: textParts.join("\n"), html: htmlParts.join("") };
}

/** Parolasız giriş bağlantısı (deneme kaydı / yeniden giriş). */
export function renderLoginLinkEmail(a: { name: string; link: string; ttlMinutes: number }): RenderedEmail {
  return compose({
    subject: "Doctorium giriş bağlantınız",
    name: a.name,
    lead: ["Doctorium'a giriş yapmak için aşağıdaki bağlantıyı açın."],
    cta: { label: "Doctorium'a gir", url: a.link },
    tail: [
      `Bağlantı ${a.ttlMinutes} dakika geçerlidir ve yalnız bir kez kullanılabilir.`,
      "Bu isteği siz yapmadıysanız hiçbir şey yapmanıza gerek yok — bağlantı kullanılmadan geçersiz olur.",
    ],
  });
}

/** Bağlantı istenen adres parolalı/başka bir hesaba ait: token YOK, yalnız yol gösterir. */
export function renderExistingAccountEmail(a: { name: string; loginUrl: string; resetUrl: string }): RenderedEmail {
  return compose({
    subject: "Doctorium hesabınız zaten var",
    name: a.name,
    lead: [
      "Bu e-posta adresiyle Doctorium'da zaten bir hesap bulunuyor. Giriş bağlantısı yalnız parolasız açılan hesaplara gönderilir; hesabınıza parolanızla giriş yapabilirsiniz.",
    ],
    cta: { label: "Giriş yap", url: a.loginUrl },
    tail: [
      `Parolanızı unuttuysanız sıfırlayabilirsiniz: ${a.resetUrl}`,
      "Bu isteği siz yapmadıysanız hiçbir şey yapmanıza gerek yok.",
    ],
  });
}

/** Bitişe N gün kala hatırlatma (eşikler 7 · 3 · 1). */
export function renderTrialReminderEmail(a: { name: string; daysLeft: number; endsAtLabel: string; verifyUrl: string }): RenderedEmail {
  const gun = a.daysLeft === 1 ? "1 gün" : `${a.daysLeft} gün`;
  return compose({
    subject: `Deneme süreniz ${gun} sonra bitiyor — doğrulamayı tamamlayın`,
    name: a.name,
    lead: [
      `Doctorium deneme süreniz ${a.endsAtLabel} tarihinde sona eriyor (${gun} kaldı).`,
      "Üyeliğinizin kalıcı olması için e-Devlet barkodlu Mezun Belgenizi yükleyip doğrulamanız yeterli.",
    ],
    cta: { label: "Mezun belgemi doğrula", url: a.verifyUrl },
  });
}

/** Süre doldu — erişim kapandı, doğrulama yolu açık. */
export function renderTrialEndedEmail(a: { name: string; verifyUrl: string }): RenderedEmail {
  return compose({
    subject: "Deneme süreniz sona erdi",
    name: a.name,
    lead: [
      "Doctorium deneme süreniz sona erdi; portal erişiminiz doğrulama tamamlanana kadar kapalı.",
      "e-Devlet barkodlu Mezun Belgenizle doğrulama yaptığınız anda erişiminiz yeniden açılır.",
    ],
    cta: { label: "Mezun belgemi doğrula", url: a.verifyUrl },
  });
}

/** İmhadan 30 gün önce bildirim (KVKK saklama kuralı). */
export function renderTrialPurgeNoticeEmail(a: { name: string; purgeDateLabel: string; verifyUrl: string }): RenderedEmail {
  return compose({
    subject: "Doğrulanmayan hesabınız silinecek",
    name: a.name,
    lead: [
      `Deneme süreniz dolduğu ve doğrulama yapılmadığı için hesabınız ve Doctorium verileriniz ${a.purgeDateLabel} tarihinde silinecek.`,
      "Üyeliğinizi sürdürmek isterseniz o tarihe kadar e-Devlet barkodlu Mezun Belgenizle doğrulama yapmanız yeterli; hiçbir şey yapmazsanız hesabınız otomatik olarak silinir.",
    ],
    cta: { label: "Mezun belgemi doğrula", url: a.verifyUrl },
  });
}
