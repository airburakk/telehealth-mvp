import { section } from "@/lib/doctorium-landing/content";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { PersonalizationDemo } from "../../doctorium-v2/PersonalizationDemo";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

export function PersonalizeSection({ sample }: { sample: LandingSample }) {
  const copy = section("personalize");
  return (
    <LandingSection copy={copy}>
      {/* grid-cols-[minmax(0,1fr)]: tek kolonda item min-width:auto taşması (v2'den taşınan ölçüm). */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <FadeInUp>
          <SectionHead copy={copy} />
          <ol className="mt-10 divide-y divide-[var(--dl-line)] border-y border-[var(--dl-line)]">
            {copy.items?.map((it) => (
              <li key={it.k} className="grid gap-2 py-5 sm:grid-cols-[64px_1fr]">
                <span className="text-[12px] font-semibold tracking-[0.04em] text-[var(--dl-emerald)]">{it.k}</span>
                <div>
                  <div className="text-xl font-medium tracking-[-0.01em]">{it.t}</div>
                  {it.b && <p className="mt-1 text-[15px] leading-relaxed text-[var(--dl-body)]">{it.b}</p>}
                </div>
              </li>
            ))}
          </ol>
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </FadeInUp>
        <PersonalizationDemo initial={sample} />
      </div>
    </LandingSection>
  );
}
