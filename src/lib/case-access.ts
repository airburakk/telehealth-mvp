// Vaka LİSTE (koleksiyon) kapsamı — `canCaseBeAccessedBy`'ın ÇOĞUL karşılığı (soCaseListScope deseni).
//
// Kontrol raporu 2026-09-17 (K01/K02/K09): doktor ana sayfası (doktor/page.tsx) ile liste API'si
// (api/cases GET) AYRI `where` kuruyordu → sayfa dalında `doctorId: null` ve `deletionLockedAt: null`
// YOKTU (aynı branşta BAŞKA doktora atanmış ve silme-kilitli vakalar kuyruğa hasta adıyla giriyordu),
// API dalında ise klinik aktivasyon (activatedAt) bakılmıyordu. Artık iki yüzey de kapsamı BU dosyadan alır.
//
// DEĞİŞMEZ KURAL: liste ucu, nesne-düzeyi kapıdan (canCaseBeAccessedBy) DAHA GENİŞ veri döndüremez.
// Yeni bir vaka liste/sayım sorgusu yazarken bu fonksiyonları kullan; elle `where` kurma.
import type { Prisma } from "@prisma/client";

/** Doktor havuz dalında listelenen durumlar — doktor-yüzü sorgular NEW/IN_REVIEW allowlist'li kalır
 *  (DOCS_PENDING havuza düşmez; IN_CONSULT/DONE atanmamış olsa bile "havuz" değildir). */
export const DOCTOR_POOL_STATUSES = ["NEW", "IN_REVIEW"] as const;

/** Klinik doktor bağlamı — `clinicalDoctorFor` (doctor-activation) çıktısıyla birebir; null = profilsiz/aktivasyonsuz. */
export type ClinicalDoctorCtx = { doctorId: string; branch: string; verified: boolean };

/** Hiçbir satırla eşleşmeyen kapsam (fail-closed boş küme). Boş liste = "kapsamında vaka yok"; 401/403 = yetki
 *  sorusu, onu çağıran rol kapısı verir. */
export const EMPTY_CASE_SCOPE: Prisma.CaseWhereInput = { id: "__none__" };

/** DOCTOR liste kapsamı: kendisine atananlar + KENDİ branşındaki ATANMAMIŞ havuz (NEW/IN_REVIEW);
 *  silme-kilitliler hariç. Doğrulanmamış / aktivasyonsuz / branşsız doktor → boş küme. */
export function doctorQueueScope(ctx: ClinicalDoctorCtx | null): Prisma.CaseWhereInput {
  if (!ctx || !ctx.verified || !ctx.branch) return EMPTY_CASE_SCOPE;
  return {
    deletionLockedAt: null,
    OR: [
      { doctorId: ctx.doctorId },
      { doctorId: null, branch: ctx.branch, status: { in: [...DOCTOR_POOL_STATUSES] } },
    ],
  };
}

/** Personel (COORDINATOR/ETHICS/ADMIN) liste kapsamı: tüm kuyruk, silme-kilitliler hariç. */
export function staffQueueScope(): Prisma.CaseWhereInput {
  return { deletionLockedAt: null };
}

export type QueueFilters = { branch?: string; status?: string; urgent?: boolean };
export type QueueSort = "urgency" | "newest";

/** Sunucu filtreleri (branş/durum/acil) — kapsamla AND'lenir; kapsamı GENİŞLETEMEZ. */
export function queueFilterWhere(f: QueueFilters): Prisma.CaseWhereInput {
  return {
    ...(f.branch ? { branch: f.branch } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.urgent ? { urgency: { gte: 4 } } : {}),
  };
}

/** Kapsam + filtre birleşimi — sayfa ve API aynı birleştirmeyi kullanır. */
export function scopedWhere(scope: Prisma.CaseWhereInput, f: QueueFilters): Prisma.CaseWhereInput {
  const filter = queueFilterWhere(f);
  return Object.keys(filter).length ? { AND: [scope, filter] } : scope;
}

/** Sıralama: aciliyet önde (varsayılan) ya da en yeni önde. */
export function queueOrderBy(sort: QueueSort): Prisma.CaseOrderByWithRelationInput[] {
  return sort === "newest" ? [{ createdAt: "desc" }] : [{ urgency: "desc" }, { createdAt: "desc" }];
}

// Liste satır-DTO'su — TEK KAYNAK (sayfa + API). Tam kayıt (şifreli klinik metin, belge içeriği,
// telefon, sağlık beyanı) listede TAŞINMAZ. `attachments`/`tourismPlan`/`freeCare` yalnız türetim içindir
// (hasFiles / kulvar) — istemciye ham hâlleri gitmez.
export const CASE_LIST_SELECT = {
  id: true,
  patientName: true,
  country: true,
  language: true,
  branch: true,
  urgency: true,
  status: true,
  createdAt: true,
  attachments: true,
  tourismPlan: true,
  freeCare: true,
  doctor: { select: { title: true, name: true } },
} as const;

export type CaseLane = "telehealth" | "tourism" | "free";

/** Kulvar türetimi — öncelik hasta tarafıyla (vakalarim) aynı: turizm > ücretsiz > uzaktan sağlık. */
export function caseLaneOf(c: { tourismPlan: string | null; freeCare: boolean | null }): CaseLane {
  return c.tourismPlan ? "tourism" : c.freeCare ? "free" : "telehealth";
}
