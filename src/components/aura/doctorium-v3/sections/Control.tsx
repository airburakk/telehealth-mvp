import { section } from "@/lib/doctorium-landing/content";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

export function ControlSection() {
  const copy = section("control");
  return (
    <LandingSection copy={copy}>
      <FadeInUp>
        <SectionHead copy={copy} align="center" size="lg" />
      </FadeInUp>
      <FadeInUp delay={0.08}>
        <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-3">
          {copy.items?.map((it, i) => (
            <li key={it.t} className="rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] p-6">
              <span className="text-[12px] font-semibold tracking-[0.04em] text-[var(--dl-emerald)]">0{i + 1}</span>
              <div className="mt-3 text-xl font-medium tracking-[-0.01em]">{it.t}</div>
              {it.b && <p className="mt-2 text-[15px] leading-relaxed text-[var(--dl-body)]">{it.b}</p>}
            </li>
          ))}
        </ul>
        {copy.note && <Note text={copy.note} className="mx-auto mt-10 max-w-[560px] text-[15px] text-[var(--dl-body)]" />}
      </FadeInUp>
    </LandingSection>
  );
}
