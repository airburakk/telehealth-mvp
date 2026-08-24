import { section } from "@/lib/doctorium-landing/content";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { pickOnePerModule } from "@/lib/doctorium-landing/pick";
import { landingBranchLabel } from "@/lib/doctorium-landing/taxonomy";
import { FeedPreview } from "../FeedPreview";
import { ProductFrame } from "../ProductFrame";
import { LandingSection, Note, SectionHead } from "../primitives";

// BUGÜN SİZİN İÇİN (belge §5 — günlük dönüş motoru): UI ekranın yıldızı. QA DESK-08 / mobil P1:
// ilk görünüm 3 ana kart (her biri farklı tür, branş-eşleşmeli önde); 4. kart "Daha fazlasını gör"
// (native details) altında. "Neden görüyorum?" metadata seviyesinde (FeedPreview). Sayı yalnız gerçek
// sayımdan; yoksa yazılmaz.
export function TodaySection({ sample }: { sample: LandingSample }) {
  const copy = section("today");
  const four = pickOnePerModule(sample.items, sample.branch, 4);
  const [a, b, c, ...more] = four;
  const n = sample.todayTotal;
  return (
    <LandingSection copy={copy}>
      <SectionHead copy={copy} align="center" />
      <ProductFrame
        className="mt-12"
        title={n > 0 ? `Bugün sizin için · ${n} yeni içerik` : "Bugün sizin için"}
        meta={sample.source === "fixture" ? `${landingBranchLabel(sample.branch)} · örnek içerik` : landingBranchLabel(sample.branch)}
      >
        <div className="grid gap-x-8 md:grid-cols-3">
          {[a, b, c].filter(Boolean).map((item) => (
            <div key={item.id} className="min-w-0 md:[&>ul>li]:border-t-0 md:[&>ul>li]:pt-1">
              <FeedPreview items={[item]} branch={sample.branch} weight="mid" why />
            </div>
          ))}
        </div>
        {more.length > 0 && (
          <details className="group mt-1 border-t border-[var(--c-hairline)] pt-3">
            <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
              <span className="group-open:hidden">Daha fazlasını gör ({more.length})</span>
              <span className="hidden group-open:inline">Daha az göster</span>
            </summary>
            <div className="mt-2 grid gap-x-8 md:grid-cols-3">
              {more.map((item) => (
                <div key={item.id} className="min-w-0 md:[&>ul>li]:border-t-0 md:[&>ul>li]:pt-1">
                  <FeedPreview items={[item]} branch={sample.branch} weight="min" why />
                </div>
              ))}
            </div>
          </details>
        )}
      </ProductFrame>
      {copy.note && <Note text={copy.note} className="mx-auto mt-8 max-w-[640px]" />}
    </LandingSection>
  );
}
