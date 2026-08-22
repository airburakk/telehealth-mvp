import { section } from "@/lib/doctorium-landing/content";
import type { LandingProof } from "@/lib/doctorium-landing/landing-feed";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { LEGAL_TABS } from "@/lib/doctorium";
import { LegalSearchBox } from "@/app/doktor/doctorium/LegalSearchBox";
import { FeedPreview } from "../FeedPreview";
import { ProductFrame } from "../ProductFrame";
import { LandingSection, Note, SectionHead } from "../primitives";

// SAĞLIK HUKUKU (belge §8): Mevzuat / İçtihat / Doktrin üçlüsü + GERÇEK LegalSearchBox (demo modu —
// hedefler giriş kapısına) + "Aydınlatılmış onam" çipiyle gerçek arşiv sonuçları. Hukuki tavsiye
// izlenimi yok (copy + "hukuki görüş değildir").
export function LegalSection({ proof, branch }: { proof: LandingProof["legal"]; branch: string }) {
  const copy = section("legal");
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <div>
          <SectionHead copy={copy} />
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </div>
        <ProductFrame title="Hukuk" meta={proof.source === "fixture" ? "örnek içerik" : "gerçek arşiv"}>
          <div role="tablist" aria-label="Hukuk bölümleri" className="flex gap-1 border-b border-[var(--c-hairline)]">
            {LEGAL_TABS.map((t) => {
              const on = t.key === "ictihat";
              return (
                <span
                  key={t.key}
                  role="tab"
                  aria-selected={on}
                  className={`aura-mono -mb-px border-b-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    on ? "border-rose-400 text-rose-300" : "border-transparent text-[var(--c-ink-3)]"
                  }`}
                >
                  {t.label}
                </span>
              );
            })}
          </div>
          <LegalSearchBox tab="ictihat" query={proof.query} activeKeyword={proof.keyword} demo={{ href: LANDING_ROUTES.login }} />
          <div className="mt-3">
            <FeedPreview items={proof.items} branch={branch} why={false} max={3} />
          </div>
        </ProductFrame>
      </div>
    </LandingSection>
  );
}
