"use client";

import { HeartPulse, Brain, PersonStanding, Layers, Dna, Stethoscope, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/aura-landing/i18n";

// Doktorlar v4 (sandwich gündüz gövdesi): beyaz zeminde yatay portre şeridi. Her karta branşının
// SEMANTİK rengi + lucide branş ikonu (platform BranchAvatar ile TEK TİP — vitrin↔platform görsel
// birliği, 2026-07-13). Portre köşesinde branş rozeti; üst şerit + branş adı branş renginde.
// Renkler landing'de doğrudan hex (var(--c-*) token'ları .aura-page altında tanımsız → hex şart).
const DOC_BRAND: Record<string, { color: string; Icon: LucideIcon }> = {
  "doc-cardio": { color: "#E5484D", Icon: HeartPulse }, // kardiyoloji — kırmızı
  "doc-neuro": { color: "#6E56CF", Icon: Brain }, // nöroloji — mor/indigo
  "doc-ortho": { color: "#3E63DD", Icon: PersonStanding }, // ortopedi — mavi (BranchAvatar ile senkron)
  "doc-derm": { color: "#E5720A", Icon: Layers }, // dermatoloji — amber (cilt katmanları)
  "doc-ivf": { color: "#12A594", Icon: Dna }, // tüp bebek — turkuaz (IVF/genetik)
};
const DOC_FALLBACK = { color: "#17919e", Icon: Stethoscope };

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
        {/* Yatay kaydırma şeridi klavye erişimli: tabIndex + role/aria-label ile
            odaklanınca ok tuşlarıyla kaydırılır (WCAG 2.1.1). */}
        <div
          role="group"
          aria-label={t.doctors.headline}
          tabIndex={0}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-4 md:px-8 [scrollbar-width:thin]"
        >
          {t.doctors.list.map((d) => {
            const brand = DOC_BRAND[d.img] ?? DOC_FALLBACK;
            const Icon = brand.Icon;
            // Branş adı beyaz sandwich zemininde okunsun diye branş renginin koyu tonu (AA).
            const fieldInk = `color-mix(in srgb, ${brand.color}, #000 26%)`;
            return (
              <article
                key={d.img}
                className="group relative w-60 flex-none snap-start overflow-hidden rounded-xl border border-[var(--aura-hairline)] bg-[var(--aura-panel)] transition-transform duration-300 hover:-translate-y-1"
              >
                {/* Branş renk-kodu şeridi (kart üstü) */}
                <div aria-hidden className="h-[3px] w-full" style={{ background: brand.color }} />
                <div className="relative h-64 overflow-hidden">
                  {/* Portre dekoratif: isim + branş zaten altında metin olarak
                      okunur → alt boş (ekran okuyucuda çift okumayı önler). */}
                  <img
                    src={`/assets/${d.img}.jpg`}
                    alt=""
                    className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                    loading="lazy"
                  />
                  {/* Branş rozeti — platform lucide ikonuyla TEK TİP; branş renginde dolu daire */}
                  <span
                    className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/25 shadow-lg"
                    style={{ background: brand.color }}
                  >
                    <Icon size={18} className="text-white" strokeWidth={2.2} />
                  </span>
                </div>
                <div className="p-4">
                  <p className="aura-display text-base font-bold leading-tight">{d.name}</p>
                  <p className="aura-mono mt-1.5 text-[12px]" style={{ color: fieldInk }}>
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
