import { section } from "@/lib/doctorium-landing/content";
import type { LandingProof } from "@/lib/doctorium-landing/landing-feed";
import { AcademicSummaryBlock } from "@/app/doktor/doctorium/AcademicSummaryBlock";
import { FeedPreview } from "../FeedPreview";
import { ProductFrame } from "../ProductFrame";
import { LandingSection, Note, SectionHead } from "../primitives";

// AKADEMİK (belge §6): özet → temel bulgular → kaynak → özgün yayın. Gerçek ArticleCard künyesi
// (kaynak · tarih · DOI) + gerçek AcademicSummaryBlock (portalla aynı bileşen).
// "Neden önemli" alanı üründe YOK → yazılmaz; "2 dk" iddiası yok (compact).
// Sarı uyarı bandı landing'de KAPALI (`disclaimer={false}`, kullanıcı kararı 2026-08-23: metin
// revize edilecek, tanıtım eski hâlini göstermesin); portalda aynen sürer. AI işareti başlıkta +
// bölüm notunda ("Özet yapay zekâ ile üretilir ve açıkça işaretlenir").
export function AcademicSection({ proof, branch }: { proof: LandingProof["academic"]; branch: string }) {
  const copy = section("academic");
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHead copy={copy} />
          {copy.note && <Note text={copy.note} className="mt-8" />}
        </div>
        <ProductFrame title="Akademik" meta={proof.source === "fixture" ? "örnek içerik" : proof.item.sourceName}>
          <FeedPreview items={[proof.item]} branch={branch} weight="mid" why={false} />
          <div className="mt-2">
            <AcademicSummaryBlock summary={proof.summary} compact disclaimer={false} />
          </div>
        </ProductFrame>
      </div>
    </LandingSection>
  );
}
