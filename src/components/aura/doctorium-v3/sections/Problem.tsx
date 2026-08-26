import { section, PROBLEM_SOURCES } from "@/lib/doctorium-landing/content";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

export function ProblemSection() {
  const copy = section("problem");
  return (
    <LandingSection copy={copy}>
      <FadeInUp>
        <SectionHead copy={copy} align="center" />
      </FadeInUp>
      <FadeInUp delay={0.08}>
        <div className="mx-auto mt-14 grid max-w-4xl gap-px border-y border-[var(--dl-line)] sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEM_SOURCES.map((s) => (
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
