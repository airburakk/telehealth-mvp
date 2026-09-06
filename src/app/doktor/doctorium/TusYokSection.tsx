import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { latestApprovedYok, toRowLite } from "@/lib/yok-data";
import { approvedTipGraduates, latestApprovedMezunMeta } from "@/lib/yok-mezun";
import { YOK_UNI_TYPE_LABEL } from "@/lib/yok-normalize";
import { approvedTusSummaries, type TusPeriodSummaryWithSource } from "@/lib/tus-data";
import { formatIsoDayTr } from "@/lib/iso-day";
import YokChartsLoader from "./tus/YokChartsLoader";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * TIP FAKÜLTELERİ (YÖK Atlas) bölümü — K5(b), 2026-09-05 (👤 karar "YÖK verisi: ikisi de"; YÖKSİS mezun sayıları K5(a) ayrı adım).
 * Sunucu bileşeni: onaylı yıl anlık görüntüsü (lib/yok-data; 👤 approvedAt) → KPI şeridi + Recharts grafikleri + program tablosu
 * (client, dinamik). TUS GENEL kontenjanı yıllara göre ÖSYM tablolarından (lib/tus-data) — yıl = iki dönem toplamı, tek dönemli yıl
 * "kısmi" işaretlenir. Onaylı veri yoksa dürüst "hazırlanıyor"; tahmin/projeksiyon/tavsiye YOK. `compact` (Kariyer hub'ı): KPI + bağlantı.
 */
export const YOK_ANCHOR = "/doktor/doctorium/tus#yok";

/** ÖSYM TUS GENEL kontenjanı yıl toplamı; iki dönemden azı varsa partial. */
export function tusGeneralQuotaByYear(periods: readonly TusPeriodSummaryWithSource[]): { year: number; quota: number; partial: boolean }[] {
  const m = new Map<number, { quota: number; terms: number }>();
  for (const p of periods) { const cur = m.get(p.year) ?? { quota: 0, terms: 0 }; cur.quota += p.totals.general.quota; cur.terms += 1; m.set(p.year, cur); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, quota: v.quota, partial: v.terms < 2 }));
}

export function YokTipSection({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const snap = latestApprovedYok();
  if (!snap) {
    return (
      <EmptyState
        className={className}
        title="Tıp fakültesi verisi hazırlanıyor"
        sub="YÖK Atlas'tan alınan program, kontenjan ve yerleştirme verisi kaynak ve tarihle doğrulanıp onaylandığında burada görünecek."
      />
    );
  }
  const s = snap.summary;
  // K5(a): YÖKSİS Tablo 12 mezunları (onaylı yıllar; yoksa seri boş, KPI çizilmez — uydurma yok).
  const grads = approvedTipGraduates();
  const lastGrad = grads.length ? grads[grads.length - 1] : null;
  const mezunMeta = latestApprovedMezunMeta();
  const kpis = [
    { k: "Program", v: s.programs }, { k: "Fakülte", v: s.faculties }, { k: `Kontenjan (${s.year})`, v: s.totals.quota },
    { k: "Yerleşen", v: s.totals.placed }, { k: "Akredite (TEPDAD)", v: s.accredited },
    ...(lastGrad ? [{ k: `Tıp mezunu (${lastGrad.gradYear})`, v: lastGrad.graduates }] : []),
  ];
  return (
    <AuraPanel title={<span id="yok">Tıp fakülteleri</span>} meta={`YÖK ATLAS · ${s.year}${lastGrad ? " · YÖKSİS MEZUN" : ""}`} className={className}>
      <dl className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${kpis.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {kpis.map((x) => (
          <div key={x.k} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5">
            <dt className="text-[11px] text-[var(--c-ink-3)]">{x.k}</dt>
            <dd className="aura-display mt-0.5 text-xl font-semibold tabular-nums text-[var(--c-ink)]">{x.v.toLocaleString("tr-TR")}</dd>
          </div>
        ))}
      </dl>
      {compact ? (
        <p className="mt-3 text-[12px] text-[var(--c-ink-2)]">
          Giriş kontenjanı{lastGrad ? ", Tıp mezunu" : ""} ve TUS kontenjanının yıllara göre karşılaştırması, kurum türü ve il dağılımı, başarı sırası dağılımı ve {s.programs} programlık tablo
          TUS sayfasında — <Link href={YOK_ANCHOR} className="font-semibold text-[var(--c-accent)] hover:underline">Ayrıntı</Link>.
        </p>
      ) : (
        <div className="mt-5">
          <YokChartsLoader
            summary={s}
            rows={snap.rows.map(toRowLite)}
            tusQuotaByYear={tusGeneralQuotaByYear(approvedTusSummaries())}
            graduatesByYear={grads.map((g) => ({ year: g.endYear, gradYear: g.gradYear, graduates: g.graduates, male: g.male, female: g.female, faculties: g.faculties }))}
            typeLabels={YOK_UNI_TYPE_LABEL}
          />
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kaynak:{" "}
        <a href={snap.meta.sourcePage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
          YÖK Atlas — Tercih Sihirbazı <ExternalLink size={11} aria-hidden />
        </a>{" "}
        ({s.year}-YKS kılavuzu ve {s.year} yerleştirme sonuçları); çekim {formatIsoDayTr(snap.meta.fetchedAt)}.
        {mezunMeta && (
          <>
            {" "}Mezun sayıları:{" "}
            <a href={mezunMeta.sourcePage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
              YÖKSİS İstatistik — Tablo 12 <ExternalLink size={11} aria-hidden />
            </a>{" "}
            ({grads[0]?.gradYear} → {mezunMeta.gradYear}; yalnız adı &ldquo;Tıp Fakültesi&rdquo; olan birimler); çekim {formatIsoDayTr(mezunMeta.fetchedAt)}.
          </>
        )}{" "}
        Resmî ve geçmiş veridir; tercih tavsiyesi değildir.
      </p>
    </AuraPanel>
  );
}
