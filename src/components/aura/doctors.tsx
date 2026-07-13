"use client";

import { useLang } from "@/lib/aura-landing/i18n";

// Doktorlar v3 (sandwich gündüz gövdesi): beyaz zeminde yatay portre şeridi.
// Her karta branşına göre pastel ÜST ŞERİT (renk-kodu) + branş metni o rengin
// koyu tonunda (beyazda AA). Portreler açık temada tam renkli (gece duotone
// katmanı kaldırıldı). Doğal yatay scroll + snap (mobil dostu).
const DOCTOR_ACCENTS = [
  { strip: "#0e7d8c", ink: "#0b6673" }, // turkuaz (AURA marka)
  { strip: "#3f82c4", ink: "#2f6091" }, // mavi
  { strip: "#d4749f", ink: "#9c5478" }, // pembe
  { strip: "#d79a3c", ink: "#8a6524" }, // altın
  { strip: "#8b6fb0", ink: "#654a8c" }, // mor
];

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
        {/* Işık huzmesi: kartları film kareleri gibi bağlar */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-[131px] h-px bg-[var(--aura-accent)]/40"
        />
        <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 md:px-8 [scrollbar-width:thin]">
          {t.doctors.list.map((d, i) => {
            const a = DOCTOR_ACCENTS[i % DOCTOR_ACCENTS.length];
            return (
              <article
                key={d.img}
                className="group relative w-60 flex-none snap-start overflow-hidden rounded-xl border border-[var(--aura-hairline)] bg-[var(--aura-panel)] transition-transform duration-300 hover:-translate-y-1"
              >
                {/* Branş renk-kodu şeridi (kart üstü) */}
                <div aria-hidden className="h-[3px] w-full" style={{ background: a.strip }} />
                <div className="h-64 overflow-hidden">
                  <img
                    src={`/assets/${d.img}.jpg`}
                    alt={d.name}
                    className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <p className="aura-display text-base font-bold leading-tight">{d.name}</p>
                  <p className="aura-mono mt-1.5 text-[12px]" style={{ color: a.ink }}>
                    {d.field}
                  </p>
                </div>
              </article>
            );
          })}
          <div aria-hidden className="w-10 flex-none" />
        </div>
      </div>
    </section>
  );
}
