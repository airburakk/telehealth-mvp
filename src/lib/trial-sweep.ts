// Doctorium DENEME SÜPÜRMESİ (üç katman Faz A4, kullanıcı kararı 2026-09-05) — api/cron/trial-sweep (10:20 TR) çağırır.
//
// Ne yapar (her gün, yalnız DOĞRULANMAMIŞ deneme hesapları: trialEndsAt dolu · diploma/öğrenci damgası yok · optOut yok):
//   1) Bitişe 7 · 3 · 1 gün kala HATIRLATMA (bildirim + e-posta) — eşik/telafi mantığı lib/doctorium-tiers dueTrialAlerts
//      (kaçırılan gün bayat mesaj üretmez; her eşik bir kez).
//   2) Bitişte "SÜRE DOLDU" (bir kez) — portal o anda zaten kapalı (katman LOCKED, kapı lib/doctorium-audience).
//   3) Bitimden LOCKED_PURGE_DAYS − TRIAL_PURGE_NOTICE_DAYS (= 60) gün sonra İMHA BİLDİRİMİ (bir kez; gönderildiği gün
//      "purge-notice@YYYY-MM-DD" olarak işaretlenir).
//   4) Bitimden LOCKED_PURGE_DAYS (= 90) gün sonra İMHA — FAIL-CLOSED: bildirim gitmemişse ya da bildirimden 30 gün
//      geçmemişse SİLİNMEZ; klinik bağı olan (olmaması beklenir) ya da İNCELEMEDE belgesi olan hesap ATLANIR (kişi belge
//      yükledi, incelemeci karar vermedi — kullanıcının fiili bekletilir). Silme = Doctorium'un kendi kapatma gövdesi
//      (lib/doctorium-membership purgeTrialAccount; ConsentRecord bağ-koruyan kalır) + audit DOCTORIUM_TRIAL_PURGE.
//
// Gönderilen uyarılar Doctor.trialAlertsSent'te (JSON string[]; CongressFollow.sentAlerts deseni) → tekrar yok.
// E-posta yalnız doğrulanmış adrese (emailVerifiedAt) gider; bildirim her durumda yazılır. Bağlantılar Doctorium kanonik
// kökünden kurulur (cron AURA projesinde koşar — lib/brand DOCTORIUM_CANONICAL_URL notu). Her metin §2b altbilgisini taşır.
//
// Hata modeli: doktor başına try/catch — biri patlarsa diğerleri sürer; toplam `failed` sayacı cron yanıtında ve audit
// satırında görünür. Bu modül DB okur; saf takvim mantığı ve sabitler lib/doctorium-tiers'ta (birim testli).
import { db } from "./db";
import { notifyUser } from "./notify";
import { sendEmail } from "./email";
import { DOCTORIUM_CANONICAL_URL } from "./brand";
import {
  dueTrialAlerts, shouldPurgeLockedTrial, parseTrialAlerts, serializeTrialAlerts, trialDaysLeft,
  formatTrialEndsAt, purgeNoticeMarker, LOCKED_PURGE_DAYS, TRIAL_PURGE_NOTICE_DAYS, type TrialAlertKey,
} from "./doctorium-tiers";
import { TRIAL_PROMISE_SHORT } from "./doctorium-trial-copy";
import { renderTrialEndedEmail, renderTrialPurgeNoticeEmail, renderTrialReminderEmail } from "./trial-email";
import { purgeTrialAccount } from "./doctorium-membership";

export interface TrialSweepResult {
  checked: number; // incelenen doğrulanmamış deneme hesabı
  reminded: number; // 7/3/1 gün hatırlatması
  ended: number; // "süre doldu" bildirimi
  purgeNoticed: number; // imha bildirimi
  purged: number; // silinen hesap
  skippedTies: number; // klinik bağ → atlandı (beklenmez; fail-closed)
  skippedDocs: number; // incelemede belge → atlandı
  failed: number;
}

/** Doğrulama yolu — bildirim href'i (portal içi) ve e-posta bağlantısı (kanonik kök). */
export const TRIAL_VERIFY_PATH = "/doktor/baslangic?from=doctorium";
export function trialVerifyUrl(ended: boolean): string {
  return `${DOCTORIUM_CANONICAL_URL}${TRIAL_VERIFY_PATH}${ended ? "&trial=ended" : ""}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;

type SweepUser = { id: string; doctorId: string | null; email: string; name: string; emailVerifiedAt: Date | null; deletedAt: Date | null };

export async function sweepTrials(now: Date = new Date()): Promise<TrialSweepResult> {
  const r: TrialSweepResult = { checked: 0, reminded: 0, ended: 0, purgeNoticed: 0, purged: 0, skippedTies: 0, skippedDocs: 0, failed: 0 };

  const doctors = await db.doctor.findMany({
    where: {
      trialEndsAt: { not: null },
      diplomaVerifiedAt: null,
      studentVerifiedAt: null,
      doctoriumOptOutAt: null,
      studentTrack: false,
    },
    select: { id: true, name: true, trialEndsAt: true, trialAlertsSent: true },
    orderBy: { trialEndsAt: "asc" },
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
      if (!u || u.deletedAt || !d.trialEndsAt) continue;
      const endsAt = d.trialEndsAt;
      const sentBefore = parseTrialAlerts(d.trialAlertsSent);
      const { send, markSent } = dueTrialAlerts({ endsAt, sent: sentBefore, now });

      for (const key of send) await deliver(key, u, d.name || u.name, endsAt, now, r);

      if (markSent.length > 0) {
        const sent = new Set(sentBefore);
        for (const k of markSent) sent.add(k);
        if (send.includes("purge-notice")) sent.add(purgeNoticeMarker(now)); // 30 gün sayacı bugünden başlar
        await db.doctor.update({ where: { id: d.id }, data: { trialAlertsSent: serializeTrialAlerts(sent) } });
      }

      // İMHA kararı BU TURDAN ÖNCEKİ işaretlerle verilir: bugün gönderilen bildirim bugün imhaya yol açmaz.
      if (shouldPurgeLockedTrial({ endsAt, sent: sentBefore, now })) {
        const res = await purgeTrialAccount(u.id, d.id);
        if (res === "purged") r.purged++;
        else if (res === "skipped-ties") r.skippedTies++;
        else r.skippedDocs++;
      }
    } catch (e) {
      r.failed++;
      console.warn("[trial-sweep] hesap işlenemedi:", e instanceof Error ? e.message : e);
    }
  }
  return r;
}

async function deliver(key: TrialAlertKey, u: SweepUser, name: string, endsAt: Date, now: Date, r: TrialSweepResult): Promise<void> {
  const mail = (m: { subject: string; text: string; html: string }) =>
    u.emailVerifiedAt ? sendEmail({ to: u.email, ...m }) : Promise.resolve(null);

  if (key === "ended") {
    await notifyUser(u.id, {
      type: "TRIAL_ENDED",
      title: "Deneme süreniz sona erdi",
      body: `Portal erişiminiz doğrulama tamamlanana kadar kapalı; e-Devlet mezun belgenizle doğruladığınız anda yeniden açılır. ${TRIAL_PROMISE_SHORT}`,
      href: `${TRIAL_VERIFY_PATH}&trial=ended`,
    });
    await mail(renderTrialEndedEmail({ name, verifyUrl: trialVerifyUrl(true) }));
    r.ended++;
    return;
  }
  if (key === "purge-notice") {
    const purgeDate = new Date(endsAt.getTime() + LOCKED_PURGE_DAYS * DAY_MS);
    const purgeDateLabel = formatTrialEndsAt(purgeDate);
    await notifyUser(u.id, {
      type: "TRIAL_PURGE_NOTICE",
      title: `Hesabınız ${TRIAL_PURGE_NOTICE_DAYS} gün içinde silinecek`,
      body: `Doğrulama yapılmadığı için hesabınız ve Doctorium verileriniz ${purgeDateLabel} tarihinde silinecek. Sürdürmek için mezun belgenizi doğrulayın.`,
      href: `${TRIAL_VERIFY_PATH}&trial=ended`,
    });
    await mail(renderTrialPurgeNoticeEmail({ name, purgeDateLabel, verifyUrl: trialVerifyUrl(true) }));
    r.purgeNoticed++;
    return;
  }
  // "7" | "3" | "1" — kalan gün gerçek değerden (eşik anahtarından değil) yazılır.
  const daysLeft = Math.max(1, trialDaysLeft(endsAt, now));
  await notifyUser(u.id, {
    type: "TRIAL_REMINDER",
    title: `Deneme süreniz ${daysLeft} gün sonra bitiyor`,
    body: `Üyeliğinizin kalıcı olması için e-Devlet barkodlu mezun belgenizi doğrulayın. ${TRIAL_PROMISE_SHORT}`,
    href: TRIAL_VERIFY_PATH,
  });
  await mail(renderTrialReminderEmail({ name, daysLeft, endsAtLabel: formatTrialEndsAt(endsAt), verifyUrl: trialVerifyUrl(false) }));
  r.reminded++;
}
