import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import { formatDateTime } from "@/lib/constants";
import { branchKeyFromLabel, branchLabel, getBranchProcedures, getByCodes } from "@/lib/procedures";
import ProcedureSelector from "@/components/ProcedureSelector";
import { Star, BadgeCheck, Wallet, CalendarClock, TrendingUp, ExternalLink, Award, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const CONSULT_FEE = 150;
const COMMISSION = 0.2;

export default async function DoctorDashboard() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id } }) : null;
  const doctor = u?.doctorId
    ? await db.doctor.findUnique({
        where: { id: u.doctorId },
        include: { reviews: true, consultations: { include: { case: true }, orderBy: { startedAt: "desc" } } },
      })
    : null;

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-[#0A3F39]">Hekim profili bağlı değil</h1>
        <p className="mt-2 text-sm text-slate-500">Bu hesap bir hekim profiline bağlı değil (ör. koordinatör). Vaka kuyruğuna gidin.</p>
        <Link href="/doktor" className="mt-5 inline-flex rounded-lg bg-[#0E9E97] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A7D77]">Doktor Paneli</Link>
      </div>
    );
  }

  const net = CONSULT_FEE * (1 - COMMISSION);
  const ended = doctor.consultations.filter((c) => c.status === "ENDED");
  const earnings = ended.map((c) => ({ id: c.id, patient: c.case.patientName, date: c.endedAt ?? c.startedAt, net }));
  const totalNet = earnings.reduce((a, b) => a + b.net, 0);

  // M5 — Yaptığım İşlemler & Fiyatlandırma (branşa göre tarife + taban/tavan fiyat)
  const branchKey = branchKeyFromLabel(doctor.branch);
  const branchItems = branchKey ? getBranchProcedures(branchKey) : [];
  let initialSel: Record<string, number> = {};
  try {
    initialSel = doctor.procedures ? (JSON.parse(doctor.procedures) as Record<string, number>) : {};
  } catch {
    initialSel = {};
  }
  const branchCodes = new Set(branchItems.map((p) => p.code));
  const extraItems = getByCodes(Object.keys(initialSel).filter((c) => !branchCodes.has(c)));

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      {/* Hero */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-bold text-white" style={{ background: doctor.color }}>{doctor.name.slice(0, 1)}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold text-slate-800">{doctor.title} {doctor.name}</h1>
                {doctor.verified && <BadgeCheck size={16} className="text-teal-600" />}
              </div>
              <div className="text-sm font-medium text-[#0A7D77]">{doctor.branch} · {doctor.city}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-sm text-amber-600"><Star size={14} className="fill-amber-400 text-amber-400" /> {doctor.rating.toFixed(1)} <span className="text-slate-400">({doctor.reviews.length} yorum)</span></div>
            </div>
          </div>
          <Link href={`/hekim/${doctor.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ExternalLink size={15} /> Herkese açık profil
          </Link>
        </div>
      </div>

      {/* İtibar dashboard */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<Star size={16} />} value={doctor.rating.toFixed(1)} label="Memnuniyet" />
        <Metric icon={<TrendingUp size={16} />} value={`%${doctor.successRate}`} label="Başarı oranı" />
        <Metric icon={<Users size={16} />} value={`${ended.length}`} label="Tamamlanan görüşme" />
        <Metric icon={<Award size={16} />} value={`${doctor.experienceYears} yıl`} label="Deneyim" />
      </div>

      {/* M5 — Yaptığım İşlemler & Fiyatlandırma */}
      {branchKey && (
        <div className="mt-5">
          <ProcedureSelector
            branchKey={branchKey}
            branchLabel={branchLabel(branchKey)}
            branchItems={branchItems}
            initial={initialSel}
            extraItems={extraItems}
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Hakediş */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Wallet size={15} /> Hakediş</div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Toplam net (komisyon sonrası)</div>
              <div className="text-xl font-bold text-emerald-600">{formatUSD(totalNet)}</div>
            </div>
          </div>
          {earnings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Henüz tamamlanmış görüşme yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {earnings.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-slate-700">Konsültasyon · {e.patient}</div>
                    <div className="text-xs text-slate-400">{formatDateTime(e.date)} · brüt {formatUSD(CONSULT_FEE)} · %{COMMISSION * 100} komisyon</div>
                  </div>
                  <span className="font-semibold text-slate-800">{formatUSD(e.net)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-400">Tedavi paketi payları ay sonu mutabakatında eklenir (demo).</p>
        </div>

        {/* Kapasite + müsaitlik */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarClock size={15} /> Aylık Kapasite</div>
            <div className="mt-3">
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-[#0A3F39]">{ended.length}<span className="text-base font-normal text-slate-400">/{doctor.capacity}</span></span>
                <span className="text-xs text-slate-500">işlem</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#0E9E97]" style={{ width: `${Math.min(100, (ended.length / doctor.capacity) * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarClock size={15} /> Müsaitlik (demo)</div>
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[11px]">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz", "—"].slice(0, 7).map((g, i) => (
                <div key={g} className={`rounded-md py-2 ${i < 5 ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"}`}>{g}<div className="font-semibold">{i < 5 ? "09-17" : "—"}</div></div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 text-sm text-slate-600">
            <div className="font-semibold text-teal-800">Operasyonel yük sıfır</div>
            <p className="mt-1 text-xs">Organizasyon, çeviri ve lojistik platformda. Siz yalnız tıbbi görüşe odaklanın.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-1.5 text-slate-400">{icon}</div>
      <div className="mt-1 text-xl font-bold text-[#0A3F39]">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
