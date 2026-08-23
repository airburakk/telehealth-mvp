import { section, DIFFERENCE_ROWS } from "@/lib/doctorium-landing/content";
import { LandingSection, SectionHead } from "../primitives";
import { Rich } from "../rich-text";

// NEDEN DOCTORIUM? (belge §13): rakip adı yok, ölçülmemiş performans iddiası yok — kategori farkı.
// Gerçek <table> semantiği (başlık hücreleri); dar ekranda iki kısa kolon sığar, taşma kapsayıcıda.
export function DifferenceSection() {
  const copy = section("difference");
  return (
    <LandingSection copy={copy}>
      <SectionHead copy={copy} align="center" />
      <div className="mx-auto mt-12 max-w-3xl overflow-x-auto">
        <table className="w-full border-collapse text-left text-[15px]">
          <thead>
            <tr className="aura-mono text-[11px] uppercase tracking-[0.16em] text-[var(--dl-muted)]">
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
        <p className="aura-display mx-auto mt-14 max-w-[760px] text-center text-[clamp(24px,3.2vw,36px)] font-medium leading-[1.15] tracking-tight">
          <Rich text={copy.note} />
        </p>
      )}
    </LandingSection>
  );
}
