"use client";

import { useLang } from "@/lib/aura-landing/i18n";

// Doktorlar v2: gece zemininde yatay portre seridi — kartlar film kareleri
// gibi ince turkuaz isik huzmesiyle baglanir; v1 portreleri CSS ile koyu
// duotone'a cekilir. Dogal yatay scroll + snap (mobil dostu).
export function AuraDoctors() {
  const { t } = useLang();

  return (
    <section id="doctors" className="relative bg-[var(--aura-bg)] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <h2 className="aura-display text-3xl font-bold leading-none tracking-tighter md:text-5xl">
          {t.doctors.headline}
        </h2>
        <p className="aura-mono mt-3 text-[12px] text-[var(--aura-micro)]">{t.doctors.note}</p>
      </div>

      <div className="relative mt-10">
        {/* Isik huzmesi: kartlari film kareleri gibi baglar */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[128px] h-px bg-[var(--aura-accent)]/60"
        />
        <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 md:px-8 [scrollbar-width:thin]">
          {t.doctors.list.map((d) => (
            <article
              key={d.img}
              className="group relative w-60 flex-none snap-start overflow-hidden rounded-xl border border-[var(--aura-hairline)] bg-[var(--aura-panel)] transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="h-64 overflow-hidden">
                <img
                  src={`/assets/${d.img}.jpg`}
                  alt={d.name}
                  className="h-full w-full object-cover opacity-80 saturate-[0.35] transition-transform duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                  loading="lazy"
                />
                {/* Koyu-turkuaz duotone tonu */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[var(--aura-accent)]/10 mix-blend-color"
                />
              </div>
              <div className="p-4">
                <p className="aura-display text-base font-bold leading-tight">{d.name}</p>
                <p className="mt-0.5 text-sm text-[var(--aura-grey)]">{d.field}</p>
                <p className="aura-mono mt-2 text-[11px] text-[var(--aura-accent)]">{d.tag}</p>
              </div>
            </article>
          ))}
          <div aria-hidden className="w-10 flex-none" />
        </div>
      </div>
    </section>
  );
}
