// Kurumsal üyelik başvurusu — SUNUCU yardımcıları (2026-08-12).
// Rol-config + client-safe sabitler staff-application-config.ts'te; burada db/crypto isteyen işler:
// validasyon → hesap+başvuru oluşturma → yanıt çözme → onay/ret. Çağıran rotalar audit (recordAccess)
// ve bildirimi (notify*) kendisi düşer (ip/userAgent bağlamı rotada).
import { db } from "@/lib/db";
import { encryptField, decryptField } from "@/lib/crypto";
import { recordAccess } from "@/lib/audit";
import { countAuraTies, hasAuraTies, purgeAuraAccountRows } from "@/lib/aura-account-purge";
import {
  STAFF_ROLE_CONFIGS,
  type StaffRoleConfig,
  type StaffSignupRole,
} from "@/lib/staff-application-config";

export type StaffAnswers = Record<string, string | string[]>;

// Config'e göre ham form girdisini süz: required + maxLen + options denetimi; bilinmeyen anahtar ATILIR
// (client ne gönderirse göndersin, saklanan yanıt YALNIZ config alanlarıdır — fazla veri sızmaz).
export function validateStaffAnswers(
  config: StaffRoleConfig,
  raw: unknown,
): { ok: true; answers: StaffAnswers } | { ok: false; error: string } {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const answers: StaffAnswers = {};
  for (const f of config.fields) {
    const v = src[f.key];
    if (f.type === "multiselect") {
      const arr = Array.isArray(v)
        ? [...new Set(v.filter((x): x is string => typeof x === "string" && (!f.options || f.options.includes(x))))]
        : [];
      if (f.required && arr.length === 0) return { ok: false, error: `${f.label} alanı zorunlu.` };
      if (arr.length > 0) answers[f.key] = arr;
      continue;
    }
    const s = typeof v === "string" ? v.trim().slice(0, f.maxLen ?? 240) : "";
    if (f.required && s.length < 2) return { ok: false, error: `${f.label} alanı zorunlu.` };
    if (s && f.type === "select" && f.options && !f.options.includes(s)) {
      return { ok: false, error: `${f.label} için geçerli bir seçim yapın.` };
    }
    if (s) answers[f.key] = s;
  }
  const name = answers[config.nameKey];
  if (typeof name !== "string" || name.length < 2) {
    return { ok: false, error: "Ad soyad bilgisi zorunlu." };
  }
  return { ok: true, answers };
}

// Yeni personel hesabı + PENDING başvuru — atomik (createDoctorAccount deseni).
// staffVerifiedAt NULL açılır: rol paneli insan onayına dek kapalı, kullanıcı /kayit/durum'a iner.
export async function createStaffAccount(input: {
  role: StaffSignupRole;
  email: string; // benzersizlik çağıran tarafça önceden kontrol edilir
  passwordHash: string;
  answers: StaffAnswers;
}) {
  const config = STAFF_ROLE_CONFIGS[input.role];
  const name = String(input.answers[config.nameKey]);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        staffVerifiedAt: null,
      },
    });
    await tx.staffApplication.create({
      data: {
        userId: user.id,
        role: input.role,
        answers: encryptField(JSON.stringify(input.answers)), // kişisel veri → at-rest şifreli
      },
    });
    return user;
  });
}

// Şifreli yanıtları çöz (personel-onay incelemesi + durum sayfası prefill). Bozuk kayıt {} döner
// (fail-safe: inceleme ekranı boş alanları gösterir, çökmez).
export function readStaffAnswers(encrypted: string): StaffAnswers {
  try {
    const parsed = JSON.parse(decryptField(encrypted));
    return parsed && typeof parsed === "object" ? (parsed as StaffAnswers) : {};
  } catch {
    return {};
  }
}

// REJECTED başvuruyu düzeltip yeniden gönderme: yanıtlar güncellenir, durum PENDING'e döner.
// (Kullanıcı başına tek satır — yeni başvuru açılmaz, inceleme geçmişi reviewNote'ta kalır.)
export async function resubmitStaffApplication(userId: string, answers: StaffAnswers): Promise<void> {
  const config = await db.staffApplication.findUnique({ where: { userId }, select: { role: true } });
  if (!config) throw new Error("Başvuru bulunamadı.");
  const name = answers[STAFF_ROLE_CONFIGS[config.role as StaffSignupRole].nameKey];
  await db.$transaction(async (tx) => {
    await tx.staffApplication.update({
      where: { userId },
      data: { answers: encryptField(JSON.stringify(answers)), status: "PENDING", reviewNote: null },
    });
    if (typeof name === "string" && name.length >= 2) {
      await tx.user.update({ where: { id: userId }, data: { name } });
    }
  });
}

// ── Onay / ret (personel-onay) ───────────────────────────────────────────────────────────────────

// Onay: başvuru APPROVED + User.staffVerifiedAt damgası; PARTNER'da PartnerDoctor satırı oluşturulup
// User.partnerId bağlanır (mevcut partner akışları User.partnerId üzerinden çalışır). PartnerDoctor
// telefonu YAZILMAZ (model düz-metin; yanıt zaten StaffApplication.answers içinde şifreli durur).
export async function approveStaffApplication(
  applicationId: string,
  reviewerUserId: string,
): Promise<{ userId: string; role: string }> {
  return db.$transaction(async (tx) => {
    const app = await tx.staffApplication.findUnique({ where: { id: applicationId } });
    if (!app) throw new Error("Başvuru bulunamadı.");
    if (app.status === "APPROVED") return { userId: app.userId, role: app.role }; // idempotent
    const user = await tx.user.findUnique({
      where: { id: app.userId },
      select: { id: true, email: true, name: true, partnerId: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new Error("Başvuru sahibi hesap bulunamadı.");

    await tx.staffApplication.update({
      where: { id: applicationId },
      data: { status: "APPROVED", reviewedByUserId: reviewerUserId, reviewedAt: new Date(), reviewNote: null },
    });

    let partnerId = user.partnerId;
    if (app.role === "PARTNER" && !partnerId) {
      const answers = readStaffAnswers(app.answers);
      const str = (k: string) => (typeof answers[k] === "string" ? (answers[k] as string) : null);
      const partner = await tx.partnerDoctor.create({
        data: {
          name: user.name,
          title: str("title") ?? "Dr.",
          country: str("country") ?? "—",
          institution: str("institution"),
          branch: str("branch"),
          email: user.email,
          verified: true, // insan onayından geçti (personel-onay)
        },
      });
      partnerId = partner.id;
    }

    await tx.user.update({
      where: { id: user.id },
      data: { staffVerifiedAt: new Date(), ...(partnerId ? { partnerId } : {}) },
    });
    return { userId: user.id, role: app.role };
  });
}

// Ret: durum REJECTED + gerekçe (başvurana durum sayfasında gösterilir — kişisel veri yazılmaz).
export async function rejectStaffApplication(
  applicationId: string,
  reviewerUserId: string,
  note: string,
): Promise<{ userId: string; role: string }> {
  const app = await db.staffApplication.update({
    where: { id: applicationId },
    data: {
      status: "REJECTED",
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
      reviewNote: note.trim().slice(0, 500) || null,
    },
    select: { userId: true, role: true },
  });
  return app;
}

// ── Ret imhası (A06 madde 3.16 · A10 madde 6 — kod Paket C, 2026-09-18) ──────────────────────────
// REJECTED başvuru, ret bildiriminden (reviewedAt) itibaren 90 gün (itiraz penceresi — Doctorium 11 / doc-purge
// REJECTED_RETENTION_DAYS ile aynı) bekler; pencere dolunca başvuru + belgeler + başvuru sahibinin hesabı silinir.
// Pencere içinde düzeltip yeniden gönderen (resubmitStaffApplication → PENDING) bu süpürmeye hiç girmez.
// Korkuluklar (fail-closed): staffVerifiedAt damgalı hesap (başka yoldan onaylanmış) atlanır · klinik bağı olan hesap
// atlanır (lib/aura-account-purge) · silinmiş (deletedAt) hesap atlanır. Silme gövdesi purgeAuraAccountRows (User
// GERÇEKTEN silinir — saklanan klinik kayıt yok, kabuk gerekmez). Audit: STAFF_APPLICATION_PURGE (actor null — cron).
// Çağıran: api/cron/purge-deleted (06:30 TR).
export const STAFF_APPLICATION_REJECTED_RETENTION_DAYS = 90;
const REJECTED_RETENTION_MS = STAFF_APPLICATION_REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** SAF: ret penceresi doldu mu? reviewedAt yoksa (eski/bozuk kayıt) ASLA — fail-closed. */
export function rejectedApplicationPurgeDue(reviewedAt: Date | null | undefined, now: Date): boolean {
  return !!reviewedAt && now.getTime() - reviewedAt.getTime() >= REJECTED_RETENTION_MS;
}

export interface RejectedPurgeResult {
  checked: number;
  purged: number;
  skippedTies: number; // klinik bağ → atlandı (beklenmez; fail-closed)
  skippedVerified: number; // staffVerifiedAt damgalı → başvuru reddi hesabın reddi değildir; elle bakılır
  failed: number;
}

export async function purgeRejectedStaffApplications(now: Date = new Date(), limit = 100): Promise<RejectedPurgeResult> {
  const r: RejectedPurgeResult = { checked: 0, purged: 0, skippedTies: 0, skippedVerified: 0, failed: 0 };
  const cutoff = new Date(now.getTime() - REJECTED_RETENTION_MS);
  const apps = await db.staffApplication.findMany({
    where: { status: "REJECTED", reviewedAt: { lt: cutoff } },
    select: { id: true, userId: true, role: true, reviewedAt: true },
    orderBy: { reviewedAt: "asc" },
    take: limit,
  });
  r.checked = apps.length;
  for (const app of apps) {
    try {
      if (!rejectedApplicationPurgeDue(app.reviewedAt, now)) continue; // sorgu zaten süzdü; saf kural ikinci korkuluk
      const user = await db.user.findUnique({
        where: { id: app.userId },
        select: { id: true, partnerId: true, staffVerifiedAt: true, deletedAt: true },
      });
      if (user?.staffVerifiedAt) { r.skippedVerified++; continue; }
      if (user?.deletedAt) continue; // kabuk — hesap silme yolu zaten işlemiş, kabuğu purgeExpired götürür
      if (user) {
        const ties = await countAuraTies(user.id, user.partnerId);
        if (hasAuraTies(ties)) { r.skippedTies++; continue; }
      }
      const c = await db.$transaction((tx) => purgeAuraAccountRows(tx, app.userId, user?.partnerId ?? null, now));
      await recordAccess({
        actor: null,
        action: "STAFF_APPLICATION_PURGE",
        resourceType: "STAFF_APPLICATION",
        resourceId: app.id,
        subjectUserId: app.userId,
        detail: `rol=${app.role} ret=${app.reviewedAt?.toISOString().slice(0, 10)} pencere=${STAFF_APPLICATION_REJECTED_RETENTION_DAYS} gün; başvuru, ${c.staffDocs} belge ve ${c.users ? "başvuru sahibinin hesabı" : "yetim kayıt"} silindi (onam kaydı bağ-koruyan boşaltıldı ${c.consents})`,
      });
      r.purged++;
    } catch (e) {
      r.failed++;
      console.warn("[staff-application] ret imhası işlenemedi:", e instanceof Error ? e.message : e);
    }
  }
  return r;
}
