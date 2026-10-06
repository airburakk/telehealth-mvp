// İçerik takvimi — yuva DURUM MAKİNESİ (v6.328, 2026-10-06). SAF; DB'ye dokunmaz (servis geçişi buradan doğrular).
//
//   PLANNED ──pick/save──▶ DRAFT ──approve──▶ APPROVED ──publish-ok──▶ PUBLISHED   (terminal)
//      ▲                    ▲  ▲                 │  │
//      │                    │  └─ save/pick/unapprove (onaylıyken DÜZENLEME ONAYI DÜŞÜRÜR: LegalTranslationApproval.textHash ilkesi)
//      │                    │                    │  └─publish-fail──▶ FAILED ──retry──▶ APPROVED
//   restore ◀── SKIPPED ◀──skip── (PLANNED | DRAFT | APPROVED | FAILED)
//
// Durumlar şemada düz String (enum YOK — projede enum kullanılmaz); bu dosya tek geçerli kümedir. Tek editör: hazırlayan = onaylayan.
// IN_REVIEW (iki aşamalı onay) BİLİNÇLİ yok — 👤 kararı 2026-10-06; başka biri taslak hazırlamaya başlarsa eklenir.

export type PlanStatus = "PLANNED" | "DRAFT" | "APPROVED" | "PUBLISHED" | "SKIPPED" | "FAILED";

export const PLAN_STATUSES: readonly PlanStatus[] = ["PLANNED", "DRAFT", "APPROVED", "PUBLISHED", "SKIPPED", "FAILED"];

export const STATUS_LABEL: Record<PlanStatus, string> = {
  PLANNED: "Planlandı",
  DRAFT: "Taslak",
  APPROVED: "Onaylı",
  PUBLISHED: "Yayınlandı",
  SKIPPED: "Atlandı",
  FAILED: "Yayın hatası",
};

export type PlanEvent = "pick" | "save" | "approve" | "unapprove" | "skip" | "restore" | "publish-ok" | "publish-fail" | "retry";

export function isPlanStatus(s: unknown): s is PlanStatus {
  return typeof s === "string" && (PLAN_STATUSES as readonly string[]).includes(s);
}

/**
 * Olay sonrası durum; geçersiz geçiş → null (servis 409/400 verir).
 * `hasPayload`: SKIPPED → restore hedefini belirler (taslak varsa DRAFT, yoksa PLANNED — veri atlama sırasında KALIR).
 */
export function nextStatus(cur: PlanStatus, ev: PlanEvent, ctx: { hasPayload?: boolean } = {}): PlanStatus | null {
  switch (ev) {
    case "pick":
    case "save":
      return cur === "PLANNED" || cur === "DRAFT" || cur === "APPROVED" ? "DRAFT" : null;
    case "approve":
      return cur === "DRAFT" ? "APPROVED" : null;
    case "unapprove":
      return cur === "APPROVED" ? "DRAFT" : null;
    case "skip":
      return cur === "PLANNED" || cur === "DRAFT" || cur === "APPROVED" || cur === "FAILED" ? "SKIPPED" : null;
    case "restore":
      return cur === "SKIPPED" ? (ctx.hasPayload ? "DRAFT" : "PLANNED") : null;
    case "publish-ok":
      return cur === "APPROVED" ? "PUBLISHED" : null;
    case "publish-fail":
      return cur === "APPROVED" ? "FAILED" : null;
    case "retry":
      return cur === "FAILED" ? "APPROVED" : null;
    default:
      return null;
  }
}

/** İçerik (kaynak/taslak/metin) düzenlenebilir mi — yayınlanmış ve atlanmış yuvada DEĞİL. */
export function isEditable(cur: PlanStatus): boolean {
  return cur === "PLANNED" || cur === "DRAFT" || cur === "APPROVED";
}
