// Doctorium TERK EDİLMİŞ HESAP SÜPÜRMESİ (05 madde 3.1b, Paket 2 — 2026-09-09) — lib/trial-sweep.ts
// deseninin eşleniği, api/cron/purge-deleted (06:30 TR) çağırır.
//
// Kapsam: DOĞRULANMIŞ (diplomaVerifiedAt YA DA studentVerifiedAt dolu) VE doctoriumOptOutAt boş
// Doctor kayıtları — yani yalnız-Doctorium üyeliği olan Aşama 1 doktoru / öğrenci. Aşama 2 doktoru
// (AURA klinik hesabı da olan) bu kurala tabi DEĞİL: Doctorium'a girmiyor olması AURA hesabının
// terk edildiği anlamına gelmez; purgeAbandonedAccount zaten hasClinicalTies ile bunu fail-closed
// reddeder (bu sorgu onları da getirebilir, çağıran fonksiyon nihai kararı verir).
//
// Ne yapar (her gün):
//   1) Son aktiviteden (lastLoginAt ?? createdAt — hiç giriş yapmamış hesap kayıt tarihini taşır)
//      3 yıl − 30 gün geçmişse VE bildirim henüz gitmemişse: "hesabınız 30 gün içinde silinecek"
//      bildirimi (bildirim + e-posta) + abandonedNoticeSentAt damgası.
//   2) Son aktiviteden 3 yıl geçmişse VE bildirim ÖNCEKİ turda gönderilmişse (bugün gönderilen
//      bildirim bugün imhaya yol açmaz — trial-sweep ile aynı ilke): purgeAbandonedAccount çağrılır
//      (klinik bağ / PENDING belge fail-closed korkuluğu doctorium-membership.ts'te).
//
// Tarih mantığı (abandonedActionFor/abandonedPurgeDateFor) BİLİNÇLİ olarak SAF tutulur — DB/env
// içe aktarmaz (lib/doctorium-tiers dueTrialAlerts deseni): vitest DB-siz koştuğu için asıl karar
// mantığı burada test edilir, sweepAbandonedAccounts (DB'li gövde) yalnız entegrasyon testinde.
//
// Hata modeli: doktor başına try/catch — biri patlarsa diğerleri sürer (trial-sweep deseni).
import { db } from "./db";
import { notifyUser } from "./notify";
import { sendEmail } from "./email";
import { DOCTORIUM_CANONICAL_URL } from "./brand";
import { renderAbandonedNoticeEmail } from "./abandoned-email";
import { purgeAbandonedAccount } from "./doctorium-membership";

export interface AbandonedSweepResult {
  checked: number;
  noticed: number; // "30 gün içinde silinecek" bildirimi
  purged: number;
  skippedTies: number; // klinik bağ → atlandı (beklenmez; fail-closed)
  skippedDocs: number; // incelemede belge → atlandı
  failed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ABANDONED_YEARS = 3;
const NOTICE_DAYS_BEFORE = 30;
export const ABANDONED_MS = ABANDONED_YEARS * 365 * DAY_MS;
export const NOTICE_THRESHOLD_MS = ABANDONED_MS - NOTICE_DAYS_BEFORE * DAY_MS;
const BATCH = 500;

export const ABANDONED_LOGIN_URL = `${DOCTORIUM_CANONICAL_URL}/doctorium/giris`;

export type AbandonedAction = "notice" | "purge" | null;

/** SAF karar: bugün gönderilen bildirim bugün imhaya yol açmaz — alreadyNoticed bu turdan ÖNCEKİ durumdur. */
export function abandonedActionFor(a: { lastActivity: Date; alreadyNoticed: boolean; now: Date }): AbandonedAction {
  const ageMs = a.now.getTime() - a.lastActivity.getTime();
  if (!a.alreadyNoticed && ageMs >= NOTICE_THRESHOLD_MS) return "notice";
  if (a.alreadyNoticed && ageMs >= ABANDONED_MS) return "purge";
  return null;
}

/** Bildirim metnindeki "şu tarihte silinecek" — son aktiviteden tam 3 yıl sonrası. */
export function abandonedPurgeDateFor(lastActivity: Date): Date {
  return new Date(lastActivity.getTime() + ABANDONED_MS);
}

export function formatDateTr(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

type SweepDoctor = { id: string; name: string; lastLoginAt: Date | null; createdAt: Date; abandonedNoticeSentAt: Date | null };
type SweepUser = { id: string; doctorId: string | null; email: string; name: string; emailVerifiedAt: Date | null; deletedAt: Date | null };

export async function sweepAbandonedAccounts(now: Date = new Date()): Promise<AbandonedSweepResult> {
  const r: AbandonedSweepResult = { checked: 0, noticed: 0, purged: 0, skippedTies: 0, skippedDocs: 0, failed: 0 };
  const noticeCutoff = new Date(now.getTime() - NOTICE_THRESHOLD_MS);

  const doctors: SweepDoctor[] = await db.doctor.findMany({
    where: {
      AND: [
        { OR: [{ diplomaVerifiedAt: { not: null } }, { studentVerifiedAt: { not: null } }] },
        { doctoriumOptOutAt: null },
        { OR: [{ lastLoginAt: { lt: noticeCutoff } }, { lastLoginAt: null, createdAt: { lt: noticeCutoff } }] },
      ],
    },
    select: { id: true, name: true, lastLoginAt: true, createdAt: true, abandonedNoticeSentAt: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  r.checked = doctors.length;
  if (doctors.length === 0) return r;

  const users: SweepUser[] = await db.user.findMany({
    where: { doctorId: { in: doctors.map((d) => d.id) } },
    select: { id: true, doctorId: true, email: true, name: true, emailVerifiedAt: true, deletedAt: true },
  });
  const byDoctor = new Map<string, SweepUser>();
  for (const u of users) if (u.doctorId) byDoctor.set(u.doctorId, u);

  for (const d of doctors) {
    try {
      const u = byDoctor.get(d.id);
      if (!u || u.deletedAt) continue;
      const lastActivity = d.lastLoginAt ?? d.createdAt;
      const action = abandonedActionFor({ lastActivity, alreadyNoticed: !!d.abandonedNoticeSentAt, now });

      if (action === "notice") {
        const purgeDateLabel = formatDateTr(abandonedPurgeDateFor(lastActivity));
        await notifyUser(u.id, {
          type: "ABANDONED_NOTICE",
          title: "Hesabınız 30 gün içinde silinecek",
          body: `Uzun süredir giriş yapılmadığı için hesabınız ${purgeDateLabel} tarihinde silinecek. Sürdürmek için giriş yapmanız yeterli.`,
          href: "/doctorium/giris",
        });
        if (u.emailVerifiedAt) await sendEmail({ to: u.email, ...renderAbandonedNoticeEmail({ name: d.name || u.name, purgeDateLabel, loginUrl: ABANDONED_LOGIN_URL }) });
        await db.doctor.update({ where: { id: d.id }, data: { abandonedNoticeSentAt: now } });
        r.noticed++;
      } else if (action === "purge") {
        const res = await purgeAbandonedAccount(u.id, d.id);
        if (res === "purged") r.purged++;
        else if (res === "skipped-ties") r.skippedTies++;
        else r.skippedDocs++;
      }
    } catch (e) {
      r.failed++;
      console.warn("[abandoned-sweep] hesap işlenemedi:", e instanceof Error ? e.message : e);
    }
  }
  return r;
}
