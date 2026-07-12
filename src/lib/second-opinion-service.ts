// İkinci Görüş — sunucu servis katmanı. Durum geçişlerini TEK YERDE doğrular + denetim
// izi (§8) yazar. Tüm fazlar (hasta/koordinatör/doktor) bunu kullanır → DRY + tutarlı audit.
import { db } from "./db";
import { canTransition, soBranchVariants, type SoStatus } from "./second-opinion";
import { notifyUser } from "./notify";
import { BRANCHES } from "./triage";
import { rankDoctorsByQuality } from "./match-score"; // CRM kalite indikatörleri + yük dengeleme

/** HTTP durum kodu taşıyan servis hatası — API route'ları yakalar ve uygun status döner. */
export class SoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SoError";
    this.status = status;
  }
}

export type SoEventAction =
  | "STATUS_CHANGE"
  | "DOC_UPLOAD"
  | "DOC_VIEW"
  | "REQUEST_OPEN"
  | "REQUEST_FULFILL"
  | "OPINION_SUBMIT"
  | "PAYMENT"
  | "ASSIGN"
  | "VIDEO";

interface Actor {
  actorId?: string | null;
  actorRole?: string | null;
}

/** Denetim izi kaydı (fire-safe: yazılamazsa ana akış bozulmaz). */
export async function logSoEvent(
  caseId: string,
  e: Actor & { action: SoEventAction; detail?: string },
): Promise<void> {
  try {
    await db.secondOpinionEvent.create({
      data: {
        caseId,
        actorId: e.actorId ?? null,
        actorRole: e.actorRole ?? null,
        action: e.action,
        detail: e.detail ?? null,
      },
    });
  } catch (err) {
    console.warn("[so] event yazılamadı:", err instanceof Error ? err.message : err);
  }
}

/**
 * Durum geçişi — doğrula (state machine §4) + uygula + audit. Geçersiz geçiş → SoError(409).
 * `data` ile aynı update'te ek alan yazılabilir (paidAt, readyAt, assignedDoctorId, ...).
 */
export async function transitionSoCase(
  caseId: string,
  to: SoStatus,
  opts: Actor & { data?: Record<string, unknown> } = {},
) {
  const c = await db.secondOpinionCase.findUnique({ where: { id: caseId } });
  if (!c) throw new SoError("Vaka bulunamadı.", 404);
  const from = c.status as SoStatus;
  if (!canTransition(from, to)) {
    throw new SoError(`Geçersiz durum geçişi: ${from} → ${to}.`, 409);
  }
  const updated = await db.secondOpinionCase.update({
    where: { id: caseId },
    data: { status: to, ...(opts.data ?? {}) },
  });
  await logSoEvent(caseId, {
    actorId: opts.actorId,
    actorRole: opts.actorRole,
    action: "STATUS_CHANGE",
    detail: `${from}→${to}`,
  });
  return updated;
}

/**
 * SO OTO-ATAMA (koordinatör YOK) — ödeme sonrası branşa uygun **en az yüklü** hocaya dosyayı
 * `OFFERED` olarak düşür + bildir. Hoca `SO_ACCEPT_WINDOW` içinde kabul etmezse dosya diğer branş
 * hocalarına açılır (accept route lazy fan-out → ilk kabul eden). Branş doktoru yoksa PENDING_REVIEW'da kalır.
 */
export async function autoAssignSoCase(caseId: string): Promise<string | null> {
  const c = await db.secondOpinionCase.findUnique({ where: { id: caseId } });
  if (!c || c.status !== "PENDING_REVIEW") return null;

  // Branş anahtar/etiket uyuşmazlığı (soBranchVariants açıklaması) — iki biçim de kapsanır.
  const doctors = await db.doctor.findMany({ where: { branch: { in: soBranchVariants(c.branch) }, verified: true } });
  if (doctors.length === 0) return null;

  const ACTIVE: SoStatus[] = ["OFFERED", "ASSIGNED", "AWAITING_ADDITIONAL_TESTS"];
  const loadRows = await Promise.all(
    doctors.map(async (d) => [d.id, await db.secondOpinionCase.count({ where: { assignedDoctorId: d.id, status: { in: ACTIVE } } })] as const),
  );
  const loads = new Map<string, number>(loadRows);
  // CRM kalite + yük dengeleme + hasta–doktor uyumu: birleşik skor = kalite − LOAD_PENALTY·load + FIT_WEIGHT·uyum.
  // (Önceki: salt en az yüklü.) Yük dengelenir; eşit/yakın yükte kalite + pazar uyumu (hastanın ülkesi) belirler.
  // SO elektiftir → aciliyet–deneyim sinyali nötr kalır (urgency yok); pazar uyumu SOFT → pazar-dışı hoca da atanabilir.
  const ranked = await rankDoctorsByQuality(doctors, { loads, caseContext: { country: c.country } });
  const pick = ranked[0];

  await transitionSoCase(caseId, "OFFERED", {
    actorId: null,
    actorRole: "system",
    data: { assignedDoctorId: pick.id, assignedAt: new Date() },
  });

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
  const docUser = await db.user.findFirst({ where: { doctorId: pick.id }, select: { id: true } });
  if (docUser) {
    await notifyUser(docUser.id, {
      type: "SO_ASSIGNED",
      title: "🩺 İkinci Görüş — dosya önünüzde",
      body: `${branchLabel} · kabul bekleniyor`,
      href: `/doktor/ikinci-gorus/${caseId}`,
    });
  }
  return pick.id;
}

/**
 * Hoca dosyayı kabul eder/alır — ATOMİK (yalnız `status==OFFERED` iken; ilk kabul eden kazanır,
 * Ücretsiz Sağlık Hizmeti race-safe deseni). Yetki/pencere kontrolü çağırana (accept route) aittir.
 * `readyAt` = kabul anı (yazılı rapor SLA başlangıcı §11).
 */
export async function claimSoCase(caseId: string, doctorId: string, actor: Actor): Promise<boolean> {
  const now = new Date();
  const res = await db.secondOpinionCase.updateMany({
    where: { id: caseId, status: "OFFERED" },
    data: { status: "ASSIGNED", assignedDoctorId: doctorId, assignedAt: now, readyAt: now },
  });
  if (res.count === 0) return false;
  await logSoEvent(caseId, { actorId: actor.actorId, actorRole: actor.actorRole, action: "STATUS_CHANGE", detail: "OFFERED→ASSIGNED (kabul)" });
  return true;
}
