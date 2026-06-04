import Link from "next/link";
import { db } from "@/lib/db";
import { severityMeta, type Severity } from "@/lib/postop";
import { countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { HeartPulse, Activity, Thermometer, ArrowRight, AlertTriangle, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

const RANK: Record<Severity, number> = { RED: 0, WATCH: 1, NONE: 2 };

export default async function RecoveryMonitor() {
  const recoveries = await db.recovery.findMany({
    include: { case: true, checkIns: { orderBy: { createdAt: "desc" } } },
    orderBy: { startedAt: "desc" },
  });

  const rows = recoveries
    .map((r) => {
      const last = r.checkIns[0];
      const severity = (last?.severity as Severity) ?? "NONE";
      const day = Math.max(1, Math.floor((Date.now() - new Date(r.startedAt).getTime()) / 86400000) + 1);
      return { r, last, severity, day, count: r.checkIns.length };
    })
    .sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  const redCount = rows.filter((x) => x.severity === "RED").length;
  const watchCount = rows.filter((x) => x.severity === "WATCH").length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0f2a4a] text-white"><HeartPulse size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#0f2a4a]">Post-Op İzleme</h1>
          <p className="text-sm text-slate-500">Uzaktan iyileşme takibi — kırmızı bayraklı hastalar üstte.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Takipteki hasta" value={rows.length} />
        <Stat label="İzlemde" value={watchCount} tone="text-amber-600" />
        <Stat label="Kırmızı bayrak" value={redCount} tone="text-red-600" />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-slate-400">
            <Inbox className="mx-auto mb-2" /> Takipte hasta yok.
          </div>
        )}
        {rows.map(({ r, last, severity, day, count }) => {
          const m = severityMeta(severity);
          return (
            <Link
              key={r.id}
              href={`/takip/${r.caseId}`}
              className={`group flex items-center gap-4 rounded-xl border bg-white p-4 transition hover:shadow-sm ${severity === "RED" ? "border-red-200" : "border-slate-200 hover:border-[#0f2a4a]/30"}`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${m.badge}`}>
                {severity === "RED" ? <AlertTriangle size={20} /> : <HeartPulse size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{r.case.patientName}</span>
                  <span className="text-xs text-slate-400">{countryFlag(r.case.country)} {countryName(r.case.country)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.badge}`}>{m.label}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span className="font-medium text-[#16467a]">{r.branch}</span>
                  <span>· {day}. gün</span>
                  {last ? (
                    <>
                      <span className="inline-flex items-center gap-1"><Activity size={12} /> {last.pain}/10</span>
                      <span className="inline-flex items-center gap-1"><Thermometer size={12} /> {last.feverC.toFixed(1)}°C</span>
                      <span>· son: {formatDateTime(last.createdAt)}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">henüz kontrol yok</span>
                  )}
                  <span className="text-slate-400">· {count} kontrol</span>
                </div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0f2a4a]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className={`text-2xl font-bold ${tone ?? "text-[#0f2a4a]"}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
