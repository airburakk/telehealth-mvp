"use client";
import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { TusInstitutionType, TusPeriodSummary } from "@/lib/tus-normalize";

/**
 * TUS yerleştirme grafikleri (K1, 2026-09-05) — Recharts, YALNIZ client (TusChartsLoader ssr:false ile yükler).
 * Veri: onaylı dönem özetleri (lib/tus-data approvedTusSummaries → prop; DB yok, gerçek zamanlı yok). Renkler tema
 * token'larından (SVG presentation attribute'ları CSS değişkeni kabul eder): birincil = kitle aksanı (öğrencide koral,
 * doktorda zümrüt), boş kontenjan = --c-warning, ikincil = --c-ink-3. İDDİA DÜRÜSTLÜĞÜ: tahmin/eğri uydurma/"yerleşme
 * ihtimali" YOK — yalnız ÖSYM'nin yayımladığı geçmiş dönem sayıları; her grafik altında kaynak dönemler + "tavsiye değil".
 */
export interface TusChartsProps {
  periods: (TusPeriodSummary & { key: string; sourcePage: string; fetchedAt: string })[];
  branches: { branch: string; branchLabel: string; quota: number }[];
  institutionLabels: Record<TusInstitutionType, string>;
  initialBranch: string;
}

// Boş kontenjan = nötr gri (--c-ink-3): --c-warning gündüz temasında (#a94e08) koral aksana çok yakın çıkıyordu (prova 2026-09-05).
// Dolgu aksanı --c-accent-fill: öğrenci gündüzünde gece koralı, aksi hâlde --c-accent (globals.css, 2026-09-06).
const ACCENT = "var(--c-accent-fill)"; const WARN = "var(--c-ink-3)"; const INK3 = "var(--c-ink-3)"; const INK2 = "var(--c-ink-2)"; const HAIR = "var(--c-hairline)";
const label = (p: { year: number; term: number }) => `${p.year}/${p.term}`;
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }));

const tooltipStyle = { backgroundColor: "var(--c-panel)", border: "1px solid var(--c-hairline)", borderRadius: 10, color: "var(--c-ink)", fontSize: 12 };
const axisTick = { fill: INK2, fontSize: 11 };

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
      <h3 className="text-[15px] font-semibold text-[var(--c-ink)]">{title}</h3>
      <p className="mt-0.5 text-[12px] text-[var(--c-ink-2)]">{sub}</p>
      <div className="mt-3 h-64">{children}</div>
    </div>
  );
}

export default function TusCharts({ periods, branches, institutionLabels, initialBranch }: TusChartsProps) {
  const [branch, setBranch] = useState(initialBranch || branches[0]?.branch || "");
  const [periodKey, setPeriodKey] = useState(periods.at(-1)?.key ?? "");
  const period = periods.find((p) => p.key === periodKey) ?? periods.at(-1);

  const trend = periods.map((p) => {
    const b = p.byBranch.find((x) => x.branch === branch);
    return { name: label(p), taban: b?.minScore ?? null, medyan: b?.medianMinScore ?? null, kontenjan: b?.quota ?? 0, bos: b?.vacant ?? 0 };
  });
  const fill = periods.map((p) => ({ name: label(p), oran: p.totals.general.quota ? Math.round((p.totals.general.placed / p.totals.general.quota) * 1000) / 10 : 0, kontenjan: p.totals.general.quota, yerlesen: p.totals.general.placed }));
  const byType = (period?.byType ?? []).map((t) => ({ name: institutionLabels[t.type] ?? t.type, yerlesen: t.placed, bos: t.vacant }));
  const hist = (period?.minScoreHistogram ?? []).map(([lo, n]) => ({ name: `${lo}–${lo + 5}`, adet: n }));
  const branchLabel = branches.find((b) => b.branch === branch)?.branchLabel ?? branch;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">
          Branş
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--c-ink)]">
            {branches.map((b) => <option key={b.branch} value={b.branch}>{b.branchLabel}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">
          Dönem
          <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--c-ink)]">
            {periods.map((p) => <option key={p.key} value={p.key}>{p.year}-TUS {p.term}. Dönem</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`${branchLabel} — taban puan eğilimi`} sub="GENEL kontenjanda yerleşen olan programların en küçük puanı (en düşük ve medyan), dönemlere göre.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(typeof v === "number" ? v : null)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="taban" name="En düşük yerleşen puanı" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="medyan" name="Program medyanı" stroke={INK3} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`${branchLabel} — kontenjan ve boş kalan`} sub="GENEL kontenjan toplamı ve boş kalan kontenjan, dönemlere göre.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="kontenjan" name="Kontenjan" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="bos" name="Boş kalan" fill={WARN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`${period ? `${period.year}-TUS ${period.term}. Dönem` : ""} — kurum türüne göre yerleşme`} sub="GENEL kontenjan: yerleşen ve boş kalan, kurum türü gruplaması Doctorium'un (ÖSYM böyle bir sınıflama yayımlamaz).">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} horizontal={false} />
              <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} width={150} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="yerlesen" name="Yerleşen" stackId="a" fill={ACCENT} />
              <Bar dataKey="bos" name="Boş kalan" stackId="a" fill={WARN} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`${period ? `${period.year}-TUS ${period.term}. Dönem` : ""} — en küçük puan dağılımı`} sub="GENEL kontenjanda yerleşen olan programların en küçük puanları, 5 puanlık kovalarda (program sayısı).">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hist} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: HAIR }} interval={0} angle={-30} textAnchor="end" height={44} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="adet" name="Program sayısı" fill={ACCENT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Yerleşme oranı — tüm branşlar" sub="GENEL kontenjanda yerleşen / kontenjan (%), dönemlere göre.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fill} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 100]} width={52} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => (n === "Yerleşme oranı" ? `${fmt(typeof v === "number" ? v : null)} %` : fmt(typeof v === "number" ? v : null))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="oran" name="Yerleşme oranı" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kaynak: ÖSYM &ldquo;Yerleştirme Sonuçlarına İlişkin En Küçük ve En Büyük Puanlar&rdquo; tabloları ({periods.map((p) => label(p)).join(" · ")}); son çekim {periods.at(-1)?.fetchedAt}.
        Geçmiş dönem sayılarıdır; tercih tavsiyesi değildir, gelecek dönem puanlarını göstermez. Puanlar ÖSYM&apos;nin yayımladığı biçimdedir.
      </p>
    </div>
  );
}
