import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { severityMeta, type Severity } from "@/lib/postop";
import { recoveryClosed } from "@/lib/postop-access";
import { countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { decryptField } from "@/lib/crypto";
import { HeartPulse, Activity, Thermometer, ArrowRight, AlertTriangle, Inbox, Lock } from "lucide-react";
import { CompleteRecoveryButton } from "@/components/CompleteRecoveryButton";

export const dynamic = "force-dynamic";

const DOCTOR_ROLES = ["DOCTOR", "COORDINATOR", "ADMIN"];
const RANK: Record<Severity, number> = { RED: 0, WATCH: 1, NONE: 2 };

export default async function RecoveryMonitor() {
  // Derinlemesine savunma (2026-07-12): proxy /doktor/* TOKEN roluyle korur; post-op takip listesi
  // hasta adı + ağrı/ateş/şiddet (ÇÖZÜLMÜŞ PHI) gösterdiğinden getCurrentUser (DB-rol otoriter) ŞART.
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/doktor/takip");
  if (!DOCTOR_ROLES.includes(user.role)) redirect("/");

  const recoveries = await db.recovery.findMany({
    include: {
      case: { select: { patientName: true, country: true, branch: true } }, // listede yalnız kimlik+ülke+branş
      // not/foto (artık base64) bu listede gereksiz; yalnız SON kontrolün hafif scalar alanları (payload hafif kalsın)
      checkIns: { take: 1, orderBy: { createdAt: "desc" }, select: { severity: true, pain: true, feverC: true, createdAt: true } },
      _count: { select: { checkIns: true } }, // toplam kontrol sayısı — satırları çekmeden
    },
    orderBy: { startedAt: "desc" },
  });

  const all = recoveries.map((r) => {
    const last = r.checkIns[0];
    const severity = (last?.severity as Severity) ?? "NONE";
    const day = Math.max(1, Math.floor((Date.now() - new Date(r.startedAt).getTime()) / 86400000) + 1);
    // E2EE Faz 2A — tamamlanmış (manuel COMPLETED veya otomatik süre+tampon) takiplerde personel erişimi kapalı.
    const closed = recoveryClosed(r);
    return { r, last, severity, day, count: r._count.checkIns, closed };
  });

  const active = all.filter((x) => !x.closed.closed).sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  // Kapanma lazy hesaplandığından (DB alanı değil) dilim in-memory: en güncel 20 tamamlanan gösterilir.
  const completed = all.filter((x) => x.closed.closed).slice(0, 20);

  const redCount = active.filter((x) => x.severity === "RED").length;
  const watchCount = active.filter((x) => x.severity === "WATCH").length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><HeartPulse size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F3]">Post-Op İzleme</h1>
          <p className="text-sm text-white/50">Uzaktan iyileşme takibi — kırmızı bayraklı hastalar üstte.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Aktif takip" value={active.length} />
        <Stat label="İzlemde" value={watchCount} tone="text-amber-300" />
        <Stat label="Kırmızı bayrak" value={redCount} tone="text-red-300" />
      </div>

      <div className="mt-6 space-y-2.5">
        {active.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#161719] py-12 text-center text-white/40">
            <Inbox className="mx-auto mb-2" /> Aktif takipte hasta yok.
          </div>
        )}
        {active.map(({ r, last, severity, day, count }) => {
          const m = severityMeta(severity);
          return (
            <div
              key={r.id}
              className={`group flex items-center gap-4 rounded-2xl border bg-[#161719] p-4 transition hover:shadow-sm ${severity === "RED" ? "border-red-400/25" : "border-white/10 hover:border-[#28C8D8]/30"}`}
            >
              <Link href={`/takip/${r.caseId}`} className="flex min-w-0 flex-1 items-center gap-4">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${m.badge}`}>
                  {severity === "RED" ? <AlertTriangle size={20} /> : <HeartPulse size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#F4F5F3]">{decryptField(r.case.patientName)}</span>
                    <span className="text-xs text-white/40">{countryFlag(r.case.country)} {countryName(r.case.country)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.badge}`}>{m.label}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/50">
                    <span className="font-medium text-[#1FA9B8]">{r.branch}</span>
                    <span>· {day}. gün</span>
                    {last ? (
                      <>
                        <span className="inline-flex items-center gap-1"><Activity size={12} /> {last.pain}/10</span>
                        <span className="inline-flex items-center gap-1"><Thermometer size={12} /> {last.feverC.toFixed(1)}°C</span>
                        <span>· son: {formatDateTime(last.createdAt)}</span>
                      </>
                    ) : (
                      <span className="text-white/40">henüz kontrol yok</span>
                    )}
                    <span className="text-white/40">· {count} kontrol</span>
                  </div>
                </div>
              </Link>
              <CompleteRecoveryButton caseId={r.caseId} />
              <ArrowRight size={18} className="hidden shrink-0 text-white/25 sm:block" />
            </div>
          );
        })}
      </div>

      {/* E2EE Faz 2A — tamamlanmış takipler: klinik erişim hastaya devredildi → yalnız metadata, klinik içerik linki YOK. */}
      {completed.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
            <Lock size={13} /> Tamamlanan takipler · erişim hastada
          </div>
          <div className="mt-3 space-y-2">
            {completed.map(({ r, day, count, closed }) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1E1F22]/60 p-3.5 text-sm">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white/40"><Lock size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white/65">{decryptField(r.case.patientName)}</span>
                    <span className="text-xs text-white/40">{r.branch}</span>
                  </div>
                  <div className="text-xs text-white/40">
                    {closed.reason === "MANUAL" ? "Doktor tamamladı" : "Süre doldu (otomatik)"}
                    {r.completedAt ? ` · ${formatDateTime(r.completedAt)}` : ""} · {count} kontrol · {day}. gün
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/50">klinik erişim kapalı</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161719] p-3.5">
      <div className={`text-2xl font-bold ${tone ?? "text-[#F4F5F3]"}`}>{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
