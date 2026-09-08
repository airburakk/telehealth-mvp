import { ExternalLink } from "lucide-react";
import { approvedTusSummaries, periodLabel, tusBranches, tusEkRowsFor, tusRowsFor } from "@/lib/tus-data";
import { TUS_INSTITUTION_LABEL, titleCaseTr, type TusInstitutionType } from "@/lib/tus-normalize";
import {
  buildInstitutionTable, parseInstitutionType, parseQuotaType, parseSort, summarizeInstitutionTable,
} from "@/lib/tus-institutions";
import TusInstitutionFilters from "./tus/TusInstitutionFilters";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * TUS KURUM TABLOSU (K2, 2026-09-06 — 👤 "Hepsi": kurum tablosu + ek yerleştirme + 3 dönem eğilimi). Sunucu bileşeni: seçili branş ve
 * dönemin kurum satırları (lib/tus-data tusRowsFor — onaylı dönem, tembel JSON), önceki iki onaylı dönemden en küçük puan eğilimi,
 * aynı dönemin EK YERLEŞTİRME satırları (tusEkRowsFor — onaylı ise). Süzgeçler URL sorgusunda (client TusInstitutionFilters); satır
 * verisi client'a inmez. Sayılar ÖSYM'nin yayımladığı biçimdedir; kurum türü Doctorium gruplamasıdır; tahmin/tavsiye YOK.
 */
export const KURUMLAR_ANCHOR = "/doktor/doctorium/tus#kurumlar";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const fmt = (n: number | null | undefined, d = 0) => (n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const score = (n: number | null) => (n == null ? "—" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export async function TusInstitutionsSection({ sp, className = "" }: { sp: SP; className?: string }) {
  const periods = approvedTusSummaries();
  if (periods.length === 0) {
    return <EmptyState className={className} title="Kurum tablosu hazırlanıyor" sub="Onaylı yerleştirme dönemi yok." />;
  }
  const branches = tusBranches(periods);
  const brans = branches.some((b) => b.branch === one(sp.brans)) ? one(sp.brans) : (branches.find((b) => b.branch === "İÇ HASTALIKLARI")?.branch ?? branches[0].branch);
  const idx = Math.max(0, periods.findIndex((p) => p.key === one(sp.donem)));
  const period = periods[idx === -1 ? periods.length - 1 : (one(sp.donem) ? idx : periods.length - 1)];
  const pIdx = periods.findIndex((p) => p.key === period.key);
  const prevPeriods = periods.slice(Math.max(0, pIdx - 2), pIdx); // eskiden yeniye, en fazla 2
  const type = parseInstitutionType(one(sp.tur) || undefined);
  const quotaType = parseQuotaType(one(sp.kt) || undefined);
  const q = one(sp.q).slice(0, 80);
  const sort = parseSort(one(sp.sirala) || undefined);

  const [current, ek, ...previous] = await Promise.all([tusRowsFor(period.key), tusEkRowsFor(period.key), ...prevPeriods.map((p) => tusRowsFor(p.key))]);
  const rows = buildInstitutionTable(brans, current, previous, ek.length ? ek : null, { type, quotaType, q, sort });
  const sum = summarizeInstitutionTable(rows);
  const hasEk = ek.length > 0;
  const branchLabel = branches.find((b) => b.branch === brans)?.branchLabel ?? titleCaseTr(brans);
  const trendLabels = [...prevPeriods, period].map((p) => `${p.year}/${p.term}`);
  const types = (Object.keys(TUS_INSTITUTION_LABEL) as TusInstitutionType[]).map((k) => ({ key: k, label: TUS_INSTITUTION_LABEL[k] }));

  return (
    <AuraPanel title={<span id="kurumlar">Kurumlar</span>} meta={`${periodLabel(period.year, period.term)} · ${branchLabel.toLocaleUpperCase("tr-TR")}`} className={className}>
      <TusInstitutionFilters
        branches={branches.map((b) => ({ branch: b.branch, label: b.branchLabel }))}
        periods={periods.map((p) => ({ key: p.key, label: periodLabel(p.year, p.term) }))}
        types={types}
        value={{ brans, donem: period.key, tur: type, kt: quotaType, q, sirala: sort }}
      />

      {/* KPI kutuları: grid satırı eşit yükseklik verir, kutu flex-col + dd mt-auto → uzun etiket ("Ek yerleştirmede dolan") iki satıra sarsa da
          sayılar aynı taban hizasında kalır (👤 2026-09-06: "kutular düz durmuyor, sayı aşağı kaçmış"). Aynı desen Yerleştirme/YÖK KPI'larında. */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: "Kurum", v: sum.institutions }, { k: "Program satırı", v: sum.programs }, { k: "Kontenjan", v: sum.quota },
          { k: "Yerleşen", v: sum.placed }, { k: "Boş kalan", v: sum.vacant },
          ...(hasEk ? [{ k: "Ek yerleştirmede dolan", v: sum.ekPlaced }] : []),
        ].map((x) => (
          <div key={x.k} className="flex flex-col rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5">
            <dt className="text-[11px] leading-snug text-[var(--c-ink-3)]">{x.k}</dt>
            <dd className="aura-display mt-auto pt-0.5 text-xl font-semibold tabular-nums text-[var(--c-ink)]">{fmt(x.v)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 max-h-[640px] overflow-auto rounded-xl border border-[var(--c-hairline)]">
        <table className="w-full min-w-[900px] text-[12.5px]">
          <thead className="sticky top-0 bg-[var(--c-panel)] text-left text-[10.5px] uppercase tracking-wider text-[var(--c-ink-3)]">
            <tr>
              <th className="px-3 py-2 font-semibold">Kurum</th>
              <th className="px-3 py-2 font-semibold">Kontenjan türü</th>
              <th className="px-3 py-2 text-right font-semibold">Kontenjan</th>
              <th className="px-3 py-2 text-right font-semibold">Yerleşen</th>
              <th className="px-3 py-2 text-right font-semibold">Boş</th>
              <th className="px-3 py-2 text-right font-semibold">En küçük</th>
              <th className="px-3 py-2 text-right font-semibold">En büyük</th>
              <th className="px-3 py-2 text-right font-semibold" title={`En küçük puan — ${trendLabels.join(" · ")}`}>Son {trendLabels.length} dönem en küçük</th>
              {hasEk && <th className="px-3 py-2 text-right font-semibold" title="Ek yerleştirme: kontenjan / yerleşen / en küçük puan">Ek yerleştirme</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--c-hairline)] text-[var(--c-ink-2)]">
            {rows.map((r) => (
              <tr key={`${r.code}-${r.quotaType}`}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-[var(--c-ink)]">{r.institution}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)]">{TUS_INSTITUTION_LABEL[r.institutionType]} · kod {r.code}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`aura-mono rounded-md px-1.5 py-0.5 text-[10.5px] ${r.quotaType === "GENEL" ? "bg-[var(--c-accent)]/12 text-[var(--c-accent)]" : "bg-[var(--c-surface)] text-[var(--c-ink-3)]"}`}>
                    {r.quotaType === "GENEL" ? "GENEL" : "YABANCI"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.quota)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(r.placed)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.vacant > 0 ? "font-semibold text-[var(--c-ink)]" : ""}`}>{fmt(r.vacant)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-[var(--c-ink)]">{score(r.minScore)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{score(r.maxScore)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[11.5px]">
                  {r.trend.map((t, i) => (
                    <span key={i} className={i === r.trend.length - 1 ? "font-semibold text-[var(--c-ink)]" : "text-[var(--c-ink-3)]"}>
                      {i > 0 && <span className="text-[var(--c-ink-3)]"> · </span>}{score(t)}
                    </span>
                  ))}
                </td>
                {hasEk && (
                  <td className="px-3 py-2 text-right tabular-nums text-[11.5px]">
                    {r.ek ? `${fmt(r.ek.quota)} / ${fmt(r.ek.placed)} / ${score(r.ek.minScore)}` : <span className="text-[var(--c-ink-3)]">—</span>}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={hasEk ? 9 : 8} className="px-3 py-6 text-center text-[var(--c-ink-3)]">Süzgeçle eşleşen kurum yok.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kaynak: ÖSYM {periodLabel(period.year, period.term)} yerleştirme sonuçları —{" "}
        <a href={period.sourcePdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">en küçük ve en büyük puanlar (PDF) <ExternalLink size={11} aria-hidden /></a>
        {prevPeriods.length > 0 && <> · eğilim sütunu {trendLabels.slice(0, -1).join(" ve ")} dönemlerinin aynı tablolarından (program kodu ile eşlenir; kod değişmişse kurum adıyla)</>}
        {hasEk && <> · ek yerleştirme sütunu aynı dönemin ÖSYM ek yerleştirme tablosundan (kontenjan / yerleşen / en küçük puan)</>}.
        Kurum türü Doctorium gruplamasıdır (ÖSYM böyle bir sınıflama yayımlamaz). Geçmiş veridir; tercih tavsiyesi değildir.
      </p>
    </AuraPanel>
  );
}
