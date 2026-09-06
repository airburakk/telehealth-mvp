// Kariyer EDU — SON BAŞVURU HATIRLATMASI (E2, 2026-09-06). daily-digest cron'u (06:30 TR) çağırır; yeni cron YOK.
// Öğrenci fırsatı TAKİP EDER (EduOpportunityFollow) → son başvuruya 7 / 3 / 1 gün kala BİR kez bildirim (EDU_DEADLINE, Doctorium
// zilinde) + e-posta (yalnız emailVerifiedAt dolu adrese; kanal 👤 2026-09-05 kararı: platform içi + e-posta). Eşik mantığı SAF
// (dueEduAlert) — birim testli; DB işi remindEduFollows'ta. Tekrar koruması CongressFollow deseni: gönderilen eşik anahtarı
// sentAlerts'a yazılır; daha sıkı eşik gönderilince gevşek eşikler de işaretlenir (2 gün kala takip başlayan öğrenciye "7"
// gönderilmez, "3" gönderilir ve sonra yalnız "1" kalır). Hata kritik değil: cron yanıtında raporlanır, akışı düşürmez.
// ⚖️ Metin süreç bilgisidir (ilan dili yok); e-posta yalnız başvuru sayfasına yönlendirir.
import { db } from "./db";
import { notifyUser } from "./notify";
import { sendEmail } from "./email";
import { DOCTORIUM_CANONICAL_URL } from "./brand";

/** Gün eşikleri (kala): en gevşekten en sıkıya. */
export const EDU_ALERT_THRESHOLDS = [7, 3, 1] as const;
export const EDU_KARIYER_PATH = "/doktor/doctorium/kariyer-edu";

/** Gün farkı (UTC gün başlarına göre) — saat farkı eşiği kaydırmasın. */
export function daysUntilUtc(target: Date, now: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86400000);
}

export function parseSentAlerts(raw: string): Set<string> {
  try {
    const v = JSON.parse(raw);
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Bugün gönderilecek eşik (varsa): geçmiş son başvuru → null; kalan gün ≤ eşik olan EN SIKI, henüz gönderilmemiş eşik.
 * Döndürülen `markKeys` = sentAlerts'a yazılacak anahtarlar (seçilen + ondan gevşek olanlar).
 */
export function dueEduAlert(deadline: Date, sent: ReadonlySet<string>, now: Date): { key: string; daysLeft: number; markKeys: string[] } | null {
  const d = daysUntilUtc(deadline, now);
  if (d < 0) return null;
  const asc = [...EDU_ALERT_THRESHOLDS].sort((a, b) => a - b); // 1, 3, 7
  for (const t of asc) {
    if (d <= t) {
      if (sent.has(String(t))) return null; // bu eşik zaten gitti → daha gevşek eşikler de anlamsız
      return { key: String(t), daysLeft: d, markKeys: asc.filter((x) => x >= t).map(String) };
    }
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const fmtDay = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export interface EduDeadlineEmailInput { name: string; title: string; organizer: string; daysLeft: number; deadline: Date; sourceUrl: string; kariyerUrl: string }
export function renderEduDeadlineEmail(a: EduDeadlineEmailInput): { subject: string; text: string; html: string } {
  const kala = a.daysLeft === 0 ? "bugün son gün" : `${a.daysLeft} gün kaldı`;
  const subject = `Son başvuru yaklaşıyor: ${a.title} — ${kala}`;
  const lines = [
    `Merhaba ${a.name},`,
    ``,
    `Takip ettiğiniz fırsat için son başvuru ${fmtDay(a.deadline)} (${kala}):`,
    `${a.title} — ${a.organizer}`,
    ``,
    `Başvuru kurumun kendi sayfasında yapılır: ${a.sourceUrl}`,
    `Doctorium Kariyer EDU: ${a.kariyerUrl}`,
    ``,
    `Bu ileti takip ettiğiniz fırsat için otomatik hatırlatmadır; ilan değil, süreç bilgisidir. Tarih ve şartlar kurum duyurularıyla değişebilir.`,
  ];
  const html = [
    `<p>Merhaba ${esc(a.name)},</p>`,
    `<p>Takip ettiğiniz fırsat için son başvuru <strong>${esc(fmtDay(a.deadline))}</strong> (${esc(kala)}):<br/><strong>${esc(a.title)}</strong> — ${esc(a.organizer)}</p>`,
    `<p>Başvuru kurumun kendi sayfasında yapılır: <a href="${esc(a.sourceUrl)}">${esc(a.sourceUrl)}</a><br/>Doctorium Kariyer EDU: <a href="${esc(a.kariyerUrl)}">${esc(a.kariyerUrl)}</a></p>`,
    `<p style="color:#666;font-size:12px">Bu ileti takip ettiğiniz fırsat için otomatik hatırlatmadır; ilan değil, süreç bilgisidir. Tarih ve şartlar kurum duyurularıyla değişebilir.</p>`,
  ].join("");
  return { subject, text: lines.join("\n"), html };
}

export interface EduRemindResult { checked: number; sent: number; emailed: number; failed: number }

/** Takip edilen fırsatlar için eşiğe giren hatırlatmaları gönderir (bildirim + doğrulanmış e-posta). */
export async function remindEduFollows(now = new Date()): Promise<EduRemindResult> {
  const out: EduRemindResult = { checked: 0, sent: 0, emailed: 0, failed: 0 };
  const follows = await db.eduOpportunityFollow.findMany({ select: { id: true, doctorId: true, opportunityId: true, sentAlerts: true } });
  if (!follows.length) return out;
  const [opps, users] = await Promise.all([
    db.eduOpportunity.findMany({
      where: { id: { in: [...new Set(follows.map((f) => f.opportunityId))] }, approvedAt: { not: null }, deadline: { not: null } },
      select: { id: true, title: true, organizer: true, deadline: true, sourceUrl: true },
    }),
    db.user.findMany({
      where: { doctorId: { in: [...new Set(follows.map((f) => f.doctorId))] }, deletedAt: null },
      select: { id: true, doctorId: true, name: true, email: true, emailVerifiedAt: true },
    }),
  ]);
  const byOpp = new Map(opps.map((o) => [o.id, o]));
  const userByDoctor = new Map(users.filter((u) => u.doctorId).map((u) => [u.doctorId as string, u]));
  const kariyerUrl = `${DOCTORIUM_CANONICAL_URL}${EDU_KARIYER_PATH}`;

  for (const f of follows) {
    const o = byOpp.get(f.opportunityId); const u = userByDoctor.get(f.doctorId);
    if (!o || !o.deadline || !u) continue;
    out.checked++;
    const sent = parseSentAlerts(f.sentAlerts);
    const due = dueEduAlert(o.deadline, sent, now);
    if (!due) continue;
    try {
      const kala = due.daysLeft === 0 ? "bugün son gün" : `${due.daysLeft} gün kaldı`;
      await notifyUser(u.id, {
        type: "EDU_DEADLINE",
        title: "⏳ Takip ettiğiniz fırsatın son başvurusu yaklaşıyor",
        body: `${o.title} — ${o.organizer}: ${kala} (${fmtDay(o.deadline)}).`,
        href: `${EDU_KARIYER_PATH}#edu-${o.id}`,
      });
      out.sent++;
      if (u.emailVerifiedAt) {
        try {
          const m = renderEduDeadlineEmail({ name: u.name, title: o.title, organizer: o.organizer, daysLeft: due.daysLeft, deadline: o.deadline, sourceUrl: o.sourceUrl, kariyerUrl });
          const r = await sendEmail({ to: u.email, ...m });
          if (r.sent) out.emailed++;
        } catch { /* e-posta kritik değil; bildirim yazıldı */ }
      }
      for (const k of due.markKeys) sent.add(k);
      await db.eduOpportunityFollow.update({ where: { id: f.id }, data: { sentAlerts: JSON.stringify([...sent]) } });
    } catch {
      out.failed++;
    }
  }
  return out;
}
