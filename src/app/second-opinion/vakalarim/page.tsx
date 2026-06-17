import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { formatDateTime } from "@/lib/constants";
import { Stethoscope, Plus, ArrowRight, Inbox, Bell } from "lucide-react";

export const dynamic = "force-dynamic";

// İkinci görüş vakalarım — hastanın kendi SO başvuruları (sahiplik: patientId).
export default async function SoMyCasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/second-opinion/vakalarim");
  if (!["PATIENT", "ADMIN"].includes(user.role)) redirect("/");

  const cases = await db.secondOpinionCase.findMany({
    where: user.role === "PATIENT" ? { patientId: user.id } : {},
    orderBy: { createdAt: "desc" },
    include: {
      payment: { select: { status: true } },
      requests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Stethoscope size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#101010]">İkinci Görüş Vakalarım</h1>
            <p className="text-sm text-slate-500">Uzmandan bağımsız değerlendirme başvurularınız.</p>
          </div>
        </div>
        <Link href="/second-opinion/basvur" className="inline-flex items-center gap-1.5 rounded-lg bg-[#14C3D0] px-4 py-2 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
          <Plus size={16} /> Yeni ikinci görüş
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {cases.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <Inbox className="mx-auto mb-2 text-slate-300" size={28} />
            <p className="text-sm text-slate-500">Henüz ikinci görüş başvurunuz yok.</p>
            <Link href="/second-opinion/basvur" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#14C3D0] px-4 py-2 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
              <Plus size={15} /> Başvuru oluştur
            </Link>
          </div>
        )}

        {cases.map((c) => {
          const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
          const hasPendingReq = c.requests.length > 0;
          return (
            <Link
              key={c.id}
              href={`/second-opinion/vaka/${c.id}`}
              className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#14C3D0]/40 hover:shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <Stethoscope size={14} className="text-[#0EA5B2]" /> {branchLabel}
                    </span>
                    <span className="rounded-full bg-[#14C3D0]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0E8A95]">{SO_STATUS_LABELS[c.status as SoStatus] ?? c.status}</span>
                    {hasPendingReq && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                        <Bell size={11} /> İşlem gerekiyor
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{c.diagnosisSummary}</p>
                  <div className="mt-1 text-xs text-slate-400">{formatDateTime(c.createdAt)}</div>
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
