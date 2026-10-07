// İçerik takvimi — yuva DURUM MAKİNESİ (v6.328, 2026-10-06; v6.334: YAYINLANIYOR kilidi). SAF; DB'ye dokunmaz (servis geçişi buradan doğrular).
//
//   PLANNED ──pick/save──▶ DRAFT ──approve──▶ APPROVED ──claim──▶ PUBLISHING ──publish-ok──▶ PUBLISHED   (terminal)
//      ▲                    ▲  ▲                 │  │                │  │
//      │                    │  └─ save/pick/unapprove (onaylıyken DÜZENLEME ONAYI DÜŞÜRÜR: LegalTranslationApproval.textHash ilkesi)
//      │                    │                    │  └─publish-ok (ELLE: editör kendisi paylaşıp işaretledi) ──▶ PUBLISHED
//      │                    │                    │                    │  └─publish-fail──▶ FAILED ──retry──▶ APPROVED
//   restore ◀── SKIPPED ◀──skip── (PLANNED | DRAFT | APPROVED | FAILED)     └─retry (İNSAN: "yayınlanmadı") ──▶ APPROVED
//
// YAYINLANIYOR = otomasyonun içeriği ALDIĞI an (claim): EN FAZLA BİR KEZ yayın garantisi — ikinci koşu içeriği alamaz (yalnız APPROVED alınır).
// Otomasyon çökerse yuva bu durumda takılı KALIR; belirsizliği İNSAN çözer (kanalda var mı bakar: "elle yayınlandı" ya da "yayınlanmadı → yeniden dene").
// Bu durumda içerik düzenlenemez ve yuva atlanamaz (önce çözülmeli). Hata bildirimi (publish-fail) YALNIZ alınmış içerik için gelir.
//
// Durumlar şemada düz String (enum YOK — projede enum kullanılmaz); bu dosya tek geçerli kümedir. Tek editör: hazırlayan = onaylayan.
// IN_REVIEW (iki aşamalı onay) BİLİNÇLİ yok — 👤 kararı 2026-10-06; başka biri taslak hazırlamaya başlarsa eklenir.

export type PlanStatus = "PLANNED" | "DRAFT" | "APPROVED" | "PUBLISHING" | "PUBLISHED" | "SKIPPED" | "FAILED";

export const PLAN_STATUSES: readonly PlanStatus[] = ["PLANNED", "DRAFT", "APPROVED", "PUBLISHING", "PUBLISHED", "SKIPPED", "FAILED"];

export const STATUS_LABEL: Record<PlanStatus, string> = {
  PLANNED: "Planlandı",
  DRAFT: "Taslak",
  APPROVED: "Onaylı",
  PUBLISHING: "Yayınlanıyor",
  PUBLISHED: "Yayınlandı",
  SKIPPED: "Atlandı",
  FAILED: "Yayın hatası",
};

export type PlanEvent = "pick" | "save" | "approve" | "unapprove" | "skip" | "restore" | "claim" | "publish-ok" | "publish-fail" | "retry";

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
    case "claim":
      return cur === "APPROVED" ? "PUBLISHING" : null;
    case "publish-ok":
      return cur === "APPROVED" || cur === "PUBLISHING" ? "PUBLISHED" : null;
    case "publish-fail":
      return cur === "PUBLISHING" ? "FAILED" : null;
    case "retry":
      return cur === "FAILED" || cur === "PUBLISHING" ? "APPROVED" : null;
    default:
      return null;
  }
}

/** İçerik (kaynak/taslak/metin) düzenlenebilir mi — yayınlanan, yayınlanmakta olan ve atlanmış yuvada DEĞİL. */
export function isEditable(cur: PlanStatus): boolean {
  return cur === "PLANNED" || cur === "DRAFT" || cur === "APPROVED";
}
