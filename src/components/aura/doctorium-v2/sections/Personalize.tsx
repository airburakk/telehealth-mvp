import { section } from "@/lib/doctorium-landing/content";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { LandingSection, Note, SectionHead } from "../primitives";
import { PersonalizationDemo } from "../PersonalizationDemo";

// KİŞİSELLEŞTİRME (belge §4 — sayfanın "aha" anı): sol adımlar, sağ canlı önizleme. Yalnız GERÇEK
// tercih eksenleri (branş + bölüm); "ilgi alanı / kaynak / ülke / sıklık" ürün desteklemediği için yok.
export function PersonalizeSection({ sample }: { sample: LandingSample }) {
  const copy = section("personalize");
  return (
    <LandingSection copy={copy}>
      {/* grid-cols-[minmax(0,1fr)]: tek kolona düşünce grid item min-width:auto demo panelinin
          (select/çip satırı) içerik genişliğini kolona dayatıp 320px'te taşırıyordu (ölçüldü). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <div>
          <SectionHead copy={copy} />
          <ol className="mt-10 divide-y divide-[var(--dl-line)] border-y border-[var(--dl-line)]">
            {copy.items?.map((it) => (
              <li key={it.k} className="grid gap-2 py-5 sm:grid-cols-[64px_1fr]">
                <span className="aura-mono text-[11px] font-semibold text-[var(--dl-emerald)]">{it.k}</span>
                <div>
                  <div className="aura-display text-xl font-medium tracking-tight">{it.t}</div>
                  {it.b && <p className="mt-1 text-[15px] leading-relaxed text-[var(--dl-body)]">{it.b}</p>}
                </div>
              </li>
            ))}
          </ol>
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </div>
        <PersonalizationDemo initial={sample} />
      </div>
    </LandingSection>
  );
}
