// Kurumsal üyelik başvurusu — SUNUCU yardımcıları (2026-08-12).
// Rol-config + client-safe sabitler staff-application-config.ts'te; burada db/crypto isteyen işler:
// validasyon → hesap+başvuru oluşturma → yanıt çözme → onay/ret. Çağıran rotalar audit (recordAccess)
// ve bildirimi (notify*) kendisi düşer (ip/userAgent bağlamı rotada).
import { db } from "@/lib/db";
import { encryptField, decryptField } from "@/lib/crypto";
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
