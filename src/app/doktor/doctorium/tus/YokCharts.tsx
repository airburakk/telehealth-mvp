"use client";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { YokTipSummary, YokUniType } from "@/lib/yok-normalize";
import type { YokRowLite } from "@/lib/yok-data";

/**
 * YÖK Atlas — Tıp fakülteleri grafikleri + program tablosu (K5, 2026-09-05). Recharts, YALNIZ client (YokChartsLoader ssr:false).
 * Veri: onaylı yıl anlık görüntüsü (lib/yok-data → prop) + ÖSYM TUS GENEL kontenjanı yıllara göre (lib/tus-data → prop).
 * İDDİA DÜRÜSTLÜĞÜ: tahmin/projeksiyon YOK — giriş kontenjanı ile TUS kontenjanı aynı kişileri anlatmaz, yalnız ölçek karşılaştırması;
 * dipnot bunu söyler. Renkler tema token'ı; sıralama/puan yorumu yok; tablo yalnız resmî sayıları listeler.
 */
export interface YokChartsProps {
  summary: YokTipSummary;
  rows: YokRowLite[];
  tusQuotaByYear: { year: number; quota: number; partial: boolean }[];
  /** YÖKSİS Tablo 12 — Tıp fakültesi mezunları, öğretim yılına göre (year = öğretim yılının ikinci yılı); onaylı yıllar. */
  graduatesByYear: { year: number; gradYear: string; graduates: number; male: number; female: number; faculties: number }[];
  typeLabels: Record<YokUniType, string>;
}

const ACCENT = "var(--c-accent)"; const INK2 = "var(--c-ink-2)"; const INK3 = "var(--c-ink-3)"; const HAIR = "var(--c-hairline)";
const tooltipStyle = { backgroundColor: "var(--c-panel)", border: "1px solid var(--c-hairline)", borderRadius: 10, color: "var(--c-ink)", fontSize: 12 };
const axisTick = { fill: INK2, fontSize: 11 };
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("tr-TR", { maximumFractionDigits: 2 }));
const RANK_BUCKETS: { label: string; max: number }[] = [
  { label: "≤ 1.000", max: 1000 }, { label: "1.001–5.000", max: 5000 }, { label: "5.001–10.000", max: 10000 },
  { label: "10.001–20.000", max: 20000 }, { label: "20.001–50.000", max: 50000 }, { label: "> 50.000", max: Infinity },
];

function Card({ title, sub, children, tall = false }: { title: string; sub: string; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
      <h3 className="text-[15px] font-semibold text-[var(--c-ink)]">{title}</h3>
      <p className="mt-0.5 text-[12px] text-[var(--c-ink-2)]">{sub}</p>
      <div className={tall ? "mt-3 h-80" : "mt-3 h-64"}>{children}</div>
    </div>
  );
}

export default function YokCharts({ summary, rows, tusQuotaByYear, graduatesByYear, typeLabels }: YokChartsProps) {
  const [type, setType] = useState<"ALL" | YokUniType>("ALL");
  const [city, setCity] = useState("ALL");
  const [q, setQ] = useState("");

  const years = useMemo(() => {
    const ys = new Set<number>([...summary.quotaByYear.map((x) => x.year), ...tusQuotaByYear.map((x) => x.year), ...graduatesByYear.map((x) => x.year)]);
    return [...ys].sort((a, b) => a - b).map((year) => ({
      name: String(year),
      yks: summary.quotaByYear.find((x) => x.year === year)?.quota ?? null,
      tus: tusQuotaByYear.find((x) => x.year === year)?.quota ?? null,
      tusPartial: tusQuotaByYear.find((x) => x.year === year)?.partial ?? false,
      mezun: graduatesByYear.find((x) => x.year === year)?.graduates ?? null,
    }));
  }, [summary, tusQuotaByYear, graduatesByYear]);
  const gradSeries = graduatesByYear.map((g) => ({ name: g.gradYear, erkek: g.male, kadin: g.female, fakulte: g.faculties }));
  const byType = summary.byType.map((t) => ({ name: typeLabels[t.type], kontenjan: t.quota, yerlesen: t.placed, program: t.programs }));
  const byCity = summary.byCity.map((c) => ({ name: c.city === "Diğer" ? "Diğer" : c.city, kontenjan: c.quota, program: c.programs }));
  const rankHist = RANK_BUCKETS.map((b, i) => {
    const lo = i === 0 ? 0 : RANK_BUCKETS[i - 1].max;
    const inB = rows.filter((r) => r.rank !== null && r.rank > lo && r.rank <= b.max);
    return { name: b.label, devlet: inB.filter((r) => r.type === "DEVLET").length, vakif: inB.filter((r) => r.type === "VAKIF").length, diger: inB.filter((r) => r.type !== "DEVLET" && r.type !== "VAKIF").length };
  });

  const cities = useMemo(() => [...new Set(rows.map((r) => r.city).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "tr-TR")), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    return rows
      .filter((r) => (type === "ALL" || r.type === type) && (city === "ALL" || r.city === city))
      .filter((r) => !needle || [r.university, r.faculty ?? "", r.program].join(" ").toLocaleLowerCase("tr-TR").includes(needle))
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.university.localeCompare(b.university, "tr-TR"));
  }, [rows, type, city, q]);

  const selectCls = "rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--c-ink)]";
  const labelCls = "flex flex-col gap-1 text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Tıp giriş kontenjanı, Tıp mezunu ve TUS GENEL kontenjanı" sub="YKS Tıp kontenjanı (sütun), YÖKSİS Tıp fakültesi mezunu (kesikli çizgi; öğretim yılının ikinci yılı) ve ÖSYM TUS GENEL kontenjanı (çizgi; yıl = iki dönem toplamı). Ölçek karşılaştırması; aynı kişiler değildir.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={years} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n, item) => { const p = (item as { payload?: { tusPartial?: boolean } }).payload; return n === "TUS GENEL kontenjanı" && p?.tusPartial ? `${fmt(typeof v === "number" ? v : null)} (yalnız 1. dönem)` : fmt(typeof v === "number" ? v : null); }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="yks" name="YKS Tıp kontenjanı" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="mezun" name="Tıp mezunu (YÖKSİS)" stroke={ACCENT} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="tus" name="TUS GENEL kontenjanı" stroke={INK2} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        {gradSeries.length > 0 && (
          <Card title="Tıp fakültesi mezunları" sub="YÖKSİS Tablo 12 — öğretim yılına göre mezun sayısı, kadın/erkek yığın (fakülte sayısı araç ipucunda).">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradSeries} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={HAIR} vertical={false} />
                <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: HAIR }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n, item) => `${fmt(typeof v === "number" ? v : null)} · ${(item as { payload?: { fakulte?: number } }).payload?.fakulte ?? "—"} fakülte`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="kadin" name="Kadın" stackId="m" fill={ACCENT} />
                <Bar dataKey="erkek" name="Erkek" stackId="m" fill={INK3} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        <Card title="Kurum türüne göre kontenjan ve yerleşen" sub={`${summary.year} YKS — devlet, vakıf, KKTC ve yurt dışı programları.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(typeof v === "number" ? v : null)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="kontenjan" name="Kontenjan" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="yerlesen" name="Yerleşen" fill={INK3} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="İllere göre kontenjan" sub="En çok kontenjanı olan 12 il ve diğerleri (program sayısı araç ipucunda)." tall>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCity} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} horizontal={false} />
              <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: HAIR }} />
              <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} width={96} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n, item) => `${fmt(typeof v === "number" ? v : null)} · ${(item as { payload?: { program?: number } }).payload?.program ?? "—"} program`} />
              <Bar dataKey="kontenjan" name="Kontenjan" fill={ACCENT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Başarı sırası dağılımı" sub={`${summary.year} yerleştirmede son yerleşenin başarı sırası, aralıklara göre program sayısı (kurum türüne göre yığın).`} tall>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankHist} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid stroke={HAIR} vertical={false} />
              <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: HAIR }} interval={0} angle={-25} textAnchor="end" height={48} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="devlet" name="Devlet" stackId="a" fill={ACCENT} />
              <Bar dataKey="vakif" name="Vakıf" stackId="a" fill={INK2} />
              <Bar dataKey="diger" name="KKTC / yurt dışı" stackId="a" fill={INK3} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
        <h3 className="text-[15px] font-semibold text-[var(--c-ink)]">Programlar</h3>
        <p className="mt-0.5 text-[12px] text-[var(--c-ink-2)]">{summary.year} YKS Tıp programları — başarı sırasına göre; süzgeçler yalnız listeyi daraltır.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className={labelCls}>Kurum türü
            <select value={type} onChange={(e) => setType(e.target.value as "ALL" | YokUniType)} className={selectCls}>
              <option value="ALL">Hepsi</option>
              {summary.byType.map((t) => <option key={t.type} value={t.type}>{typeLabels[t.type]}</option>)}
            </select>
          </label>
          <label className={labelCls}>İl
            <select value={city} onChange={(e) => setCity(e.target.value)} className={selectCls}>
              <option value="ALL">Hepsi</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className={`${labelCls} grow`}>Ara
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Üniversite, fakülte ya da program" className={`${selectCls} w-full`} />
          </label>
          <div className="aura-mono pb-2 text-[11px] text-[var(--c-ink-3)]">{filtered.length} / {rows.length} program</div>
        </div>
        <div className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-[var(--c-hairline)]">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--c-panel)] text-left text-[10.5px] uppercase tracking-wider text-[var(--c-ink-3)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Üniversite · fakülte</th>
                <th className="px-3 py-2 font-semibold">Program</th>
                <th className="px-3 py-2 text-right font-semibold">Kontenjan</th>
                <th className="px-3 py-2 text-right font-semibold">Yerleşen</th>
                <th className="px-3 py-2 text-right font-semibold">Taban puan</th>
                <th className="px-3 py-2 text-right font-semibold">Başarı sırası</th>
                <th className="px-3 py-2 text-right font-semibold">Öğr. üyesi</th>
                <th className="px-3 py-2 font-semibold">Akreditasyon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-hairline)] text-[var(--c-ink-2)]">
              {filtered.map((r) => (
                <tr key={r.code}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[var(--c-ink)]">{r.university}</div>
                    <div className="text-[11px] text-[var(--c-ink-3)]">{[r.faculty, r.city, typeLabels[r.type]].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-2">{r.program}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.quota)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.placed)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.minScore == null ? "—" : r.minScore.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.rank)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(r.facultyMembers)}</td>
                  <td className="px-3 py-2">{r.accreditation ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-[var(--c-ink-3)]">Süzgeçle eşleşen program yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kaynak: YÖK Atlas Tercih Sihirbazı (kontenjan ve koşullar {summary.year}-YKS Yükseköğretim Programları ve Kontenjanları Kılavuzu&apos;ndan; taban puan ve
        başarı sırası {summary.year} YKS yerleştirme sonuçları; önceki yıllar aynı kaynağın geçmiş alanları; öğretim üyesi = profesör + doçent + doktor öğretim
        üyesi, YÖK Atlas beyanı). Mezun sayıları YÖKSİS İstatistik Tablo 12&apos;den (önlisans ve lisans düzeyindeki mezunlar, akademik birimlere göre; yalnız adı
        &ldquo;Tıp Fakültesi&rdquo; olan birimler; yıl = öğretim yılının ikinci yılı). TUS GENEL kontenjanı ÖSYM yerleştirme tablolarından (yıl = iki dönem toplamı; eksik
        dönem işaretlenir). Tıp eğitimi altı yıldır; giriş kontenjanı, mezun sayısı ve TUS kontenjanı aynı kişileri anlatmaz. Sayılar geçmiş ve resmî veridir;
        tahmin değildir, tercih tavsiyesi değildir; nihai kontrol ÖSYM kılavuzundan yapılır.
      </p>
    </div>
  );
}
