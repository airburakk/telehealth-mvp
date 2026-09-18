// AURA HASTA/PERSONEL PASİFLİK SÜPÜRMESİ (A06 madde 3.1b · A01 madde 8 · A09 madde 8 — 👤 S5 12.09.2026; kod Paket C,
// 2026-09-18) — lib/abandoned-sweep.ts (Doctorium 05 madde 3.1b) deseninin User dalı; api/cron/purge-deleted (06:30 TR)
// çağırır. "ORTAK SÜPÜRME" = aynı süreler ve aynı SAF karar fonksiyonu (abandonedActionFor: 3 yıl, silmeden 30 gün önce
// bildirim, bugün gönderilen bildirim bugün imhaya yol açmaz); yalnız kapsam, bağ ölçümü ve silme gövdesi farklıdır.
//
// KAPSAM: deletedAt boş, rolü DOCTOR olmayan User kayıtları (hasta + tüm personel rolleri). DOCTOR hariç: Doctorium
// üyesi kendi süpürmesine tabidir, Aşama 2 doktoru ise klinik bağı nedeniyle hiçbir süpürmeye girmez (3.17 elle kapatma).
// Son aktivite = lastLoginAt ?? createdAt (hiç giriş yapmamış hesap kayıt tarihini taşır; migration
// 20260918110000_aura_paket_c kolonu AccessLog LOGIN zincirinden geri doldurdu).
//
// KORKULUKLAR (fail-closed — her aday için ÖLÇÜLÜR, varsayılmaz):
//   · klinik bağ (lib/aura-account-purge countAuraTies) → ne bildirim ne imha: bağlı hesap "hesap-yalnız" değildir
//     (hasta A06 5.1 yoluyla, personel 3.17 usulüyle kapanır); "silinecek" deyip silmemek de yanıltıcı olurdu
//   · bekleyen KVKK m.11 başvurusu ya da bekleyen kurumsal başvuru → süreç bitene dek dokunulmaz
//   · son aktif ADMIN → atlanır (işletici kendini dışarıda bırakmasın; sayaç audit'e düşer)
//
// Ne yapar (her gün):
//   1) Son aktiviteden 3 yıl − 30 gün geçmişse VE bu pasiflik dönemi için bildirim gitmemişse (isNoticeCurrent):
//      bildirim (zil) + doğrulanmış e-postaya TR/EN e-posta (hasta dili Türkçe → TR, aksi hâlde EN; personel TR)
//      + abandonedNoticeSentAt damgası. recordLogin girişte damgayı NULL'lar.
//   2) 3 yıl geçmişse VE bildirim ÖNCEKİ turda gitmişse: purgeAuraAccountRows (tek transaction) + audit
//      AURA_ABANDONED_PURGE (actor null — cron; özne silinen hesap, cuid yetim → anonim).
// Hata modeli: hesap başına try/catch — biri patlarsa diğerleri sürer (abandoned-sweep deseni).
import { db } from "./db";
import { notifyUser } from "./notify";
import { sendEmail } from "./email";
import { recordAccess } from "./audit";
import { AURA_CANONICAL_URL } from "./brand";
import { roleHome, type Role } from "./roles";
import { abandonedActionFor, abandonedPurgeDateFor, isNoticeCurrent, formatDateTr, NOTICE_THRESHOLD_MS } from "./abandoned-sweep";
import { renderAuraAbandonedNoticeEmail, formatDateEn } from "./aura-abandoned-email";
import { consentLangFor } from "./consent-lang";
import { countAuraTies, hasAuraTies, purgeAuraAccountRows } from "./aura-account-purge";

/** Süpürmeye giren roller — ROLES eksi DOCTOR (Doctorium süpürmesi + 3.17). Yeni rol eklenirse buraya da bakılır (test kilitli). */
export const AURA_SWEEP_ROLES = ["PATIENT", "COORDINATOR", "ETHICS", "ADMIN", "PARTNER", "AGENCY", "HEALTH_PRO"] as const;

/** Hasta → /giris, personel → /kurumsal-giris (giriş yüzeyi ayrımıyla aynı). */
export function auraLoginPath(role: string): "/giris" | "/kurumsal-giris" {
  return role === "PATIENT" ? "/giris" : "/kurumsal-giris";
}

export function auraLoginUrl(role: string): string {
  return `${AURA_CANONICAL_URL}${auraLoginPath(role)}`;
}

export interface AuraAbandonedSweepResult {
  checked: number;
  noticed: number; // "30 gün içinde silinecek" bildirimi
  purged: number;
  skippedTies: number; // klinik bağ → atlandı (bildirim de gönderilmez)
  skippedPending: number; // bekleyen KVKK / kurumsal başvuru → atlandı
  skippedLastAdmin: number; // son aktif ADMIN → atlandı
  failed: number;
}

const BATCH = 500;

type SweepUser = {
  id: string;
  role: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  patientLanguage: string | null;
  partnerId: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  abandonedNoticeSentAt: Date | null;
};

export async function sweepAuraAbandonedAccounts(now: Date = new Date()): Promise<AuraAbandonedSweepResult> {
  const r: AuraAbandonedSweepResult = { checked: 0, noticed: 0, purged: 0, skippedTies: 0, skippedPending: 0, skippedLastAdmin: 0, failed: 0 };
  const noticeCutoff = new Date(now.getTime() - NOTICE_THRESHOLD_MS);

  const users: SweepUser[] = await db.user.findMany({
    where: {
      deletedAt: null,
      role: { in: [...AURA_SWEEP_ROLES] },
      OR: [{ lastLoginAt: { lt: noticeCutoff } }, { lastLoginAt: null, createdAt: { lt: noticeCutoff } }],
    },
    select: {
      id: true, role: true, email: true, name: true, emailVerifiedAt: true, patientLanguage: true, partnerId: true,
      lastLoginAt: true, createdAt: true, abandonedNoticeSentAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  r.checked = users.length;

  for (const u of users) {
    try {
      const lastActivity = u.lastLoginAt ?? u.createdAt;
      const action = abandonedActionFor({ lastActivity, alreadyNoticed: isNoticeCurrent(u.abandonedNoticeSentAt, lastActivity), now });
      if (!action) continue;

      const ties = await countAuraTies(u.id, u.partnerId);
      if (hasAuraTies(ties)) { r.skippedTies++; continue; }
      const [pendingKvkk, pendingApp] = await Promise.all([
        db.kvkkApplication.count({ where: { userId: u.id, status: "PENDING" } }),
        db.staffApplication.count({ where: { userId: u.id, status: "PENDING" } }),
      ]);
      if (pendingKvkk > 0 || pendingApp > 0) { r.skippedPending++; continue; }
      if (u.role === "ADMIN") {
        const others = await db.user.count({ where: { role: "ADMIN", deletedAt: null, id: { not: u.id } } });
        if (others === 0) { r.skippedLastAdmin++; continue; }
      }

      if (action === "notice") {
        const purgeDate = abandonedPurgeDateFor(lastActivity);
        const lang = u.role === "PATIENT" ? consentLangFor(u.patientLanguage) : "tr";
        const purgeDateLabel = lang === "en" ? formatDateEn(purgeDate) : formatDateTr(purgeDate);
        await notifyUser(u.id, {
          type: "ABANDONED_NOTICE",
          title: "Hesabınız 30 gün içinde silinecek",
          body: `Uzun süredir giriş yapılmadığı için hesabınız ${formatDateTr(purgeDate)} tarihinde silinecek. Sürdürmek için giriş yapmanız yeterli.`,
          href: roleHome(u.role as Role),
        });
        if (u.emailVerifiedAt) {
          await sendEmail({ to: u.email, ...renderAuraAbandonedNoticeEmail({ name: u.name, purgeDateLabel, loginUrl: auraLoginUrl(u.role), lang }) });
        }
        await db.user.update({ where: { id: u.id }, data: { abandonedNoticeSentAt: now } });
        r.noticed++;
      } else {
        const c = await db.$transaction((tx) => purgeAuraAccountRows(tx, u.id, u.partnerId, now));
        await recordAccess({
          actor: null,
          action: "AURA_ABANDONED_PURGE",
          resourceType: "User",
          resourceId: u.id,
          subjectUserId: u.id,
          detail: `rol=${u.role}; son aktiviteden 3 yıl + 30 günlük bildirim süresi doldu, klinik bağ yok; hesap silindi (bildirim ${c.notifications}, push ${c.push}, sistem mesajı ${c.systemMessages}, kurumsal başvuru ${c.staffApplications}/${c.staffDocs} belge, partner profili ${c.partnerDoctors}; onam kaydı bağ-koruyan boşaltıldı ${c.consents})`,
        });
        r.purged++;
      }
    } catch (e) {
      r.failed++;
      console.warn("[aura-abandoned-sweep] hesap işlenemedi:", e instanceof Error ? e.message : e);
    }
  }
  return r;
}
