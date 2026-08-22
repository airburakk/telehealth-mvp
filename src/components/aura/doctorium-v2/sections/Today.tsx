import { section } from "@/lib/doctorium-landing/content";
import { pickOnePerModule, type LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { landingBranchLabel } from "@/lib/doctorium-landing/taxonomy";
import { FeedPreview } from "../FeedPreview";
import { ProductFrame } from "../ProductFrame";
import { LandingSection, Note, SectionHead } from "../primitives";

// BUGÜN SİZİN İÇİN (belge §5 — günlük dönüş motoru): UI ekranın yıldızı. 2×2: her ana bölümden
// bir gerçek kart (akademik · ilaç · hukuk · etkinlik), her kartın altında kuraldan türetilmiş
// "Neden görüyorum?". Sayı yalnız gerçek sayımdan; yoksa yazılmaz.
export function TodaySection({ sample }: { sample: LandingSample }) {
  const copy = section("today");
  const four = pickOnePerModule(sample.items);
  const n = sample.todayTotal;
  return (
    <LandingSection copy={copy}>
      <SectionHead copy={copy} align="center" />
      <ProductFrame
        className="mt-12"
        title={n > 0 ? `Bugün sizin için · ${n} yeni içerik` : "Bugün sizin için"}
        meta={sample.source === "fixture" ? `${landingBranchLabel(sample.branch)} · örnek içerik` : landingBranchLabel(sample.branch)}
      >
        <div className="grid gap-x-8 md:grid-cols-2">
          {four.map((item) => (
            <div key={item.id} className="min-w-0 md:[&>ul>li]:border-t-0 md:[&>ul>li]:pt-1">
              <FeedPreview items={[item]} branch={sample.branch} weight="mid" why />
            </div>
          ))}
        </div>
      </ProductFrame>
      {copy.note && <Note text={copy.note} className="mx-auto mt-8 max-w-[640px]" />}
    </LandingSection>
  );
}
