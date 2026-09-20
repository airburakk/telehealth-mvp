// Hasta vaka listesi — GRUPLAMA + KEYSET SAYFALAMA + FİLTRE sözlüğü (kontrol raporu 2026-09-17 K09-hasta / H11, v6.281).
//
// Eskiden /vakalarim vaka türü başına `take: 100` ile tek kronolojik kart listesiydi: görünür arama/filtre/sayfalama
// yoktu, "aksiyon gerektiren" başvuru eski kayıtların arasında kayboluyordu. Artık:
//   · ÜÇ GRUP — "İşlem gerekiyor" (hastadan bir şey bekleyen) · "Devam eden" · "Tamamlanan"; sayılar SUNUCUDA count
//   · branş + tarih aralığı filtresi (URL parametreleri; sunucuda uygulanır)
//   · KEYSET sayfalama (createdAt + id çifti — tek alanlı orderBy deterministik değildir; imleç satırı silinse de
//     çalışır: `(createdAt, id) < imleç` karşılaştırması satırın varlığına bağlı değil) — [[prisma-cursor-sayfalama-tuzagi]]
//   · her kartta TEK "sıradaki adım" cümlesi (durum sözlüğü; TR kanonik, useT çevirir)
// Genel vaka (Case) ve İkinci Görüş (SecondOpinionCase) iki ayrı modeldir: aynı imleçle ikisinden de sayfa+1 çekilir,
// (createdAt, id) sırasıyla birleştirilir, sayfa kesilir → sonraki imleç sayfanın son satırıdır (mergeKeysetPage).
//
// Bu modül SAF'tır (Prisma çalışma zamanı yok — yalnız tip): istemci bileşen (MyCasesList) sözlükleri buradan alır.
import type { Prisma } from "@prisma/client";
import { BRANCHES } from "@/lib/triage";
import { OPEN_CASE_STATUSES } from "@/lib/case-access";
import { SO_STATUSES, type SoStatus } from "@/lib/second-opinion";

export const PATIENT_CASE_GROUPS = ["aksiyon", "devam", "tamam"] as const;
export type PatientCaseGroup = (typeof PATIENT_CASE_GROUPS)[number];
export const PATIENT_PAGE_SIZE = 20;

export const GROUP_LABELS: Record<PatientCaseGroup, string> = {
  aksiyon: "İşlem gerekiyor",
  devam: "Devam eden",
  tamam: "Tamamlanan",
};

// ── Genel vaka (Case) grupları — durum sözlüğü CASE_STATUS ile aynı anahtarlar ──
// İşlem gerekiyor: yalnız DOCS_PENDING (hasta eksik belgeyi yükler; v6.35). NEW/IN_REVIEW/IN_CONSULT hastadan işlem
// beklemez (doktor tarafı çalışır) → devam eden. DONE → tamamlanan.
export const CASE_GROUP_STATUSES: Record<PatientCaseGroup, readonly string[]> = {
  aksiyon: ["DOCS_PENDING"],
  devam: OPEN_CASE_STATUSES,
  tamam: ["DONE"],
};

// ── İkinci Görüş grupları — hastadan işlem bekleyen durumlar + PENDING talep (eksik belge / ek tetkik) ──
export const SO_ACTION_STATUSES: readonly SoStatus[] = ["DRAFT", "AWAITING_PAYMENT", "AWAITING_DOCUMENTS", "AWAITING_ADDITIONAL_TESTS", "VIDEO_OFFERED"];
export const SO_ONGOING_STATUSES: readonly SoStatus[] = ["PENDING_REVIEW", "OFFERED", "READY_FOR_ASSIGNMENT", "ASSIGNED", "VIDEO_SCHEDULED"];
export const SO_DONE_STATUSES: readonly SoStatus[] = ["OPINION_DELIVERED", "VIDEO_COMPLETED", "CLOSED", "CANCELLED"];

export type PatientListFilters = {
  /** BRANCHES.key — Case.branch ETİKET tutar (Case.branch=LABEL), SO.branch ANAHTAR; ikisi burada çözülür. */
  branch?: string;
  /** YYYY-MM-DD (dahil) */
  from?: string;
  /** YYYY-MM-DD (dahil) */
  to?: string;
};

export type PatientListParams = PatientListFilters & { group?: PatientCaseGroup; cursor?: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDay(s: string | undefined): string | undefined {
  if (!s || !DAY_RE.test(s)) return undefined;
  return Number.isNaN(Date.parse(`${s}T00:00:00.000Z`)) ? undefined : s;
}

/** URL parametrelerini doğrula — geçersiz değer sessizce yok sayılır (filtresiz), asla hata değil. */
export function parsePatientListParams(sp: Record<string, string | string[] | undefined>): PatientListParams {
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };
  const group = one("grup");
  const branch = one("branch");
  return {
    group: (PATIENT_CASE_GROUPS as readonly string[]).includes(group ?? "") ? (group as PatientCaseGroup) : undefined,
    branch: branch && BRANCHES.some((b) => b.key === branch) ? branch : undefined,
    from: validDay(one("from")),
    to: validDay(one("to")),
    cursor: decodeCursor(one("cursor")) ? one("cursor") : undefined,
  };
}

/** Tarih aralığı — gün sınırları UTC (hasta gün seçer; saat hassasiyeti aranmaz). */
function dateWhere(f: PatientListFilters): { createdAt?: { gte?: Date; lt?: Date } } {
  const c: { gte?: Date; lt?: Date } = {};
  if (f.from) c.gte = new Date(`${f.from}T00:00:00.000Z`);
  if (f.to) c.lt = new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000);
  return c.gte || c.lt ? { createdAt: c } : {};
}

/** Genel vaka grup kapsamı: sahiplik AND grup durumları AND filtreler. Sahiplik where'i çağırandan gelir (hasta =
 *  userId; ADMIN = {}); bu fonksiyon onu GENİŞLETEMEZ. */
export function caseGroupWhere(group: PatientCaseGroup, f: PatientListFilters, owner: Prisma.CaseWhereInput): Prisma.CaseWhereInput {
  const label = f.branch ? BRANCHES.find((b) => b.key === f.branch)?.label : undefined;
  return {
    AND: [
      owner,
      { status: { in: [...CASE_GROUP_STATUSES[group]] } },
      ...(label ? [{ branch: label }] : []),
      ...(f.from || f.to ? [dateWhere(f)] : []),
    ],
  };
}

/** İkinci Görüş grup kapsamı — bölümleme (her dosya TEK grupta): işlem gerekiyor = hasta-aksiyon durumu VEYA
 *  bekleyen talep · devam/tamam = kendi durumları VE bekleyen talep yok. */
export function soGroupWhere(group: PatientCaseGroup, f: PatientListFilters, owner: Prisma.SecondOpinionCaseWhereInput): Prisma.SecondOpinionCaseWhereInput {
  const pendingReq = { requests: { some: { status: "PENDING" } } };
  const groupWhere: Prisma.SecondOpinionCaseWhereInput =
    group === "aksiyon"
      ? { OR: [{ status: { in: [...SO_ACTION_STATUSES] } }, pendingReq] }
      : { status: { in: [...(group === "devam" ? SO_ONGOING_STATUSES : SO_DONE_STATUSES)] }, requests: { none: { status: "PENDING" } } };
  return {
    AND: [
      owner,
      groupWhere,
      ...(f.branch ? [{ branch: f.branch }] : []),
      ...(f.from || f.to ? [dateWhere(f)] : []),
    ],
  };
}

// ── Keyset imleç — "<createdAt ms>.<id>" (URL-güvenli; base64 gerekmez) ──
const CURSOR_RE = /^(\d{1,16})\.([A-Za-z0-9_-]{1,64})$/;
export function encodeCursor(row: { createdAt: Date | string; id: string }): string {
  const t = typeof row.createdAt === "string" ? Date.parse(row.createdAt) : row.createdAt.getTime();
  return `${t}.${row.id}`;
}
export function decodeCursor(s: string | undefined): { createdAt: Date; id: string } | null {
  if (!s) return null;
  const m = CURSOR_RE.exec(s);
  if (!m) return null;
  const t = Number(m[1]);
  if (!Number.isFinite(t) || t <= 0) return null;
  return { createdAt: new Date(t), id: m[2] };
}
/** `(createdAt, id) < imleç` — iki modelde de aynı şekil. İmleç yoksa boş (ilk sayfa). */
export type KeysetWhere = { OR?: Array<{ createdAt: { lt: Date } } | { createdAt: Date; id: { lt: string } }> };
export function keysetWhere(cursor: string | undefined): KeysetWhere {
  const c = decodeCursor(cursor);
  if (!c) return {};
  return { OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] };
}
/** Sıralama — createdAt önde, id eşitlik bozucu (Prisma iki modelde de kabul eder). */
export const KEYSET_ORDER = [{ createdAt: "desc" }, { id: "desc" }] as const satisfies readonly { createdAt?: "desc"; id?: "desc" }[];

export type KeysetItem = { createdAt: string; id: string };
/** İki kaynağı (her biri sayfa+1 satır) birleştir, sayfayı kes, sonraki imleci ver. */
export function mergeKeysetPage<T extends KeysetItem>(a: readonly T[], b: readonly T[], pageSize: number = PATIENT_PAGE_SIZE): { items: T[]; nextCursor: string | null } {
  const all = [...a, ...b].sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id));
  const items = all.slice(0, pageSize);
  const nextCursor = all.length > pageSize && items.length > 0 ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}

// ── "Sıradaki adım" sözlüğü — kart başına TEK cümle (H11). TR kanonik; useT hedef dile çevirir. ──
export const CASE_NEXT_STEP: Record<string, string> = {
  DOCS_PENDING: "Eksik belgeleri yükleyin — başvuru ancak o zaman doktor kuyruğuna girer.",
  NEW: "Doktor eşleşmesi bekleniyor; sizden bir işlem gerekmiyor.",
  IN_REVIEW: "Doktor dosyanızı inceliyor; görüşme daveti gelince bildirim alırsınız.",
  IN_CONSULT: "Görüşme sürüyor — başvuru özetinden görüşmeye katılın.",
  DONE: "Değerlendirme tamamlandı — sonuç ve raporunuz başvuru özetinde.",
};
export const CASE_NEXT_STEP_RECOVERY = "Değerlendirme tamamlandı — takip planınız açık, ölçümlerinizi Takip sayfasından girin.";
export const NEXT_STEP_PENDING_REQUEST = "Doktorun istediği belge/tetkiki yükleyin; dosya ondan sonra ilerler.";
export const SO_NEXT_STEP: Record<SoStatus, string> = {
  DRAFT: "Başvuruyu tamamlayın — belge ve ödeme adımı bekliyor.",
  AWAITING_PAYMENT: "Ödemeyi tamamlayın; dosya ondan sonra incelemeye alınır.",
  PENDING_REVIEW: "Dosyanız inceleniyor; sizden bir işlem gerekmiyor.",
  OFFERED: "Uzman doktorun kabulü bekleniyor.",
  AWAITING_DOCUMENTS: "İstenen eksik belgeyi yükleyin.",
  READY_FOR_ASSIGNMENT: "Doktor ataması bekleniyor.",
  ASSIGNED: "Doktor dosyanızı inceliyor; yazılı görüş hazırlanıyor.",
  AWAITING_ADDITIONAL_TESTS: "İstenen ek tetkiki yükleyin.",
  OPINION_DELIVERED: "Yazılı görüş hazır — raporu okuyun; video görüşme teklifi gelebilir.",
  VIDEO_OFFERED: "Video randevu teklifini onaylayın ya da değişiklik isteyin.",
  VIDEO_SCHEDULED: "Randevu saatinde görüşmeye katılın.",
  VIDEO_COMPLETED: "Görüşme tamamlandı — dosya kapanışa hazır.",
  CLOSED: "Dosya kapandı.",
  CANCELLED: "Başvuru iptal edildi.",
};
export function caseNextStep(status: string, extras: { hasRecovery: boolean }): string {
  if (status === "DONE" && extras.hasRecovery) return CASE_NEXT_STEP_RECOVERY;
  return CASE_NEXT_STEP[status] ?? CASE_NEXT_STEP.NEW;
}
export function soNextStep(status: string, hasPendingReq: boolean): string {
  const s = status as SoStatus;
  if (hasPendingReq && !SO_ACTION_STATUSES.includes(s)) return NEXT_STEP_PENDING_REQUEST;
  return SO_NEXT_STEP[s] ?? SO_NEXT_STEP.PENDING_REVIEW;
}
/** useT metin listesi için — bütün sözlük cümleleri (sabit; referans kararlı kalsın diye modül düzeyinde). */
export const NEXT_STEP_TEXTS: readonly string[] = [
  ...Object.values(CASE_NEXT_STEP),
  CASE_NEXT_STEP_RECOVERY,
  NEXT_STEP_PENDING_REQUEST,
  ...SO_STATUSES.map((s) => SO_NEXT_STEP[s]),
];
