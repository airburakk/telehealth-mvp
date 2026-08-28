import { section } from "@/lib/doctorium-landing/content";
import type { LandingProof } from "@/lib/doctorium-landing/landing-feed";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { landingBranchLabel } from "@/lib/doctorium-landing/taxonomy";
import { CongressList } from "@/app/doktor/doctorium/CongressList";
import { ProductFrame } from "../../doctorium-v2/ProductFrame";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

export function CongressSection({ proof, branch }: { proof: LandingProof["congress"]; branch: string }) {
  const copy = section("congress");
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <FadeInUp>
          <SectionHead copy={copy} />
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </FadeInUp>
        <ProductFrame className="theme-light doctorium-scope" title="Etkinlik" meta={landingBranchLabel(branch)}>
          {proof.rows.length ? (
            <div className="-mt-4">
              <CongressList rows={proof.rows.slice(0, 2)} followed={new Set()} canFollow={false} savedIds={null} hrefFor={() => LANDING_ROUTES.login} />
              {proof.rows.length > 2 && (
                <details className="group mt-1 border-t border-[var(--c-hairline)] pt-3">
                  <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
                    <span className="group-open:hidden">Daha fazlasını gör ({proof.rows.length - 2})</span>
                    <span className="hidden group-open:inline">Daha az göster</span>
                  </summary>
                  <div className="-mt-4">
                    <CongressList rows={proof.rows.slice(2)} followed={new Set()} canFollow={false} savedIds={null} hrefFor={() => LANDING_ROUTES.login} />
                  </div>
                </details>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--c-ink-2)]">Yaklaşan etkinlik listesi şu an boş; takvim her gece güncellenir.</p>
          )}
        </ProductFrame>
      </div>
    </LandingSection>
  );
}
