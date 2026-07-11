import Link from "next/link";
import { db } from "@/lib/db";
import { BRANCHES } from "@/lib/triage";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { formatDateTime } from "@/lib/constants";
import { Stethoscope, ArrowRight, Inbox, FileText, Bell, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

// Koordinatör aksiyonu bekleyen durumlar (kuyruğun üstünde)
const ACTION_STATUSES = ["PENDING_REVIEW", "READY_FOR_ASSIGNMENT"];

// İkinci Görüş — Koordinatör kuyruğu. Proxy /operasyon/* zaten OPS rolüyle korur.
export default async function SoQueuePage() {
  const cases = await db.secondOpinionCase.findMany({
    where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      documents: { select: { id: true } },
      requests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  const patientIds = [...new Set(cases.map((c) => c.patientId))];
  const users = await db.user.findMany({ where: { id: { in: patientIds } }, select: { id: true, name: true } });
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const sorted = [...cases].sort(
    (a, b) => (ACTION_STATUSES.includes(a.status) ? 0 : 1) - (ACTION_STATUSES.includes(b.status) ? 0 : 1),
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/operasyon" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/75">
        <ArrowLeft size={15} /> Operasyon paneli
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><Stethoscope size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F3]">İkinci Görüş — Kuyruk</h1>
          <p className="text-sm text-white/50">Belge incelemesi + eksik belge talebi + doktor ataması.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-[#161719] py-14 text-center">
            <Inbox className="mx-auto mb-2 text-white/25" size={28} />
            <p className="text-sm text-white/50">Aktif ikinci görüş vakası yok.</p>
          </div>
        )}

        {sorted.map((c) => {
          const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
          const needsAction = ACTION_STATUSES.includes(c.status);
          return (
            <Link
              key={c.id}
              href={`/operasyon/ikinci-gorus/${c.id}`}
              className={`block rounded-3xl border bg-[#161719] p-5 shadow-sm transition hover:shadow ${needsAction ? "border-[#28C8D8]/50" : "border-white/10"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#F4F5F3]">{nameById[c.patientId] ?? "Hasta"}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-[#1FA9B8]"><Stethoscope size={12} /> {branchLabel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${needsAction ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-white/50"}`}>
                      {SO_STATUS_LABELS[c.status as SoStatus] ?? c.status}
                    </span>
                    {c.requests.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/25">
                        <Bell size={11} /> hasta yanıtı bekleniyor
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-white/65">{c.diagnosisSummary}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                    <span className="inline-flex items-center gap-1"><FileText size={11} /> {c.documents.length} belge</span>
                    <span>· {formatDateTime(c.createdAt)}</span>
                  </div>
                </div>
                <ArrowRight size={16} className="mt-1 shrink-0 text-white/25" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
