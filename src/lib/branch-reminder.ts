// Branşı sınıflandırılmamış Doctorium üyelerine uyarı süpürmesi (👤 2026-10-06). Metin/kural: lib/branch-reminder-copy.
// Koşu: api/cron/trial-sweep içinde, deneme süpürmesinden SONRA (ayrı cron açılmadı — aynı kitle, aynı saat 10:20 TR,
// aynı Doctorium e-posta hattı; CRON_SCHEDULES/vercel.json değişmedi).
//
// Kimler: DOCTOR rolü · silinmemiş · Doctorium portalına erişimi açık (VERIFIED/STUDENT/TRIAL — süresi dolmuş deneme ve
// üyelikten çıkan ALINMAZ) · uzmanlık branşı sınıflandırılmamış (boş · listede yok · "Diğer (Sınıflandırılmamış)") ·
// Tercihler'de akış branşı SEÇMEMİŞ. Gönderim = portal bildirimi (her durumda) + e-posta (yalnız doğrulanmış adrese).
// Durum bildirim kayıtlarından türetilir (BRANCH_REMINDER_TYPE) → tekrar yok, kolon yok.

import { db } from "./db";
import { notifyUser } from "./notify";
import { sendEmail } from "./email";
import { DOCTORIUM_CANONICAL_URL } from "./brand";
import { doctoriumAudience, hasPortalAccess } from "./doctorium-tiers";
import { parseBranchPrefs } from "./doctorium";
import { branchIssue } from "./admin-member-trial";
import {
  BRANCH_REMINDER_PATH,
  BRANCH_REMINDER_TITLE,
  BRANCH_REMINDER_TYPE,
  branchLabelForCopy,
  branchReminderBody,
  branchReminderDue,
  renderBranchReminderEmail,
} from "./branch-reminder-copy";

export interface BranchReminderResult {
  checked: number;
  sent: number;
  failed: number;
}

export async function sweepBranchReminders(now: Date = new Date()): Promise<BranchReminderResult> {
  const r: BranchReminderResult = { checked: 0, sent: 0, failed: 0 };

  const users = await db.user.findMany({
    where: { role: "DOCTOR", deletedAt: null, doctorId: { not: null } },
    select: { id: true, name: true, email: true, emailVerifiedAt: true, doctorId: true },
  });
  if (users.length === 0) return r;

  const doctors = await db.doctor.findMany({
    where: { id: { in: users.map((u) => u.doctorId!) } },
    select: {
      id: true, name: true, branch: true, newsBranches: true, studentTrack: true,
      diplomaVerifiedAt: true, studentVerifiedAt: true, doctoriumOptOutAt: true, trialEndsAt: true,
    },
  });
  const byId = new Map(doctors.map((d) => [d.id, d]));

  const candidates = users.flatMap((u) => {
    const d = byId.get(u.doctorId!);
    if (!d) return [];
    if (!hasPortalAccess(doctoriumAudience(d, now))) return [];
    if (!branchIssue(d.branch)) return [];
    if (parseBranchPrefs(d.newsBranches).length > 0) return [];
    return [{ u, d }];
  });
  r.checked = candidates.length;
  if (candidates.length === 0) return r;

  const history = await db.notification.groupBy({
    by: ["userId"],
    where: { type: BRANCH_REMINDER_TYPE, userId: { in: candidates.map((c) => c.u.id) } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const sentBy = new Map(history.map((h) => [h.userId, { count: h._count._all, last: h._max.createdAt }]));

  const url = `${DOCTORIUM_CANONICAL_URL}${BRANCH_REMINDER_PATH}`;
  for (const { u, d } of candidates) {
    const h = sentBy.get(u.id);
    if (!branchReminderDue({ sentCount: h?.count ?? 0, lastSentAt: h?.last ?? null, now })) continue;
    const label = branchLabelForCopy(d.branch);
    try {
      await notifyUser(u.id, {
        type: BRANCH_REMINDER_TYPE,
        title: BRANCH_REMINDER_TITLE,
        body: branchReminderBody(label),
        href: BRANCH_REMINDER_PATH,
      });
      if (u.emailVerifiedAt) {
        await sendEmail({
          to: u.email,
          ...renderBranchReminderEmail({ name: d.name || u.name, isStudent: d.studentTrack, branchLabel: label, url }),
        });
      }
      r.sent++;
    } catch (e) {
      r.failed++;
      console.warn("[branch-reminder] gönderilemedi:", e instanceof Error ? e.message : e);
    }
  }
  return r;
}
