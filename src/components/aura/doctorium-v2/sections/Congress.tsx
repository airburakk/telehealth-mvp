import { section } from "@/lib/doctorium-landing/content";
import type { LandingProof } from "@/lib/doctorium-landing/landing-feed";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { landingBranchLabel } from "@/lib/doctorium-landing/taxonomy";
import { CongressList } from "@/app/doktor/doctorium/CongressList";
import { ProductFrame } from "../ProductFrame";
import { LandingSection, Note, SectionHead } from "../primitives";

// KONGRE & MESLEKİ GELİŞİM (belge §9): gerçek CongressList (canFollow=false, savedIds=null →
// Takip/Kaydet düğmeleri çizilmez; giriş yapınca açılır). Bildiri/erken kayıt son günleri, TTB
// kodu (kredi SAYISI yok). Boş ise dürüst boş durum — fixture kongre üretilmez.
export function CongressSection({ proof, branch }: { proof: LandingProof["congress"]; branch: string }) {
  const copy = section("congress");
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <div>
          <SectionHead copy={copy} />
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </div>
        <ProductFrame title="Etkinlik" meta={landingBranchLabel(branch)}>
          {proof.rows.length ? (
            <div className="-mt-4">
              <CongressList rows={proof.rows} followed={new Set()} canFollow={false} savedIds={null} hrefFor={() => LANDING_ROUTES.login} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--c-ink-2)]">Yaklaşan etkinlik listesi şu an boş; takvim her gece güncellenir.</p>
          )}
        </ProductFrame>
      </div>
    </LandingSection>
  );
}
