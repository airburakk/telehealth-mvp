import { section } from "@/lib/doctorium-landing/content";
import { LandingSection, Note, SectionHead } from "../primitives";

// GÜVEN & AI ŞEFFAFLIĞI (belge §12): manifesto sadeliği — dört ilke, tek kapanış cümlesi.
// İlkelerin kod karşılığı: ArticleCard künyesi (kaynak · tarih · DOI/URL) + AcademicSummaryBlock
// uyarı bandı; model/üretim zamanı SAKLANMADIĞI için öyle bir vaat YOK.
export function TransparencySection() {
  const copy = section("transparency");
  return (
    <LandingSection copy={copy}>
      <SectionHead copy={copy} align="center" size="lg" />
      <ol className="mx-auto mt-14 grid max-w-5xl gap-px border-y border-[var(--dl-line)] sm:grid-cols-2 lg:grid-cols-4">
        {copy.items?.map((it, i) => (
          <li key={it.t} className="py-6 pr-6 lg:border-l lg:border-[var(--dl-line)] lg:pl-6 lg:first:border-0 lg:first:pl-0">
            <span className="aura-mono text-[11px] font-semibold text-[var(--dl-emerald)]">0{i + 1}</span>
            <div className="aura-display mt-2 text-[17px] font-medium leading-snug">{it.t}</div>
          </li>
        ))}
      </ol>
      {copy.note && <Note text={copy.note} className="mx-auto mt-10 max-w-[560px] text-[15px] text-[var(--dl-body)]" />}
    </LandingSection>
  );
}
