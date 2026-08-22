import { section } from "@/lib/doctorium-landing/content";
import { LandingSection, Note, SectionHead } from "../primitives";

// KONTROL SİZDE (belge §11): yalnız ürünün GERÇEK kontrol eksenleri (bölüm · branş · etkinlik
// türü/kapsam/hatırlatma). "Hangi kaynaklardan / ne sıklıkta" YOK (registry unsupported). Dekoratif
// switch yok — üç düz kart.
export function ControlSection() {
  const copy = section("control");
  return (
    <LandingSection copy={copy}>
      <SectionHead copy={copy} align="center" size="lg" />
      <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-3">
        {copy.items?.map((it, i) => (
          <li key={it.t} className="rounded-2xl border border-[var(--dl-line)] bg-[var(--dl-panel)] p-6">
            <span className="aura-mono text-[11px] font-semibold text-[var(--dl-emerald)]">0{i + 1}</span>
            <div className="aura-display mt-3 text-xl font-medium tracking-tight">{it.t}</div>
            {it.b && <p className="mt-2 text-[15px] leading-relaxed text-[var(--dl-body)]">{it.b}</p>}
          </li>
        ))}
      </ul>
      {copy.note && <Note text={copy.note} className="mx-auto mt-10 max-w-[560px] text-[15px] text-[var(--dl-body)]" />}
    </LandingSection>
  );
}
