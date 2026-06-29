import Link from "next/link";
import { db } from "@/lib/db";
import { countryFlag, countryName } from "@/lib/constants";
import { formatUSD } from "@/lib/pricing";
import {
  BarChart3, Users, Luggage, Wallet, Scale, AlertTriangle, Stethoscope,
  TrendingUp, Filter, HeartPulse, ShieldCheck, Video, ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Operasyon Paneli (S2) — vaka hacmi, dönüşüm hunisi, gelir/Escrow, doktor kapasite, trend.
// Salt server component: tüm metrikler istek anında canlı DB'den hesaplanır.
export default async function OperationsDashboard() {
  const [cases, consultations, bookings, recoveries, complaints, doctors] = await Promise.all([
    db.case.findMany({ select: { id: true, branch: true, country: true, status: true, urgency: true, payStatus: true, consultFee: true, createdAt: true } }),
    db.consultation.findMany({ select: { id: true, caseId: true, doctorId: true, status: true } }),
    db.booking.findMany({ where: { status: "CONFIRMED" }, select: { caseId: true, tier: true, escrowStatus: true, platformFee: true, total: true } }), // DRAFT teklifler hariç (yalnız onaylı rezervasyonlar)
    db.recovery.findMany({ include: { checkIns: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    db.complaint.findMany({ select: { status: true, action: true, refundAmount: true } }),
    db.doctor.findMany({ select: { id: true, name: true, title: true, branch: true, capacity: true, color: true } }),
  ]);

  // ── Dönüşüm hunisi ──
  const consultCaseIds = new Set(consultations.map((c) => c.caseId));
  const bookingCaseIds = new Set(bookings.map((b) => b.caseId));
  const funnel = [
    { label: "Triyaj (vaka)", count: cases.length, icon: <Filter size={14} /> },
    { label: "Görüşme", count: consultCaseIds.size, icon: <Video size={14} /> },
    { label: "Rezervasyon (Escrow)", count: bookingCaseIds.size, icon: <Luggage size={14} /> },
    { label: "Post-Op takip", count: recoveries.length, icon: <HeartPulse size={14} /> },
  ];
  const funnelMax = Math.max(1, funnel[0].count);

  // ── Gelir ──
  const bookingRevenue = bookings.reduce((a, b) => a + b.total, 0);
  const platformFees = bookings.reduce((a, b) => a + b.platformFee, 0);
  const consultPaid = cases.filter((c) => c.payStatus === "PAID");
  const consultFeeRevenue = consultPaid.reduce((a, c) => a + (c.consultFee ?? 0), 0);
  const insuredCount = cases.filter((c) => c.payStatus === "INSURED").length;
  const escrowSums: Record<string, number> = { HELD: 0, RELEASED: 0, REFUNDED: 0 };
  for (const b of bookings) escrowSums[b.escrowStatus] = (escrowSums[b.escrowStatus] ?? 0) + b.total;
  const tierCounts: Record<string, number> = {};
  for (const b of bookings) tierCounts[b.tier] = (tierCounts[b.tier] ?? 0) + 1;

  // ── Sağlık & kalite ──
  const redFlags = recoveries.filter((r) => r.checkIns[0]?.severity === "RED").length;
  const pendingComplaints = complaints.filter((c) => c.status === "PENDING").length;
  const refundedTotal = complaints.reduce((a, c) => a + (c.refundAmount ?? 0), 0);
  const urgent = cases.filter((c) => c.urgency >= 4).length;

  // ── Dağılımlar ──
  const byBranch: Record<string, number> = {};
  for (const c of cases) byBranch[c.branch] = (byBranch[c.branch] ?? 0) + 1;
  const branchRows = Object.entries(byBranch).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const branchMax = Math.max(1, ...branchRows.map(([, n]) => n));

  const byCountry: Record<string, number> = {};
  for (const c of cases) byCountry[c.country] = (byCountry[c.country] ?? 0) + 1;
  const countryRows = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);

  // ── Doktor aktivite/kapasite (görüşme sayısı / aylık kapasite) ──
  const consultByDoctor: Record<string, number> = {};
  for (const c of consultations) consultByDoctor[c.doctorId] = (consultByDoctor[c.doctorId] ?? 0) + 1;
  const doctorRows = doctors
    .map((d) => ({ ...d, consults: consultByDoctor[d.id] ?? 0 }))
    .sort((a, b) => b.consults - a.consults)
    .slice(0, 6);

  // ── Son 14 gün vaka trendi (Europe/Istanbul sabit — hydration güvenli) ──
  const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", timeZone: "Europe/Istanbul" });
  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    days.push({ key: dayFmt.format(d), label: dayFmt.format(d), count: 0 });
  }
  for (const c of cases) {
    const k = dayFmt.format(c.createdAt);
    const slot = days.find((x) => x.key === k);
    if (slot) slot.count++;
  }
  const trendMax = Math.max(1, ...days.map((d) => d.count));

  const STATUS_LABELS: Record<string, string> = { NEW: "Yeni", IN_REVIEW: "İncelemede", IN_CONSULT: "Görüşmede", DONE: "Tamamlandı" };
  const byStatus: Record<string, number> = {};
  for (const c of cases) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

  // İkinci Görüş — koordinatör kuyruğu özeti
  const [soReviewCount, soActiveCount] = await Promise.all([
    db.secondOpinionCase.count({ where: { status: "PENDING_REVIEW" } }),
    db.secondOpinionCase.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><BarChart3 size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Operasyon Paneli</h1>
          <p className="text-sm text-slate-500">S2 Operasyon Şirketi · canlı platform metrikleri</p>
        </div>
      </div>

      <Link href="/operasyon/ikinci-gorus" className="mt-5 flex items-center gap-3 rounded-3xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.06] p-4 transition hover:bg-[#14C3D0]/[0.1]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Stethoscope size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#101010]">İkinci Görüş — Koordinatör Kuyruğu</div>
          <p className="text-xs text-slate-500">{soActiveCount} aktif vaka · belge inceleme + doktor atama</p>
        </div>
        {soReviewCount > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{soReviewCount} inceleme bekliyor</span>}
        <ArrowRight size={16} className="shrink-0 text-[#0E8A95]" />
      </Link>

      <Link href="/operasyon/lojistik" className="mt-3 flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-700"><Luggage size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#101010]">Lojistik Takip — Patient Journey</div>
          <p className="text-xs text-slate-500">Onaylı rezervasyonların karşılama · konaklama · tedavi · dönüş aşamalarını yönet</p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-[#0E8A95]" />
      </Link>

      {/* KPI kartları */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<Users size={16} />} label="Toplam vaka" value={String(cases.length)} sub={`${urgent} yüksek aciliyet`} />
        <Kpi icon={<Video size={16} />} label="Görüşme" value={String(consultations.length)} sub={`${consultations.filter((c) => c.status === "ACTIVE").length} aktif`} />
        <Kpi icon={<Wallet size={16} />} label="Rezervasyon geliri" value={formatUSD(bookingRevenue)} sub={`${bookings.length} paket`} />
        <Kpi icon={<ShieldCheck size={16} />} label="Platform komisyonu" value={formatUSD(platformFees)} sub="Escrow %15" tone="text-emerald-700" />
        <Kpi icon={<Scale size={16} />} label="Bekleyen şikayet" value={String(pendingComplaints)} sub={refundedTotal ? `${formatUSD(refundedTotal)} iade` : "iade yok"} tone={pendingComplaints ? "text-amber-600" : undefined} />
        <Kpi icon={<AlertTriangle size={16} />} label="Kırmızı bayrak" value={String(redFlags)} sub={`${recoveries.length} takipte`} tone={redFlags ? "text-red-600" : undefined} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Dönüşüm hunisi */}
        <Section icon={<Filter size={15} />} title="Dönüşüm Hunisi">
          <div className="space-y-3">
            {funnel.map((f, i) => {
              const pct = Math.round((f.count / funnelMax) * 100);
              const conv = i === 0 ? null : funnel[i - 1].count ? Math.round((f.count / funnel[i - 1].count) * 100) : 0;
              return (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">{f.icon} {f.label}</span>
                    <span className="font-semibold text-slate-800">{f.count}{conv != null && <span className="ml-1.5 text-xs font-normal text-slate-400">↓ %{conv}</span>}</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-slate-100">
                    <div className="h-2.5 rounded-full bg-[#0EA5B2]" style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
            {Object.entries(byStatus).map(([k, n]) => (
              <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{STATUS_LABELS[k] ?? k}: <b>{n}</b></span>
            ))}
          </div>
        </Section>

        {/* Gelir & Escrow */}
        <Section icon={<Wallet size={15} />} title="Gelir & Escrow">
          <div className="grid grid-cols-3 gap-2 text-center">
            <EscrowBox label="Emanette (HELD)" value={formatUSD(escrowSums.HELD)} cls="bg-amber-50 text-amber-700 ring-amber-200" />
            <EscrowBox label="Serbest (RELEASED)" value={formatUSD(escrowSums.RELEASED)} cls="bg-emerald-50 text-emerald-700 ring-emerald-200" />
            <EscrowBox label="İade (REFUNDED)" value={formatUSD(escrowSums.REFUNDED)} cls="bg-red-50 text-red-700 ring-red-200" />
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <Row k="Ön-konsültasyon tahsilatı" v={`${formatUSD(consultFeeRevenue)} · ${consultPaid.length} ödeme`} />
            <Row k="Sigortalı görüşme" v={`${insuredCount} vaka (poliçeden)`} />
            <Row k="Paket seviyeleri" v={Object.entries(tierCounts).map(([t, n]) => `${t}: ${n}`).join(" · ") || "—"} />
            <Row k="Ortalama paket değeri" v={bookings.length ? formatUSD(Math.round(bookingRevenue / bookings.length)) : "—"} />
          </div>
        </Section>

        {/* Branş dağılımı */}
        <Section icon={<Stethoscope size={15} />} title="Branş Dağılımı (vaka)">
          <div className="space-y-2">
            {branchRows.map(([branch, n]) => (
              <div key={branch}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-600">{branch}</span>
                  <span className="ml-2 shrink-0 font-semibold text-slate-800">{n}</span>
                </div>
                <div className="mt-0.5 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-teal-600" style={{ width: `${Math.max(4, Math.round((n / branchMax) * 100))}%` }} />
                </div>
              </div>
            ))}
            {branchRows.length === 0 && <p className="text-sm text-slate-400">Henüz vaka yok.</p>}
          </div>
        </Section>

        {/* Ülke dağılımı + trend */}
        <Section icon={<TrendingUp size={15} />} title="Pazar & Trend">
          <div className="flex flex-wrap gap-2">
            {countryRows.map(([code, n]) => (
              <span key={code} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {countryFlag(code)} {countryName(code)} <b>{n}</b>
              </span>
            ))}
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Son 14 gün · yeni vaka</div>
            <div className="mt-2 flex h-24 items-end gap-1">
              {days.map((d) => (
                <div key={d.key} className="group relative flex-1">
                  <div
                    className={`w-full rounded-t ${d.count ? "bg-[#0EA5B2]" : "bg-slate-100"}`}
                    style={{ height: `${d.count ? Math.max(12, Math.round((d.count / trendMax) * 96)) : 4}px` }}
                    title={`${d.label}: ${d.count} vaka`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>{days[0].label}</span><span>{days[days.length - 1].label}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Doktor aktivite/kapasite */}
      <div className="mt-5">
        <Section icon={<Users size={15} />} title="Doktor Aktivitesi & Kapasite (görüşme / aylık kapasite)">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {doctorRows.map((d) => {
              const pct = Math.min(100, Math.round((d.consults / Math.max(1, d.capacity)) * 100));
              return (
                <div key={d.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: d.color }}>{d.name.slice(0, 1)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{d.title} {d.name}</div>
                      <div className="truncate text-xs text-slate-500">{d.branch}</div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                    <span>{d.consults} görüşme</span><span>kapasite {d.capacity}/ay · %{pct}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">İlk 6 doktor, tamamlanan+aktif görüşme sayısına göre. Doluluk: görüşme / aylık işlem kapasitesi.</p>
        </Section>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon} {label}</div>
      <div className={`mt-1 text-xl font-bold ${tone ?? "text-[#101010]"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon} {title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EscrowBox({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`rounded-2xl px-2 py-3 ring-1 ${cls}`}>
      <div className="text-sm font-bold">{value}</div>
      <div className="mt-0.5 text-[10px] leading-tight opacity-80">{label}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className="text-right font-medium text-slate-800">{v}</span>
    </div>
  );
}
