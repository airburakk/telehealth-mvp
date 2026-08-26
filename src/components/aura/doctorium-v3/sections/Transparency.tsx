import { section } from "@/lib/doctorium-landing/content";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

export function TransparencySection() {
  const copy = section("transparency");
  return (
    <LandingSection copy={copy}>
      <FadeInUp>
        <SectionHead copy={copy} align="center" size="lg" />
      </FadeInUp>
      <FadeInUp delay={0.08}>
        <ol className="mx-auto mt-14 grid max-w-5xl gap-px border-y border-[var(--dl-line)] sm:grid-cols-2 lg:grid-cols-4">
          {copy.items?.map((it, i) => (
            <li key={it.t} className="py-6 pr-6 lg:border-l lg:border-[var(--dl-line)] lg:pl-6 lg:first:border-0 lg:first:pl-0">
              <span className="text-[12px] font-semibold tracking-[0.04em] text-[var(--dl-emerald)]">0{i + 1}</span>
              <div className="mt-2 text-[17px] font-medium leading-snug">{it.t}</div>
            </li>
          ))}
        </ol>
        {copy.note && <Note text={copy.note} className="mx-auto mt-10 max-w-[560px] text-[15px] text-[var(--dl-body)]" />}
      </FadeInUp>
    </LandingSection>
  );
}
