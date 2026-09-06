// Kariyer EDU — KALICI MODEL erişimi (E2, 2026-09-06). Sunucu tarafı (db). Statik `lib/edu-opportunities` E1 SEED kaynağı ve tip/etiket
// sözlüğü olarak kalır (scripts/seed-edu-opportunities.ts DB'ye yükler); yüzeyler artık buradan okur.
// KURAL: approvedAt null → hiçbir yüzeyde görünmez (👤 kapısı; TUS/YÖK defterleriyle aynı sözleşme). ⚖️ Süreç bilgisi, ilan değil.
import { db } from "./db";
import type { EduOpportunityKind } from "./edu-opportunities";

export interface EduOpportunityView {
  id: string; kind: EduOpportunityKind; title: string; organizer: string; country: string | null;
  /** ISO gün ya da null. */ deadline: string | null; deadlineNote: string | null; startsAt: string | null;
  eligibility: string; sourceUrl: string; verifiedAt: string; approvedAt: string | null;
  /** Takip eden öğrenci sayısı (admin listesi için; öğrenci yüzeyinde kullanılmaz). */ followers?: number;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
type Row = { id: string; kind: string; title: string; organizer: string; country: string | null; deadline: Date | null; deadlineNote: string | null; startsAt: string | null; eligibility: string; sourceUrl: string; verifiedAt: Date; approvedAt: Date | null };
const toView = (r: Row): EduOpportunityView => ({
  id: r.id, kind: r.kind as EduOpportunityKind, title: r.title, organizer: r.organizer, country: r.country, deadline: day(r.deadline),
  deadlineNote: r.deadlineNote, startsAt: r.startsAt, eligibility: r.eligibility, sourceUrl: r.sourceUrl, verifiedAt: day(r.verifiedAt) as string, approvedAt: day(r.approvedAt),
});
/** Tarihli olanlar önce (yakın son başvuru üstte), tarihsizler (dönemsel) sonra; eşitlikte ad. */
const order = (a: EduOpportunityView, b: EduOpportunityView) => {
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title, "tr-TR");
  if (a.deadline) return -1; if (b.deadline) return 1;
  return a.title.localeCompare(b.title, "tr-TR");
};

/** Onaylı fırsatlar (öğrenci yüzeyi). */
export async function listApprovedEduOpportunities(): Promise<EduOpportunityView[]> {
  const rows = await db.eduOpportunity.findMany({ where: { approvedAt: { not: null } } });
  return rows.map(toView).sort(order);
}

/** Tüm kayıtlar + takipçi sayısı (admin). */
export async function listAllEduOpportunities(): Promise<EduOpportunityView[]> {
  const [rows, follows] = await Promise.all([
    db.eduOpportunity.findMany(),
    db.eduOpportunityFollow.groupBy({ by: ["opportunityId"], _count: { _all: true } }),
  ]);
  const cnt = new Map(follows.map((f) => [f.opportunityId, f._count._all]));
  return rows.map((r) => ({ ...toView(r), followers: cnt.get(r.id) ?? 0 })).sort(order);
}

/** Öğrencinin takip ettiği fırsat id'leri. */
export async function followedEduOpportunityIds(doctorId: string): Promise<Set<string>> {
  const rows = await db.eduOpportunityFollow.findMany({ where: { doctorId }, select: { opportunityId: true } });
  return new Set(rows.map((r) => r.opportunityId));
}

/** Takip aç/kapat — yalnız ONAYLI fırsat takip edilebilir (onaysız → false döner, satır açılmaz). */
export async function setEduFollow(doctorId: string, opportunityId: string, follow: boolean): Promise<{ ok: boolean; following: boolean }> {
  if (!follow) {
    await db.eduOpportunityFollow.deleteMany({ where: { doctorId, opportunityId } });
    return { ok: true, following: false };
  }
  const opp = await db.eduOpportunity.findUnique({ where: { id: opportunityId }, select: { id: true, approvedAt: true } });
  if (!opp?.approvedAt) return { ok: false, following: false };
  await db.eduOpportunityFollow.upsert({ where: { doctorId_opportunityId: { doctorId, opportunityId } }, create: { doctorId, opportunityId }, update: {} });
  return { ok: true, following: true };
}
