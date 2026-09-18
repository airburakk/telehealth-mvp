// AURA "hesap-yalnız" hesap imhası — ORTAK gövde (kod Paket C, 2026-09-18). İki çağıran:
//   · lib/aura-abandoned-sweep.ts  — A06 madde 3.1b pasiflik süpürmesi (3 yıl + 30 gün bildirim)
//   · lib/staff-application.ts     — A06 madde 3.16 kurumsal başvuru ret imhası (90 gün itiraz penceresi)
// doctorium-membership.ts closeAccountRows / countClinicalTies ikilisinin User-tarafı eşleniği.
//
// "HESAP-YALNIZ" = hiçbir KLİNİK BAĞI olmayan hesap. Bağ ÖLÇÜLÜR, varsayılmaz (fail-closed):
//   (a) sahip olduğu klinik kayıt: Case.userId · SecondOpinionCase.patientId · ConsultAppointment.patientId
//   (b) klinik kayıtlarda bıraktığı eylem izi: Recovery.completedBy · SecondOpinionDocument.uploadedBy ·
//       SecondOpinionRequest.requestedById · SecondOpinionEvent.actorId · StaffApplication.reviewedByUserId ·
//       (PARTNER) ConsultationVideoAppointment.partnerId
//   (c) denetim zincirinde klinik bir kaynağa dokunan HERHANGİ bir satır — resourceType, hesabın KENDİ kayıtlarına
//       (User/SYSTEM/KvkkApplication/STAFF_APPLICATION) ait olmayan her şey. Deny-list, allow-list DEĞİL: ileride
//       eklenen bir kaynak tipi kendiliğinden bağ sayılır (fail-closed).
// Bağ varken hesap BURADAN silinmez: hasta → A06 madde 5.1 yolu (kişisel katman silinir, klinik kayıt kilitlenir ve
// 20 yıl sonra imha edilir — lib/account-deletion); personel → madde 3.17 görev sonu usulü (elle). Şemada User'a FK
// YOK (tüm userId alanları düz String) → Prisma yanlış silmeyi ENGELLEMEZ; tek korkuluk bu ölçümdür.
//
// SİLME GÖVDESİ (tek transaction — çağıran açar, sonucu audit'e kendisi yazar): Notification · PushSubscription ·
// SystemMessage (kişisel hedef) · StaffDocument + StaffApplication · PartnerDoctor (bağsız olduğu ölçüldü) ·
// ConsentRecord BAĞ-KORUYAN boşaltma (satır KALIR — onam zinciri append-only, silmek sonraki halkanın prevHash bağını
// koparır; ip/userAgent silinir + purgedAt) · User satırı GERÇEKTEN silinir (kabuk gerekmez: kabuğun tek gerekçesi
// saklanan klinik kaydın rızasını ispat etmekti, saklanan klinik kayıt yok — Doctorium closeAccountRows ile aynı
// gerekçe). KALANLAR: AccessLog (hash zinciri; kimlik taşımaz) · KvkkApplication (KVKK m.11 kütüğü, 3 yıl — kendi
// süpürmesi purgeOldKvkkApplications; userId cuid'i kabuk gidince anonimdir).
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export interface AuraTies {
  ownedRecords: number; // Case + ikinci görüş vakası + görüşme randevusu (hasta)
  actionTraces: number; // klinik kayıtlardaki eylem izleri (personel / inceleme)
  partnerTraces: number; // PartnerDoctor'a bağlı görüntülü görüşme (PARTNER)
  auditClinical: number; // denetim zincirinde klinik kaynak satırı (deny-list dışı resourceType)
}

/** Denetim zincirinde hesabın KENDİ kayıtları sayılan kaynak tipleri — geri kalan her tip klinik bağdır. */
export const AURA_NON_CLINICAL_RESOURCE_TYPES = ["User", "user", "SYSTEM", "KvkkApplication", "STAFF_APPLICATION"] as const;

/** SAF: herhangi bir sayaç > 0 → bağ var → bu modülden silinmez. */
export function hasAuraTies(t: AuraTies): boolean {
  return t.ownedRecords > 0 || t.actionTraces > 0 || t.partnerTraces > 0 || t.auditClinical > 0;
}

export async function countAuraTies(userId: string, partnerId: string | null): Promise<AuraTies> {
  const [cases, soCases, appts, recoveries, soDocs, soReqs, soEvents, reviews, partnerAppts, auditClinical] = await Promise.all([
    db.case.count({ where: { userId } }),
    db.secondOpinionCase.count({ where: { patientId: userId } }),
    db.consultAppointment.count({ where: { patientId: userId } }),
    db.recovery.count({ where: { completedBy: userId } }),
    db.secondOpinionDocument.count({ where: { uploadedBy: userId } }),
    db.secondOpinionRequest.count({ where: { requestedById: userId } }),
    db.secondOpinionEvent.count({ where: { actorId: userId } }),
    db.staffApplication.count({ where: { reviewedByUserId: userId } }),
    partnerId ? db.consultationVideoAppointment.count({ where: { partnerId } }) : Promise.resolve(0),
    db.accessLog.count({ where: { actorId: userId, resourceType: { notIn: [...AURA_NON_CLINICAL_RESOURCE_TYPES] } } }),
  ]);
  return {
    ownedRecords: cases + soCases + appts,
    actionTraces: recoveries + soDocs + soReqs + soEvents + reviews,
    partnerTraces: partnerAppts,
    auditClinical,
  };
}

/** Silinen katmanların dökümü (audit detayına girer — adet, kişisel veri yok). */
export interface AuraPurgeCounts {
  notifications: number;
  push: number;
  systemMessages: number;
  staffDocs: number;
  staffApplications: number;
  partnerDoctors: number;
  consents: number; // bağ-koruyan boşaltılan onam satırı
  users: number; // 0 = yetim kayıt (User satırı zaten yoktu), 1 = hesap silindi
}

/**
 * Hesabı ve kişisel katmanını tek transaction içinde sil. Çağıran ÖNCE countAuraTies/hasAuraTies ile bağ olmadığını
 * ölçmüş olmalıdır — burası ölçmez (transaction içinde sayım = çift maliyet; sorumluluk çağıranda, iki çağıran da yapar).
 * deleteMany kullanılır: User satırı yoksa (yetim StaffApplication) hata fırlatmaz, sayaç 0 döner.
 */
export async function purgeAuraAccountRows(
  tx: Prisma.TransactionClient,
  userId: string,
  partnerId: string | null,
  now: Date,
): Promise<AuraPurgeCounts> {
  const apps = await tx.staffApplication.findMany({ where: { userId }, select: { id: true } });
  const appIds = apps.map((a) => a.id);
  const staffDocs = appIds.length ? (await tx.staffDocument.deleteMany({ where: { applicationId: { in: appIds } } })).count : 0;
  const staffApplications = (await tx.staffApplication.deleteMany({ where: { userId } })).count;
  const notifications = (await tx.notification.deleteMany({ where: { userId } })).count;
  const push = (await tx.pushSubscription.deleteMany({ where: { userId } })).count;
  const systemMessages = (await tx.systemMessage.deleteMany({ where: { userId } })).count;
  const consents = (
    await tx.consentRecord.updateMany({ where: { userId, purgedAt: null }, data: { ip: null, userAgent: null, purgedAt: now } })
  ).count;
  const partnerDoctors = partnerId ? (await tx.partnerDoctor.deleteMany({ where: { id: partnerId } })).count : 0;
  const users = (await tx.user.deleteMany({ where: { id: userId } })).count;
  return { notifications, push, systemMessages, staffDocs, staffApplications, partnerDoctors, consents, users };
}
