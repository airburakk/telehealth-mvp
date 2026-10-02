import Link from "next/link";
import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumWordV3 } from "@/components/aura/doctorium-v3/brand";
import { LandingFooterV3 } from "@/components/aura/doctorium-v3/Footer";
import { V3_LIGHT } from "@/components/aura/doctorium-v3/palette";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { SECKI_COPY } from "@/lib/doctorium-secki/copy";
import type { SeckiItemView, SeckiView } from "@/lib/doctorium-secki/view";

// Doctorium "Günlük Seçki" — bio linkinin hedefi (v6.315, 2026-10-02). Açık V3 zemini, sabah kartıyla (TAM BÜLTEN) aynı dil:
// üstte kalın çizgi + mono künye satırı, akış etiketi zümrüt mono, başlık Inter. Mobil öncelikli (trafik Instagram bio'dan gelir).
// AURA izi taşımaz (marka ayrışması): kendi mini üst barı + LandingFooterV3; global krom lib/chrome-routes'ta gizlenir.
// Bu bileşen SAF sunumdur: veri `buildSeckiView` çıktısıdır, hata/boş durumu çağıran söyler.
const LINK_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-emerald)]";

function Item({ it }: { it: SeckiItemView }) {
  return (
    <li className="py-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dl-emerald)]">
        {it.kicker}
        {it.branchLabel ? <span className="tracking-[0.1em] text-[var(--dl-muted)]"> · {it.branchLabel}</span> : null}
      </p>
      <h2 className="mt-2 text-[19px] font-semibold leading-snug tracking-[-0.015em] text-[var(--dl-ink)] sm:text-[21px]">
        {it.href ? (
          <a
            href={it.href}
            target="_blank"
            rel="noopener"
            className={`underline-offset-4 decoration-[var(--dl-emerald)] hover:underline ${LINK_FOCUS}`}
          >
            {it.title}
          </a>
        ) : (
          it.title
        )}
      </h2>
      <p className="mt-1.5 text-[13px] font-semibold text-[var(--dl-muted)]">{it.source}</p>
      {it.href && it.host ? (
        <a
          href={it.href}
          target="_blank"
          rel="noopener"
          aria-label={`${it.title} — ${SECKI_COPY.sourceLink} (${it.host})`}
          className={`mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--dl-emerald)] underline-offset-4 hover:underline ${LINK_FOCUS}`}
        >
          {SECKI_COPY.sourceLink} · {it.host} <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </li>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="mt-8 rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] px-5 py-6">
      <p className="text-[16px] font-semibold text-[var(--dl-ink)]">{title}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--dl-body)]">{body}</p>
    </div>
  );
}

/** `view` null → seçki yüklenemedi (DB hatası); `view.items` boş → bugün seçki üretilmedi. */
export function SeckiPage({ view }: { view: SeckiView | null }) {
  const c = SECKI_COPY;
  return (
    <div lang="tr" style={V3_LIGHT} className="flex min-h-dvh flex-col bg-[var(--dl-bg)] text-[var(--dl-ink)]">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 pt-6">
        <Link href="/doctorium" aria-label="Doctorium ana sayfa" className={`inline-flex items-center gap-2.5 ${LINK_FOCUS}`}>
          <AuraMark size={28} tone="emerald" />
          <DoctoriumWordV3 className="text-[24px] leading-none" />
        </Link>
        <Link
          href={LANDING_ROUTES.signup}
          className={`rounded-full border border-[var(--dl-line)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--dl-ink)] transition-colors hover:border-[var(--dl-emerald)] hover:text-[var(--dl-emerald)] ${LINK_FOCUS}`}
        >
          {c.join}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-10">
        <div className="border-t-[3px] border-[var(--dl-ink)]">
          <p className="border-b border-[var(--dl-line)] py-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--dl-muted)]">
            {c.mastheadLabel}
            {view ? (
              <>
                {" "}
                <span className="text-[var(--dl-emerald)]">·</span> <time dateTime={view.day}>{view.dateLabel}</time>
              </>
            ) : null}
          </p>
        </div>

        <h1 className="mt-8 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[34px]">{c.h1}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--dl-body)]">{c.lead}</p>
        {view ? (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dl-muted)]">
            {c.rotationLabel} · <span className="text-[var(--dl-ink)]">{view.rotationLabel}</span>
          </p>
        ) : null}

        {view === null ? (
          <Notice title={c.failed.title} body={c.failed.body} />
        ) : view.items.length === 0 ? (
          <Notice title={c.empty.title} body={c.empty.body} />
        ) : (
          <ol className="mt-8 divide-y divide-[var(--dl-line)] border-y border-[var(--dl-line)]">
            {view.items.map((it) => (
              <Item key={it.id} it={it} />
            ))}
          </ol>
        )}

        <section aria-labelledby="secki-hakkinda" className="mt-12 rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] px-5 py-6">
          <h2 id="secki-hakkinda" className="text-[16px] font-semibold text-[var(--dl-ink)]">
            {c.about.heading}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--dl-body)]">{c.about.body}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={LANDING_ROUTES.signup}
              className={`rounded-full bg-[var(--dl-emerald)] px-4 py-2 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 ${LINK_FOCUS}`}
            >
              {c.about.doctor}
            </Link>
            <Link
              href={LANDING_ROUTES.student}
              className={`rounded-full bg-[var(--dl-emerald)] px-4 py-2 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 ${LINK_FOCUS}`}
            >
              {c.about.student}
            </Link>
            <Link
              href="/doctorium"
              className={`rounded-full border border-[var(--dl-line)] px-4 py-2 text-[13.5px] font-medium text-[var(--dl-ink)] transition-colors hover:border-[var(--dl-emerald)] hover:text-[var(--dl-emerald)] ${LINK_FOCUS}`}
            >
              {c.about.learnMore}
            </Link>
          </div>
        </section>

        <p className="mt-6 text-[12.5px] leading-relaxed text-[var(--dl-muted)]">
          {c.note}{" "}
          <Link href="/doctorium/icerik-politikasi" className={`underline underline-offset-2 hover:text-[var(--dl-emerald)] ${LINK_FOCUS}`}>
            {c.policyLink}
          </Link>
        </p>
      </main>
      <LandingFooterV3 />
    </div>
  );
}
