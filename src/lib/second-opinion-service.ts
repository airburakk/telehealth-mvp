// İkinci Görüş — sunucu servis katmanı. Durum geçişlerini TEK YERDE doğrular + denetim
// izi (§8) yazar. Tüm fazlar (hasta/koordinatör/doktor) bunu kullanır → DRY + tutarlı audit.
import { db } from "./db";
import { canTransition, type SoStatus } from "./second-opinion";

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
