import { section, REGULATORY_SOURCES } from "@/lib/doctorium-landing/content";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { FeedPreview } from "../FeedPreview";
import { ProductFrame } from "../ProductFrame";
import { LandingSection, Note, SectionHead } from "../primitives";

// İLAÇ & REGÜLASYON (belge §7): ters düzen — UI solda, copy sağda. Kaynak çipleri YALNIZ gerçekten
// çekilenler (openFDA · ClinicalTrials.gov · Resmî Gazete · OHSAD); EMA/TİTCK YOK (registry unsupported).
export function RegulatorySection({ sample }: { sample: LandingSample }) {
  const copy = section("regulatory");
  const items = sample.items.filter((i) => i.module === "ilac" || i.module === "mevzuat").slice(0, 3);
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
        <ProductFrame className="order-2 lg:order-1" title="İlaç & Regülasyon · Mevzuat" meta={sample.source === "fixture" ? "örnek içerik" : "kaynak + tarih"}>
          <ul className="mb-2 flex flex-wrap gap-1.5 border-b border-[var(--c-hairline)] pb-3" aria-label="İzlenen kaynaklar">
            {REGULATORY_SOURCES.map((s) => (
              <li key={s} className="aura-mono rounded-full border border-[var(--c-hairline)] px-2.5 py-1 text-[11px] text-[var(--c-ink-2)]">{s}</li>
            ))}
          </ul>
          <FeedPreview items={items.length ? items : sample.items.slice(0, 3)} branch={sample.branch} why={false} />
        </ProductFrame>
        <div className="order-1 lg:order-2">
          <SectionHead copy={copy} />
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </div>
      </div>
    </LandingSection>
  );
}
