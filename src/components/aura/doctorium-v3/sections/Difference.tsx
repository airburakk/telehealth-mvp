import { section, DIFFERENCE_ROWS } from "@/lib/doctorium-landing/content";
import { Rich } from "../../doctorium-v2/rich-text";
import { FadeInUp } from "../motion";
import { LandingSection, SectionHead } from "../primitives";

export function DifferenceSection() {
  const copy = section("difference");
  return (
    <LandingSection copy={copy}>
      <FadeInUp>
        <SectionHead copy={copy} align="center" />
      </FadeInUp>
      <FadeInUp delay={0.08}>
        <div className="mx-auto mt-12 max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="text-[13px] text-[var(--dl-muted)]">
                <th scope="col" className="border-b border-[var(--dl-line)] py-3 pr-4 font-semibold">Genel profesyonel portal</th>
                <th scope="col" className="border-b border-[var(--dl-line)] py-3 pl-4 font-semibold text-[var(--dl-emerald)]">Doctorium</th>
              </tr>
            </thead>
            <tbody>
              {DIFFERENCE_ROWS.map((r) => (
                <tr key={r.portal}>
                  <td className="border-b border-[var(--dl-line)] py-3.5 pr-4 text-[var(--dl-muted)]">{r.portal}</td>
                  <td className="border-b border-[var(--dl-line)] py-3.5 pl-4 font-medium text-[var(--dl-ink)]">{r.doctorium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {copy.note && (
          <p className="mx-auto mt-14 max-w-[760px] text-center text-[clamp(24px,3.2vw,36px)] font-medium leading-[1.15] tracking-[-0.02em]">
            <Rich text={copy.note} />
          </p>
        )}
      </FadeInUp>
    </LandingSection>
  );
}
