import { canShow } from "@/lib/doctorium-landing/capabilities";
import { section, PROBLEM_SOURCES } from "@/lib/doctorium-landing/content";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

export function ProblemSection() {
  const copy = section("problem");
  // v6.262: `requires` taşıyan satır (Sektörel) yalnız anahtarı gösterilebilirken çizilir; bölüm düşmez.
  const sources = PROBLEM_SOURCES.filter((s) => !s.requires || canShow(s.requires));
  return (
    <LandingSection copy={copy}>
      <FadeInUp>
        <SectionHead copy={copy} align="center" />
      </FadeInUp>
      <FadeInUp delay={0.08}>
        {/* v6.262: 4 → 5 sütun (Sektörel); max-w 4xl → 5xl ki beş sütun sıkışmasın. */}
        <div className="mx-auto mt-14 grid max-w-5xl gap-px border-y border-[var(--dl-line)] sm:grid-cols-2 lg:grid-cols-5">
          {sources.map((s) => (
            <div key={s.k} className="py-6 pr-6 lg:border-l lg:border-[var(--dl-line)] lg:pl-6 lg:first:border-0 lg:first:pl-0">
              <div className="text-[15px] font-medium">{s.k}</div>
              <div aria-hidden className="my-2 text-[var(--dl-emerald)]">↓</div>
              <div className="text-xs leading-relaxed text-[var(--dl-muted)]">{s.sources}</div>
            </div>
          ))}
        </div>
        {copy.note && <Note text={copy.note} className="mx-auto mt-12 max-w-[640px] text-[15px] text-[var(--dl-body)]" />}
      </FadeInUp>
    </LandingSection>
  );
}
