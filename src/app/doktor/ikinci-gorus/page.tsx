import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { SO_STATUS_LABELS, isOfferExpired, type SoStatus } from "@/lib/second-opinion";
import { scrubText } from "@/lib/deidentify";
import { formatDateTime } from "@/lib/constants";
import { SoAcceptButton } from "./SoAcceptButton";
import { Stethoscope, ArrowRight, Inbox, FileText, ArrowLeft, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

// İkinci Görüş — doktor paneli (koordinatör YOK). Oto-atanan dosyalar KABUL bekler; kabul süresi
// dolanlar branş hocalarına "açık" görünür (ilk kabul eden alır). Kabul edilen vakalarda görüş sunulur.
export default async function DoctorSoListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/ikinci-gorus");
  if (!["DOCTOR", "ADMIN"].includes(user.role)) redirect("/");

  const isDoctor = user.role === "DOCTOR";
  const me = isDoctor ? await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } }) : null;
  const myDoctorId = me?.doctorId ?? "__none__";
  const myDoctor = isDoctor && me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true } })
    : null;

  // Bana atanmış/önüme düşen vakalar (OFFERED directed + ASSIGNED + diğer aktif)
  const mine = await db.secondOpinionCase.findMany({
    where: isDoctor
      ? { assignedDoctorId: myDoctorId, status: { notIn: ["CLOSED", "CANCELLED"] } }
      : { assignedDoctorId: { not: null }, status: { notIn: ["CLOSED", "CANCELLED"] } },
    orderBy: { assignedAt: "desc" },
    include: { documents: { select: { id: true } } },
  });

  // Açık dosyalar (lazy fan-out): kabul süresi DOLAN, branşıma uygun, bana ait OLMAYAN OFFERED vakalar
  const branchOffered = isDoctor && myDoctor
    ? await db.secondOpinionCase.findMany({
        where: { status: "OFFERED", branch: myDoctor.branch, assignedDoctorId: { not: myDoctorId } },
        orderBy: { assignedAt: "asc" },
        include: { documents: { select: { id: true } } },
      })
    : [];
  const openOffers = branchOffered.filter((c) => isOfferExpired(c.assignedAt));

  const offers = isDoctor ? [...mine.filter((c) => c.status === "OFFERED"), ...openOffers] : [];
  const assigned = isDoctor ? mine.filter((c) => c.status !== "OFFERED") : mine;

  const patientIds = [...new Set([...mine, ...openOffers].map((c) => c.patientId))];
  const users = await db.user.findMany({ where: { id: { in: patientIds } }, select: { id: true, name: true } });
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const sortedAssigned = [...assigned].sort((a, b) => (a.status === "ASSIGNED" ? 0 : 1) - (b.status === "ASSIGNED" ? 0 : 1));

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Doktor paneli
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Stethoscope size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">İkinci Görüş</h1>
          <p className="text-sm text-slate-500">Önünüze düşen dosyaları kabul edin; kabul ettiklerinizde yazılı görüş sunun.</p>
        </div>
      </div>

      {/* Kabul bekleyen dosyalar (oto-atanan + açık fan-out) */}
      {offers.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Kabul bekleyen dosyalar</h2>
          <div className="space-y-3">
            {offers.map((c) => {
              const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
              const open = c.assignedDoctorId !== myDoctorId; // açık fan-out (süre dolmuş)
              return (
                <div key={c.id} className="rounded-3xl border border-[#14C3D0]/50 bg-[#14C3D0]/[0.05] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Claim-ÖNCESİ kimlik yok (de-id kararı 2026-07-02) — ad kabul ile açılır */}
                        <span className="font-semibold text-slate-800">Anonim hasta</span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#0EA5B2]"><Stethoscope size={12} /> {branchLabel}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${open ? "bg-amber-100 text-amber-700" : "bg-[#14C3D0]/20 text-[#0E8A95]"}`}>
                          {open ? "Açık — süre doldu" : "Size atandı"}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{scrubText(c.diagnosisSummary, [nameById[c.patientId] ?? ""])}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1"><FileText size={11} /> {c.documents.length} belge</span>
                        {c.assignedAt && <span className="inline-flex items-center gap-1"><Clock size={11} /> {formatDateTime(c.assignedAt)}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <SoAcceptButton caseId={c.id} open={open} />
                      <Link href={`/doktor/ikinci-gorus/${c.id}`} className="text-xs font-medium text-slate-400 hover:text-slate-600">
                        Önizle →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Atanan (kabul edilmiş) vakalar */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Atanan vakalar</h2>
        <div className="space-y-3">
          {sortedAssigned.length === 0 && offers.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
              <Inbox className="mx-auto mb-2 text-slate-300" size={28} />
              <p className="text-sm text-slate-500">Size atanmış ikinci görüş vakası yok.</p>
            </div>
          )}
          {sortedAssigned.map((c) => {
            const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
            const needsOpinion = c.status === "ASSIGNED";
            return (
              <Link
                key={c.id}
                href={`/doktor/ikinci-gorus/${c.id}`}
                className={`block rounded-3xl border bg-white p-5 shadow-sm transition hover:shadow ${needsOpinion ? "border-[#14C3D0]/50" : "border-slate-200"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{nameById[c.patientId] ?? "Hasta"}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-[#0EA5B2]"><Stethoscope size={12} /> {branchLabel}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${needsOpinion ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        {SO_STATUS_LABELS[c.status as SoStatus] ?? c.status}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{c.diagnosisSummary}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><FileText size={11} /> {c.documents.length} belge</span>
                      {c.assignedAt && <span>· atandı {formatDateTime(c.assignedAt)}</span>}
                    </div>
                  </div>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-slate-300" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
