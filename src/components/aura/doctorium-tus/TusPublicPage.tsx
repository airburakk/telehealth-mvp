import type { CSSProperties } from "react";
import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumWordV3 } from "@/components/aura/doctorium-v3/brand";
import { LandingFooterV3 } from "@/components/aura/doctorium-v3/Footer";
import { V3_LIGHT } from "@/components/aura/doctorium-v3/palette";
import { TusKpiStrip } from "@/app/doktor/doctorium/CareerEduSections";
import { TusSourceNote } from "@/app/doktor/doctorium/tus/TusSourceNote";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { TUS_PUBLIC_COPY } from "@/lib/doctorium-tus-public/copy";
import { formatScore, type TusPublicView } from "@/lib/doctorium-tus-public/view";

// Herkese açık TUS taban puanları sayfası (v6.358, 2026-10-29 — SEO: "tus taban puanları" ≈12 bin/ay, veri portalda giriş arkasındaydı).
// SeckiPage kabuğu: açık V3 zemini + kendi mini üst barı + LandingFooterV3 → AURA izi yok, global krom lib/chrome-routes'ta gizlenir.
// Tablo SUNUCUDA düz <table> çizilir (JS'siz okunur — arama motoru/AI botu tabloyu doğrudan görür); grafik YOK (Recharts client-only).
// Dönem seçici = düz bağlantılar (?donem=…), istemci durumu yok. Bu bileşen SAF sunumdur: veri buildTusPublicView çıktısıdır.
const LINK_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-emerald)]";

// Portalın TusKpiStrip/TusSourceNote'u kit token'larıyla (--c-*) çizilir; o token'lar gece/gündüz temasına göre değişir. Bu sayfa
// temadan bağımsız AÇIK zemindir → token'lar burada V3 açık paletine sabitlenir (landing'deki ProductFrame ile aynı amaç).
const KIT_LIGHT = {
  "--c-ink": "#18181b",
  "--c-ink-2": "#4b4b48",
  "--c-ink-3": "#6b6b68",
  "--c-hairline": "rgba(24,24,27,.08)",
  "--c-surface": "#f3f3f1",
} as CSSProperties;

const num = (v: number) => v.toLocaleString("tr-TR");

function Score({ v }: { v: number | null }) {
  const s = formatScore(v);
  return s === null ? <span className="text-[var(--dl-muted)]">{TUS_PUBLIC_COPY.noValue}</span> : <>{s}</>;
}

/**
 * `view` null → onaylı dönem yok (dürüst "hazırlanıyor"; sahte tablo ASLA).
 * `basePath`: dönem bağlantılarının yolu — Doctorium deploy'unda kısa adres "/tus", AURA host'unda "/doctorium/tus" (çağıran sunucuda seçer).
 */
export function TusPublicPage({ view, basePath }: { view: TusPublicView | null; basePath: string }) {
  const c = TUS_PUBLIC_COPY;
  const th = "px-3 py-2.5 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--dl-muted)]";
  const thNum = `${th} text-right`;
  const td = "px-3 py-2.5 text-right tabular-nums";
  return (
    <div lang="tr" style={{ ...V3_LIGHT, ...KIT_LIGHT }} className="flex min-h-dvh flex-col bg-[var(--dl-bg)] text-[var(--dl-ink)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-6">
        <Link prefetch={false} href="/doctorium" aria-label="Doctorium ana sayfa" className={`inline-flex items-center gap-2.5 ${LINK_FOCUS}`}>
          <AuraMark size={28} tone="emerald" />
          <DoctoriumWordV3 className="text-[24px] leading-none" />
        </Link>
        <Link prefetch={false}
          href={LANDING_ROUTES.student}
          className={`rounded-full border border-[var(--dl-line)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--dl-ink)] transition-colors hover:border-[var(--dl-emerald)] hover:text-[var(--dl-emerald)] ${LINK_FOCUS}`}
        >
          {c.join}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-12 pt-10">
        <div className="border-t-[3px] border-[var(--dl-ink)]">
          <p className="border-b border-[var(--dl-line)] py-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--dl-muted)]">
            {c.mastheadLabel}
            {view ? (
              <>
                {" "}
                <span className="text-[var(--dl-emerald)]">·</span> {view.first.year}–{view.last.year}
              </>
            ) : null}
          </p>
        </div>

        <h1 className="mt-8 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[36px]">{c.h1}</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[var(--dl-body)]">{c.lead}</p>
        <p role="note" className="mt-4 max-w-3xl border-l-[3px] border-[var(--dl-emerald)] pl-3 text-[14px] font-medium text-[var(--dl-ink)]">
          {c.warning}
        </p>

        {view === null ? (
          <div role="status" className="mt-8 rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] px-5 py-6">
            <p className="text-[16px] font-semibold text-[var(--dl-ink)]">{c.empty.title}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--dl-body)]">{c.empty.body}</p>
          </div>
        ) : (
          <>
            <section aria-label="Son dönem özeti" className="mt-10">
              <TusKpiStrip last={view.last} />
            </section>

            <section aria-labelledby="tus-dallar" className="mt-12">
              <h2 id="tus-dallar" className="text-[20px] font-semibold tracking-[-0.015em] sm:text-[22px]">{c.tableHeading}</h2>
              <nav aria-label={c.periodPickerLabel} className="mt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dl-muted)]">{c.periodPickerLabel}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {view.options.map((o, i) => (
                    <li key={o.key}>
                      <Link prefetch={false}
                        href={i === 0 ? basePath : `${basePath}?donem=${o.key}`}
                        aria-current={o.selected ? "page" : undefined}
                        scroll={false}
                        className={`inline-block rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${LINK_FOCUS} ${
                          o.selected
                            ? "border-[var(--dl-emerald)] bg-[var(--dl-emerald)] text-white"
                            : "border-[var(--dl-line)] text-[var(--dl-ink)] hover:border-[var(--dl-emerald)] hover:text-[var(--dl-emerald)]"
                        }`}
                      >
                        {o.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--dl-line)]">
                <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
                  <caption className="px-3 pb-2 pt-3 text-left text-[12.5px] text-[var(--dl-muted)]">{c.tableCaption(view.periodLabel)}</caption>
                  <thead className="bg-[var(--dl-panel)]">
                    <tr>
                      <th scope="col" className={th}>{c.columns.branch}</th>
                      <th scope="col" className={thNum}>{c.columns.quota}</th>
                      <th scope="col" className={thNum}>{c.columns.placed}</th>
                      <th scope="col" className={thNum}>{c.columns.vacant}</th>
                      <th scope="col" className={thNum}>{c.columns.minScore}</th>
                      <th scope="col" className={thNum}>{c.columns.medianMinScore}</th>
                      <th scope="col" className={thNum}>{c.columns.maxScore}</th>
                      <th scope="col" className={thNum}>{c.columns.programs}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--dl-line)]">
                    {view.rows.map((r) => (
                      <tr key={r.branch}>
                        <th scope="row" className="px-3 py-2.5 text-left font-medium text-[var(--dl-ink)]">{r.label}</th>
                        <td className={td}>{num(r.quota)}</td>
                        <td className={td}>{num(r.placed)}</td>
                        <td className={td}>{num(r.vacant)}</td>
                        <td className={`${td} font-semibold`}><Score v={r.minScore} /></td>
                        <td className={td}><Score v={r.medianMinScore} /></td>
                        <td className={td}><Score v={r.maxScore} /></td>
                        <td className={td}>{num(r.programs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-[var(--dl-muted)]">{c.tableNote}</p>
            </section>

            {view.trendKeys.length > 1 ? (
              <section aria-labelledby="tus-son-uc" className="mt-12">
                <h2 id="tus-son-uc" className="text-[20px] font-semibold tracking-[-0.015em] sm:text-[22px]">{c.trendHeading}</h2>
                <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-[var(--dl-body)]">{c.trendNote}</p>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--dl-line)]">
                  <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
                    <thead className="bg-[var(--dl-panel)]">
                      <tr>
                        <th scope="col" className={th}>{c.columns.branch}</th>
                        {view.trendKeys.map((k) => (
                          <th key={k.key} scope="col" className={thNum}>{k.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dl-line)]">
                      {view.rows.map((r) => (
                        <tr key={r.branch}>
                          <th scope="row" className="px-3 py-2.5 text-left font-medium text-[var(--dl-ink)]">{r.label}</th>
                          {r.trend.map((v, i) => (
                            <td key={view.trendKeys[i].key} className={td}><Score v={v} /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section aria-labelledby="tus-kaynak" className="mt-12 rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] px-5 py-6">
              <h2 id="tus-kaynak" className="text-[16px] font-semibold text-[var(--dl-ink)]">{c.sourceHeading}</h2>
              <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--dl-body)]">{c.sourceBody}</p>
              <p className="mt-2 text-[13px]">
                <a href={view.period.sourcePage} target="_blank" rel="noopener noreferrer" className={`text-[var(--dl-emerald)] underline underline-offset-2 ${LINK_FOCUS}`}>
                  {c.sourceLinkLabel(view.periodLabel)}
                </a>
              </p>
              {/* Son dönemin notu KPI şeridinde zaten var (TusKpiStrip içi) → yalnız geçmiş dönem seçiliyken tekrar çizilir. */}
              {view.isLatest ? null : <TusSourceNote period={view.period} />}
            </section>
          </>
        )}

        <section aria-label="Doctorium üyeliği" className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--dl-line)] pt-6">
          <p className="text-[14px] text-[var(--dl-body)]">{c.cta.body}</p>
          <div className="flex flex-wrap gap-2.5">
            <Link prefetch={false}
              href={LANDING_ROUTES.student}
              className={`rounded-full bg-[var(--dl-emerald)] px-4 py-2 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 ${LINK_FOCUS}`}
            >
              {c.cta.student}
            </Link>
            <Link prefetch={false}
              href={LANDING_ROUTES.signup}
              className={`rounded-full border border-[var(--dl-line)] px-4 py-2 text-[13.5px] font-medium text-[var(--dl-ink)] transition-colors hover:border-[var(--dl-emerald)] hover:text-[var(--dl-emerald)] ${LINK_FOCUS}`}
            >
              {c.cta.doctor}
            </Link>
          </div>
        </section>
      </main>
      <LandingFooterV3 />
    </div>
  );
}
