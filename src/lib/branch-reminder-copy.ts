// Branşı sınıflandırılmamış üyeye giden uyarı — SAF modül (db/env YOK): metin, gönderim kuralı, e-posta şablonu.
// Gönderen: lib/branch-reminder.ts (trial-sweep cron'una bağlı, her gün 10:20 TR). 👤 metin + kural onayı 2026-10-06.
//
// KURAL: uyarı bir kez gider; 14 gün sonra en fazla bir kez hatırlatılır (toplam ≤ 2). Üye branşını seçtiği anda
// durur — "seçti" = uzmanlık branşı sınıflandırılmış (Tercihler'deki "Uzmanlık branşınız" kartı) YA DA Tercihler'de
// akış branşı seçilmiş (newsBranches dolu → akış zaten süzülüyor). Gönderim durumu ayrı kolonda DEĞİL, bildirim
// kayıtlarından türetilir (type = BRANCH_REMINDER; DOCS_PENDING/MISSING_DOCS deseni — migration yok).
//
// Terim: "doktor" (hekim YAZILMAZ). Öğrenciye "Dr." hitabı kullanılmaz.

import { escapeHtml, type RenderedEmail } from "./trial-email";

export const BRANCH_REMINDER_TYPE = "BRANCH_REMINDER";
export const BRANCH_REMINDER_MAX = 2;
export const BRANCH_REMINDER_GAP_DAYS = 14;
/** Uyarının götürdüğü yer: Tercihler'deki "Uzmanlık branşınız" kartı (#brans çapası). */
export const BRANCH_REMINDER_PATH = "/doktor/doctorium/tercihler#brans";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bugün gönderilmeli mi — saf. `sentCount`/`lastSentAt` bildirim kayıtlarından gelir. */
export function branchReminderDue(p: { sentCount: number; lastSentAt: Date | null; now: Date }): boolean {
  if (p.sentCount <= 0) return true;
  if (p.sentCount >= BRANCH_REMINDER_MAX || !p.lastSentAt) return false;
  return p.now.getTime() - p.lastSentAt.getTime() >= BRANCH_REMINDER_GAP_DAYS * DAY_MS;
}

// ── Portal bildirimi (👤 onaylı metin) ──────────────────────────────────────────────────────────
export const BRANCH_REMINDER_TITLE = "Branşınızı seçin, akışınız size göre düzenlensin";
export function branchReminderBody(branchLabel: string): string {
  return `Kayıtta branşınız “${branchLabel}” olarak kaydedildi. Tercihler'den ilgilendiğiniz branşları seçtiğinizde akışınız ve Doctorium Post bu branşlara göre düzenlenir.`;
}

/** Kayıttaki değer boşsa metinde "Diğer (Sınıflandırılmamış)" yerine dürüst karşılık. */
export function branchLabelForCopy(raw: string | null): string {
  const v = (raw ?? "").trim();
  return v || "belirtilmemiş";
}

/** Hitap: doktora "Dr. Ad" (ad zaten "Dr." ile başlıyorsa tekrar edilmez), öğrenciye yalnız ad. */
export function greetingName(name: string, isStudent: boolean): string {
  const n = name.trim() || "Doctorium üyesi";
  if (isStudent || /^(prof\.|doç\.|dr\.|uzm\.|op\.)/i.test(n)) return n;
  return `Dr. ${n}`;
}

const BTN = "display:inline-block;background:#065f46;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600";
const NOTE = "font-size:12px;color:#64748b";
const FOOTER = "Bu e-posta Doctorium üyeliğiniz nedeniyle gönderildi. Branşınızı seçtiğinizde bu hatırlatma bir daha gönderilmez.";

// ── E-posta (👤 onaylı metin) ───────────────────────────────────────────────────────────────────
export function renderBranchReminderEmail(a: { name: string; isStudent: boolean; branchLabel: string; url: string }): RenderedEmail {
  const hello = `Merhaba ${greetingName(a.name, a.isStudent)},`;
  const lead = [
    `Doctorium'a kayıt olurken branşınız “${a.branchLabel}” olarak kaydedildi. Bu yüzden akışınız ve Doctorium Post şu an hiçbir branşa göre süzülmüyor.`,
    "Tercihler sayfasından ilgilendiğiniz branşları seçtiğinizde akışınız bu branşlara göre düzenlenir. Seçimi istediğiniz zaman değiştirebilirsiniz.",
  ];
  const cta = "Branşlarımı seç";
  const text = [hello, "", ...lead.flatMap((p) => [p, ""]), `${cta}: ${a.url}`, "", FOOTER].join("\n");
  const html = [
    `<p>${escapeHtml(hello)}</p>`,
    ...lead.map((p) => `<p>${escapeHtml(p)}</p>`),
    `<p><a href="${escapeHtml(a.url)}" style="${BTN}">${escapeHtml(cta)}</a></p>`,
    `<p style="${NOTE}">Düğme çalışmazsa: ${escapeHtml(a.url)}</p>`,
    `<p style="${NOTE}">${escapeHtml(FOOTER)}</p>`,
  ].join("");
  return { subject: "Doctorium — branşınızı seçer misiniz?", text, html };
}
