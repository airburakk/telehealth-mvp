import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { formatDateTime } from "@/lib/constants";
import { Stethoscope, ArrowRight, Inbox, FileText, Bell, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

// İkinci Görüş — doktora atanmış vakalar (§8: doktor yalnız kendi atanmış vakalarını görür).
export default async function DoctorSoListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/ikinci-gorus");
  if (!["DOCTOR", "ADMIN"].includes(user.role)) redirect("/");

  const me = user.role === "DOCTOR"
    ? await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } })
    : null;

  const where =
    user.role === "DOCTOR"
      ? { assignedDoctorId: me?.doctorId ?? "__none__", status: { notIn: ["CLOSED", "CANCELLED"] } }
      : { assignedDoctorId: { not: null }, status: { notIn: ["CLOSED", "CANCELLED"] } };

  const cases = await db.secondOpinionCase.findMany({
    where,
    orderBy: { assignedAt: "desc" },
    include: {
      documents: { select: { id: true } },
      requests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  const patientIds = [...new Set(cases.map((c) => c.patientId))];
  const users = await db.user.findMany({ where: { id: { in: patientIds } }, select: { id: true, name: true } });
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const sorted = [...cases].sort((a, b) => (a.status === "ASSIGNED" ? 0 : 1) - (b.status === "ASSIGNED" ? 0 : 1));

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Doktor paneli
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Stethoscope size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">İkinci Görüş — Atanan Vakalar</h1>
          <p className="text-sm text-slate-500">Dosyayı inceleyin, gerekirse ek tetkik isteyin, yazılı görüş sunun.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <Inbox className="mx-auto mb-2 text-slate-300" size={28} />
            <p className="text-sm text-slate-500">Size atanmış ikinci görüş vakası yok.</p>
          </div>
        )}

        {sorted.map((c) => {
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
    </div>
  );
}
